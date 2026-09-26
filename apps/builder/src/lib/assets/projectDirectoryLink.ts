/**
 * ADR-235 Phase 6 — 프로젝트 디렉토리 연결 (Chromium File System Access, 프로젝트별 opt-in).
 *
 * 연결된 프로젝트는 디렉토리가 원본이고 IndexedDB 는 작업본이다 (Decision 4). 문서가 IndexedDB 에
 * 저장된 뒤 (`composition:document-persisted`) 백그라운드로 v2 세대를 디렉토리에 쓴다 (HC1 — DB
 * 단계 뒤, 편집을 막지 않는다). 세대 전환 · 보존 · 정리는 shared `writeV2Directory` (§2).
 *
 * - 권한 — 새로고침 뒤에는 `requestPermission` 에 사용자 클릭이 필요하다. 권한이 없는 동안은 쓰지
 *   않고 (편집은 IndexedDB 에 보존) 상태 `needs-permission` 으로 알린다.
 * - 충돌 — 쓰기 전 `manifest.json` 의 revision · 수정 시각이 마지막으로 쓴 값과 다르면 (다른 곳에서
 *   수정) 자동 쓰기를 멈추고 `conflict` 로 알린다. 사용자가 "폴더 내용으로 열기" 또는 "덮어쓰기" 를 고른다.
 *
 * lazy 전용 — builder 상태는 호출부가 주입한다 (`collectContent`).
 */
import {
  buildV2Generation,
  directoryV2Source,
  nextV2Revision,
  readManifestRevision,
  readV2Generation,
  writeV2Directory,
  type ProjectContentV2,
  type V2DirectoryTarget,
} from "@composition/shared/assets";
import { readAssetRecords } from "./assetDb";
import { storeAssetBytes } from "./assetStore";
import { installIndexedDbAssetUrlResolver } from "./assetUrlResolver";

export type DirectoryLinkStatus =
  "idle" | "writing" | "synced" | "needs-permission" | "conflict" | "error";

export interface DirectoryLinkState {
  projectId: string;
  status: DirectoryLinkStatus;
  directoryName: string;
  lastRevision: number | null;
  error?: string;
}

export const DIRECTORY_LINK_EVENT = "composition:directory-link";
export const DOCUMENT_PERSISTED_EVENT = "composition:document-persisted";
export const directoryLinkFlagKey = (projectId: string) =>
  `composition.dir-link.${projectId}`;

const LINKS_DB = "composition-links";
const LINKS_STORE = "links";
const WRITE_DEBOUNCE_MS = 1500;

interface LinkRecord {
  projectId: string;
  handle: FileSystemDirectoryHandle;
  lastRevision: number | null;
  lastModified: number | null;
  linkedAt: string;
}

// ============================================
// FSA → V2DirectoryTarget
// ============================================

type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?(descriptor: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor: {
    mode: "readwrite";
  }): Promise<PermissionState>;
  entries?(): AsyncIterableIterator<[string, FileSystemHandle]>;
};

async function subdir(
  root: FileSystemDirectoryHandle,
  segments: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle | null> {
  let dir = root;
  for (const segment of segments) {
    try {
      dir = await dir.getDirectoryHandle(segment, { create });
    } catch {
      return null;
    }
  }
  return dir;
}

async function fileHandle(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<FileSystemFileHandle | null> {
  const segments = path.split("/");
  const dir = await subdir(root, segments.slice(0, -1), create);
  if (!dir) return null;
  try {
    return await dir.getFileHandle(segments.at(-1)!, { create });
  } catch {
    return null;
  }
}

export function fsaDirectoryTarget(
  root: FileSystemDirectoryHandle,
): V2DirectoryTarget {
  return {
    async read(path) {
      const handle = await fileHandle(root, path, false);
      if (!handle) return null;
      return new Uint8Array(await (await handle.getFile()).arrayBuffer());
    },
    async write(path, bytes) {
      const handle = await fileHandle(root, path, true);
      if (!handle) throw new Error(`파일을 만들 수 없습니다: ${path}`);
      const writable = await handle.createWritable();
      await writable.write(bytes as BufferSource);
      await writable.close();
    },
    async remove(path) {
      const segments = path.split("/");
      const dir = await subdir(root, segments.slice(0, -1), false);
      await dir?.removeEntry(segments.at(-1)!).catch(() => {});
    },
    async list(dirName) {
      const dir = (await subdir(
        root,
        [dirName],
        false,
      )) as PermissionHandle | null;
      if (!dir?.entries) return [];
      const names: string[] = [];
      for await (const [name, entry] of dir.entries()) {
        if (entry.kind === "file") names.push(name);
      }
      return names;
    },
    async lastModified(path) {
      const handle = await fileHandle(root, path, false);
      return handle ? (await handle.getFile()).lastModified : null;
    },
  };
}

// ============================================
// 연결 기록 (별도 DB — 원본 DB 버전과 무관)
// ============================================

function openLinksDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LINKS_DB, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(LINKS_STORE, { keyPath: "projectId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function linksTx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openLinksDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(LINKS_STORE, mode);
    const request = run(tx.objectStore(LINKS_STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(request.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

// ============================================
// 연결
// ============================================

export interface DirectoryLinkDeps {
  collectContent(): ProjectContentV2 | null;
}

const links = new Map<string, DirectoryLink>();

class DirectoryLink {
  state: DirectoryLinkState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing = false;
  private dirty = false;
  private readonly onPersisted = (event: Event) => {
    const detail = (event as CustomEvent<{ projectId?: string }>).detail;
    if (!detail?.projectId || detail.projectId === this.record.projectId) {
      this.schedule();
    }
  };

  constructor(
    private record: LinkRecord,
    private deps: DirectoryLinkDeps,
  ) {
    this.state = {
      projectId: record.projectId,
      status: "idle",
      directoryName: record.handle.name,
      lastRevision: record.lastRevision,
    };
    window.addEventListener(DOCUMENT_PERSISTED_EVENT, this.onPersisted);
    window.addEventListener(
      "composition:custom-fonts-updated",
      this.onPersisted,
    );
  }

  dispose(): void {
    if (this.timer) clearTimeout(this.timer);
    window.removeEventListener(DOCUMENT_PERSISTED_EVENT, this.onPersisted);
    window.removeEventListener(
      "composition:custom-fonts-updated",
      this.onPersisted,
    );
  }

  private publish(next: Partial<DirectoryLinkState>): void {
    this.state = { ...this.state, ...next };
    window.dispatchEvent(
      new CustomEvent(DIRECTORY_LINK_EVENT, { detail: this.state }),
    );
  }

  schedule(): void {
    if (
      this.state.status === "conflict" ||
      this.state.status === "needs-permission"
    )
      return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.write(), WRITE_DEBOUNCE_MS);
  }

  private get target(): V2DirectoryTarget {
    return fsaDirectoryTarget(this.record.handle);
  }

  async hasPermission(): Promise<boolean> {
    const handle = this.record.handle as PermissionHandle;
    if (!handle.queryPermission) return true;
    return (await handle.queryPermission({ mode: "readwrite" })) === "granted";
  }

  /** 사용자 클릭 안에서만 부른다 (브라우저 권한 창) */
  async requestPermission(): Promise<boolean> {
    const handle = this.record.handle as PermissionHandle;
    const granted =
      !handle.requestPermission ||
      (await handle.requestPermission({ mode: "readwrite" })) === "granted";
    if (granted) {
      this.publish({ status: "idle" });
      await this.write();
    }
    return granted;
  }

  /** 세대 쓰기 — force 면 충돌을 무시하고 덮어쓴다 (사용자 선택) */
  async write(force = false): Promise<void> {
    if (this.writing) {
      this.dirty = true;
      return;
    }
    if (!(await this.hasPermission())) {
      this.publish({ status: "needs-permission" });
      return;
    }
    const content = this.deps.collectContent();
    if (!content) return;
    this.writing = true;
    this.publish({ status: "writing" });
    try {
      const target = this.target;
      const revision = await readManifestRevision(target);
      const modified = (await target.lastModified?.("manifest.json")) ?? null;
      const external =
        revision !== null &&
        (this.record.lastRevision === null ||
          revision !== this.record.lastRevision ||
          (modified !== null &&
            this.record.lastModified !== null &&
            modified !== this.record.lastModified));
      if (external && !force) {
        this.publish({ status: "conflict" });
        return;
      }
      const generation = await buildV2Generation(
        content,
        async (hash) => {
          const record = (await readAssetRecords([hash])).get(hash);
          return record
            ? {
                bytes: new Uint8Array(await record.blob.arrayBuffer()),
                mime: record.mime,
                ext: record.ext,
                ...(record.name ? { name: record.name } : {}),
              }
            : null;
        },
        await nextV2Revision(target, this.record.lastRevision),
      );
      await writeV2Directory(target, generation, { keepPrevious: 1 });
      this.record = {
        ...this.record,
        lastRevision: generation.manifest.revision,
        lastModified: (await target.lastModified?.("manifest.json")) ?? null,
      };
      await linksTx("readwrite", (store) => store.put(this.record));
      this.publish({
        status: "synced",
        lastRevision: this.record.lastRevision,
        error: undefined,
      });
    } catch (error) {
      this.publish({
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.writing = false;
      if (this.dirty) {
        this.dirty = false;
        this.schedule();
      }
    }
  }

  /** 폴더의 현재 세대를 읽어 자산을 저장소에 넣고 envelope 로 (충돌 해소 — 폴더 내용으로 열기) */
  async readFromDirectory() {
    const read = await readV2Generation(directoryV2Source(this.target));
    const resolver = installIndexedDbAssetUrlResolver();
    for (const asset of read.assets.values()) {
      const stored = await storeAssetBytes({
        bytes: asset.bytes,
        mime: asset.mime,
        name: asset.name,
      });
      resolver.register(stored.ref, stored.blob);
    }
    this.record = {
      ...this.record,
      lastRevision: read.manifest.revision,
      lastModified: (await this.target.lastModified?.("manifest.json")) ?? null,
    };
    await linksTx("readwrite", (store) => store.put(this.record));
    this.publish({ status: "synced", lastRevision: read.manifest.revision });
    return read;
  }
}

/** 새 연결 — 이미 다른 프로젝트의 세대가 든 폴더면 충돌로 두고 쓰지 않는다 */
export async function connectProjectDirectory(
  projectId: string,
  handle: FileSystemDirectoryHandle,
  deps: DirectoryLinkDeps,
): Promise<DirectoryLinkState> {
  links.get(projectId)?.dispose();
  const target = fsaDirectoryTarget(handle);
  const existing = await readManifestRevision(target);
  const record: LinkRecord = {
    projectId,
    handle,
    lastRevision: null,
    lastModified: null,
    linkedAt: new Date().toISOString(),
  };
  await linksTx("readwrite", (store) => store.put(record));
  localStorage.setItem(directoryLinkFlagKey(projectId), "1");
  const link = new DirectoryLink(record, deps);
  links.set(projectId, link);
  if (existing !== null) {
    link.state = { ...link.state, status: "conflict" };
    window.dispatchEvent(
      new CustomEvent(DIRECTORY_LINK_EVENT, { detail: link.state }),
    );
  } else {
    await link.write();
  }
  return link.state;
}

/** 부팅 — 기록된 연결을 되살린다. 권한이 없으면 `needs-permission` (클릭 대기) */
export async function resumeProjectDirectoryLink(
  projectId: string,
  deps: DirectoryLinkDeps,
): Promise<DirectoryLinkState | null> {
  // crash sentinel — 핸들을 IndexedDB 에서 읽기 전에 표식을 남긴다. Chrome 153 실측: 비영속 (임시)
  //   프로필에서 OPFS 디렉토리 핸들을 IndexedDB 에서 역직렬화하면 브라우저가 종료됐다 (raw IndexedDB 로
  //   재현; 영속 프로필은 정상). 어떤 환경에서든 복원이 브라우저를 죽이면 열 때마다 죽는 루프가 되므로,
  //   표식이 남은 채 다시 부팅하면 (직전 복원이 끝나지 않음) 복원을 건너뛰고 연결을 해제한다.
  const sentinel = `composition.dir-link.resuming.${projectId}`;
  if (localStorage.getItem(sentinel)) {
    localStorage.removeItem(sentinel);
    localStorage.removeItem(directoryLinkFlagKey(projectId));
    await linksTx("readwrite", (store) => store.delete(projectId)).catch(
      () => {},
    );
    const state: DirectoryLinkState = {
      projectId,
      status: "error",
      directoryName: "",
      lastRevision: null,
      error: "relink",
    };
    window.dispatchEvent(
      new CustomEvent(DIRECTORY_LINK_EVENT, { detail: state }),
    );
    return state;
  }
  localStorage.setItem(sentinel, "1");
  const record = await linksTx<LinkRecord | undefined>("readonly", (store) =>
    store.get(projectId),
  ).finally(() => localStorage.removeItem(sentinel));
  if (!record) {
    localStorage.removeItem(directoryLinkFlagKey(projectId));
    return null;
  }
  links.get(projectId)?.dispose();
  const link = new DirectoryLink(record, deps);
  links.set(projectId, link);
  if (await link.hasPermission()) link.schedule();
  else link.state = { ...link.state, status: "needs-permission" };
  window.dispatchEvent(
    new CustomEvent(DIRECTORY_LINK_EVENT, { detail: link.state }),
  );
  return link.state;
}

export async function disconnectProjectDirectory(
  projectId: string,
): Promise<void> {
  links.get(projectId)?.dispose();
  links.delete(projectId);
  localStorage.removeItem(directoryLinkFlagKey(projectId));
  await linksTx("readwrite", (store) => store.delete(projectId));
  window.dispatchEvent(
    new CustomEvent(DIRECTORY_LINK_EVENT, {
      detail: {
        projectId,
        status: "idle",
        directoryName: "",
        lastRevision: null,
        unlinked: true,
      },
    }),
  );
}

export function getDirectoryLink(projectId: string): DirectoryLink | undefined {
  return links.get(projectId);
}

/** 메뉴 "폴더에 연결…" — 선택창 (사용자 클릭 안) → 연결. 취소면 null */
export async function pickAndConnectProjectDirectory(
  projectId: string,
  deps: DirectoryLinkDeps,
): Promise<DirectoryLinkState | null> {
  const picker = (
    window as unknown as {
      showDirectoryPicker?: (options: {
        mode: "readwrite";
        id: string;
      }) => Promise<FileSystemDirectoryHandle>;
    }
  ).showDirectoryPicker;
  if (!picker) return null;
  let handle: FileSystemDirectoryHandle;
  try {
    handle = await picker({ mode: "readwrite", id: "composition-project" });
  } catch {
    return null; // 사용자가 취소
  }
  return connectProjectDirectory(projectId, handle, deps);
}

export type DirectoryLinkAction =
  "permission" | "open" | "overwrite" | "disconnect";

/** 헤더 폴더 버튼 동작 — "폴더 내용으로 열기" 는 읽은 envelope 를 호출부 적용 함수로 넘긴다 */
export async function runDirectoryLinkAction(
  projectId: string,
  action: DirectoryLinkAction,
  applyImported: (data: unknown) => Promise<void>,
): Promise<void> {
  if (action === "disconnect") {
    await disconnectProjectDirectory(projectId);
    return;
  }
  const link = links.get(projectId);
  if (!link) return;
  if (action === "permission") await link.requestPermission();
  if (action === "overwrite") await link.write(true);
  if (action === "open") {
    const read = await link.readFromDirectory();
    await applyImported({
      version: read.manifest.formatVersion,
      exportedAt: read.manifest.savedAt,
      ...read.content,
    });
  }
}
