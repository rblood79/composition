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
 * - 비우기 — 오래 닫힌 연결 프로젝트는 IndexedDB 내용을 비울 수 있다 (Decision 4 · 사용자 판정
 *   2026-09-26). 폴더 세대를 쓸 때 IndexedDB 도장을 함께 기록하고, `evictStaleDirectoryProjects` 가
 *   도장 · 폴더 세대 · 열림 여부를 모두 확인한 뒤에만 지운다. 비운 프로젝트는 "폴더에서 불러오기"
 *   전까지 폴더에 쓰지 않는다 (빈 문서로 폴더를 덮지 않는다).
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
import {
  clearProjectLocalContent,
  hasProjectDataRows,
  PROJECT_EVICT_AFTER_MS,
  readProjectLocalStamp,
  sameProjectLocalStamp,
  type ProjectLocalStamp,
} from "./projectLocalEviction";

export type DirectoryLinkStatus =
  | "idle"
  | "writing"
  | "synced"
  | "needs-permission"
  | "conflict"
  | "cleared"
  | "error";

export interface DirectoryLinkState {
  projectId: string;
  status: DirectoryLinkStatus;
  directoryName: string;
  lastRevision: number | null;
  error?: string;
  /**
   * 사용자가 권한 창에서 거부했거나 창을 닫았다 (`needs-permission` 에서만 의미). 헤더가
   * "눌렀는데 변화 없음" 대신 거부 사실과 다시 허용 · 연결 해제를 보여 준다.
   */
  permissionDenied?: boolean;
}

export const DIRECTORY_LINK_EVENT = "composition:directory-link";
export const DOCUMENT_PERSISTED_EVENT = "composition:document-persisted";
export const directoryLinkFlagKey = (projectId: string) =>
  `composition.dir-link.${projectId}`;

const LINKS_DB = "composition-links";
const LINKS_STORE = "links";
const WRITE_DEBOUNCE_MS = 1500;
/** 열린 연결 프로젝트 표시 — 연결이 살아 있는 동안 shared 로 잡는다 (비우기는 exclusive 로 확인) */
export const PROJECT_OPEN_LOCK_PREFIX = "composition-project-open:";
const PERSIST_BLOCKED_EVENT = "composition:document-persist-blocked";

interface LinkRecord {
  projectId: string;
  handle: FileSystemDirectoryHandle;
  lastRevision: number | null;
  lastModified: number | null;
  linkedAt: string;
  /** 마지막 폴더 세대를 쓸 때의 IndexedDB 도장 — DB 내용이 그 세대에 다 들어 있음이 확인될 때만 */
  syncedStamp?: ProjectLocalStamp | null;
  syncedAt?: string | null;
  lastOpenedAt?: string | null;
  /** IndexedDB 내용을 비운 시각 — 폴더에서 불러오기 전까지 폴더에 쓰지 않는다 */
  clearedAt?: string | null;
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
  /**
   * 이 프로젝트가 이 탭의 활성 · 로드 완료 프로젝트일 때만 내용, 아니면 null. 연결은 SPA 이동 뒤에도
   * 남을 수 있고 부팅 중에는 collections 가 아직 비어 있다 — 그때 쓰면 다른 프로젝트 / 덜 로드된
   * 내용이 이 폴더의 세대가 된다 (판독 HIGH-2). store 를 이 모듈에서 import 하지 않는다 (청크 분리 —
   * 실측 Builder +278 · Preview +411 B).
   */
  collectContent(): ProjectContentV2 | null;
}

const links = new Map<string, DirectoryLink>();

/** 열린 연결 프로젝트 표시 (shared) — `granted` 는 잠금을 실제로 잡은 뒤 풀린다 (비우기와 순서 보장) */
function holdProjectOpenLock(projectId: string): {
  granted: Promise<void>;
  release: () => void;
} {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) return { granted: Promise.resolve(), release: () => {} };
  let release = () => {};
  let markGranted = () => {};
  const granted = new Promise<void>((resolve) => (markGranted = resolve));
  const held = new Promise<void>((resolve) => (release = resolve));
  void locks
    .request(
      `${PROJECT_OPEN_LOCK_PREFIX}${projectId}`,
      { mode: "shared" },
      () => {
        markGranted();
        return held;
      },
    )
    .catch(() => markGranted());
  return { granted, release };
}

class DirectoryLink {
  state: DirectoryLinkState;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing = false;
  private dirty = false;
  /** 이 탭이 마지막으로 저장한 문서 head revision — 도장이 이 탭의 저장인지 확인한다 */
  private persistedRevision: string | null = null;
  private readonly onPersisted = (event: Event) => {
    const detail = (
      event as CustomEvent<{ projectId?: string; revision?: string }>
    ).detail;
    if (!detail?.projectId || detail.projectId === this.record.projectId) {
      if (detail?.revision) this.persistedRevision = detail.revision;
      this.schedule();
    }
  };
  /** 급감 가드가 저장을 막았다 — DB 에 보호된 문서가 메모리와 다르다. 다음 성공 저장까지 도장 금지 */
  private readonly onPersistBlocked = (event: Event) => {
    const detail = (event as CustomEvent<{ projectId?: string }>).detail;
    if (!detail?.projectId || detail.projectId === this.record.projectId)
      this.persistedRevision = null;
  };

  constructor(
    private record: LinkRecord,
    private deps: DirectoryLinkDeps,
    private releaseOpenLock: () => void = holdProjectOpenLock(record.projectId)
      .release,
  ) {
    this.state = {
      projectId: record.projectId,
      status: record.clearedAt ? "cleared" : "idle",
      directoryName: record.handle.name,
      lastRevision: record.lastRevision,
    };
    window.addEventListener(DOCUMENT_PERSISTED_EVENT, this.onPersisted);
    window.addEventListener(
      "composition:custom-fonts-updated",
      this.onPersisted,
    );
    window.addEventListener(PERSIST_BLOCKED_EVENT, this.onPersistBlocked);
  }

  dispose(): void {
    this.releaseOpenLock();
    if (this.timer) clearTimeout(this.timer);
    window.removeEventListener(DOCUMENT_PERSISTED_EVENT, this.onPersisted);
    window.removeEventListener(
      "composition:custom-fonts-updated",
      this.onPersisted,
    );
    window.removeEventListener(PERSIST_BLOCKED_EVENT, this.onPersistBlocked);
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
      this.state.status === "needs-permission" ||
      this.state.status === "cleared"
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
      this.publish({ status: "idle", permissionDenied: false });
      await this.write();
    } else {
      // denied 와 창 닫기 (prompt) 를 같이 다룬다 — 어느 쪽이든 폴더 쓰기는 멈춘 상태다.
      this.publish({ status: "needs-permission", permissionDenied: true });
    }
    return granted;
  }

  /** 세대 쓰기 — force 면 충돌을 무시하고 덮어쓴다 (사용자 선택) */
  async write(force = false): Promise<void> {
    if (this.writing) {
      this.dirty = true;
      return;
    }
    // 비운 프로젝트 — 지금 문서는 폴더 내용이 아니다 (빈 문서로 폴더를 덮지 않는다). 다른 탭의 비우기가
    //   이 탭이 연 뒤에 표식을 남겼을 수 있어 기록을 다시 읽는다.
    const stored = await linksTx<LinkRecord | undefined>("readonly", (store) =>
      store.get(this.record.projectId),
    ).catch(() => undefined);
    if (stored?.clearedAt)
      this.record = { ...this.record, clearedAt: stored.clearedAt };
    if (this.record.clearedAt) {
      this.publish({ status: "cleared" });
      return;
    }
    if (!(await this.hasPermission())) {
      this.publish({ status: "needs-permission" });
      return;
    }
    const projectId = this.record.projectId;
    const stampBefore = await readProjectLocalStamp(projectId).catch(
      () => null,
    );
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
      // 도장은 "IndexedDB 문서 ⊆ 이번 세대" 가 확인될 때만 남긴다 — 쓰는 동안 DB 가 바뀌지 않았고, DB
      //   문서가 이 탭이 (가드에 막히지 않고) 마지막으로 저장한 것이며 (메모리 = 그 뒤 상태), 그동안 이
      //   프로젝트가 계속 활성이었을 때. 데이터 행 (collections · API · 변수) 은 export 투영이 필드를
      //   버려 폴더에 다 담기지 않는다 — 비우기가 행이 있는 프로젝트를 건너뛴다 (`hasProjectDataRows`).
      const stampAfter = await readProjectLocalStamp(projectId).catch(
        () => null,
      );
      const verified =
        sameProjectLocalStamp(stampBefore, stampAfter) &&
        this.persistedRevision !== null &&
        stampBefore!.documentRevision === this.persistedRevision &&
        this.deps.collectContent() !== null;
      this.record = {
        ...this.record,
        lastRevision: generation.manifest.revision,
        lastModified: (await target.lastModified?.("manifest.json")) ?? null,
        syncedStamp: verified ? stampBefore : null,
        syncedAt: new Date().toISOString(),
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

  /**
   * 폴더의 현재 세대를 읽어 자산을 저장소에 넣고 envelope 로 (충돌 해소 · 비운 프로젝트 복원). 비운
   * 프로젝트는 `clearedAt` 을 여기서 풀지 않는다 — 적용이 성공한 뒤 `finishRestore` 가 푼다 (적용이
   * 실패하면 기본 문서로 폴더를 덮지 않게 cleared 유지).
   */
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
      syncedStamp: null,
    };
    await linksTx("readwrite", (store) => store.put(this.record));
    if (!this.record.clearedAt)
      this.publish({ status: "synced", lastRevision: read.manifest.revision });
    return read;
  }

  /** 비운 프로젝트 복원 적용 성공 뒤 — 표식을 풀고 평소처럼 쓴다 */
  async finishRestore(): Promise<void> {
    this.record = { ...this.record, clearedAt: null };
    await linksTx("readwrite", (store) => store.put(this.record));
    this.publish({ status: "synced", lastRevision: this.record.lastRevision });
  }

  /** 복원 적용 실패 — cleared 유지 */
  failRestore(error: unknown): void {
    this.publish({
      status: "cleared",
      error: error instanceof Error ? error.message : String(error),
    });
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
  // 열림 잠금을 먼저 잡는다 — 다른 탭의 비우기가 도는 중이면 끝난 뒤의 기록 (clearedAt) 을 읽는다
  links.get(projectId)?.dispose();
  links.delete(projectId);
  const lock = holdProjectOpenLock(projectId);
  await lock.granted;
  localStorage.setItem(sentinel, "1");
  const stored = await linksTx<LinkRecord | undefined>("readonly", (store) =>
    store.get(projectId),
  ).finally(() => localStorage.removeItem(sentinel));
  if (!stored) {
    lock.release();
    localStorage.removeItem(directoryLinkFlagKey(projectId));
    return null;
  }
  let record: LinkRecord = {
    ...stored,
    lastOpenedAt: new Date().toISOString(),
  };
  // 표식만 남고 삭제가 일어나지 않은 경우 (표식 직후 중단) — DB 가 기록한 도장 그대로면 표식을 푼다
  if (record.clearedAt) {
    const stamp = await readProjectLocalStamp(projectId).catch(() => null);
    if (
      stamp?.documentRevision &&
      sameProjectLocalStamp(stamp, record.syncedStamp)
    )
      record = { ...record, clearedAt: null };
  }
  await linksTx("readwrite", (store) => store.put(record)).catch(() => {});
  const link = new DirectoryLink(record, deps, lock.release);
  links.set(projectId, link);
  if (record.clearedAt) {
    // 비운 프로젝트 — 사용자가 "폴더에서 불러오기" 를 누를 때까지 쓰지 않는다
  } else if (await link.hasPermission()) link.schedule();
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
  "permission" | "open" | "overwrite" | "restore" | "disconnect";

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
  // 비운 프로젝트 — 권한 (사용자 클릭 안) → 폴더 세대 읽기 → 적용
  if (action === "restore") {
    if (!(await link.hasPermission()) && !(await link.requestPermission()))
      return;
  }
  if (action === "open" || action === "restore") {
    const cleared = link.state.status === "cleared";
    try {
      const read = await link.readFromDirectory();
      await applyImported({
        version: read.manifest.formatVersion,
        exportedAt: read.manifest.savedAt,
        ...read.content,
      });
      if (cleared) await link.finishRestore();
    } catch (error) {
      if (cleared) link.failRestore(error);
      else throw error;
    }
  }
}

// ============================================
// 비우기 — 오래 닫힌 연결 프로젝트 (Decision 4)
// ============================================

export type DirectoryEvictionResult =
  | "cleared"
  | "recent"
  | "unsynced"
  | "open"
  | "no-permission"
  | "folder-changed"
  | "folder-unreadable"
  | "has-data"
  | "changed";

export interface DirectoryEvictionOptions {
  now?: number;
  olderThanMs?: number;
  /** 이 탭에서 열린 프로젝트 — 잠금과 별개로 제외 */
  openProjectId?: string | null;
  /** 테스트 주입 — 기본은 Web Locks (열린 탭이 shared 로 잡은 `PROJECT_OPEN_LOCK_PREFIX`) */
  withClosedProject?: (
    projectId: string,
    run: () => Promise<DirectoryEvictionResult>,
  ) => Promise<DirectoryEvictionResult>;
  /** 테스트 주입 — 기본은 핸들의 FSA 대상 · 권한 조회 */
  targetFor?: (record: LinkRecord) => V2DirectoryTarget;
  canRead?: (record: LinkRecord) => Promise<boolean>;
}

async function defaultWithClosedProject(
  projectId: string,
  run: () => Promise<DirectoryEvictionResult>,
): Promise<DirectoryEvictionResult> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) return "open"; // 열림 여부를 확인할 수 없으면 비우지 않는다
  return locks.request(
    `${PROJECT_OPEN_LOCK_PREFIX}${projectId}`,
    { mode: "exclusive", ifAvailable: true },
    async (lock) => (lock ? run() : "open"),
  );
}

async function defaultCanRead(record: LinkRecord): Promise<boolean> {
  const handle = record.handle as PermissionHandle & {
    queryPermission?(descriptor: { mode: "read" }): Promise<PermissionState>;
  };
  if (!handle.queryPermission) return false;
  // 권한 창은 띄우지 않는다 — 이미 허용된 (브라우저가 기억하는) 폴더만 확인할 수 있다
  return (await handle.queryPermission({ mode: "read" })) === "granted";
}

/**
 * 오래 닫힌 연결 프로젝트의 IndexedDB 내용을 비운다. 조건 (전부):
 * 1. 마지막으로 열거나 폴더에 쓴 뒤 `olderThanMs` (기본 30일) 경과 · 이미 비우지 않음
 * 2. 마지막 폴더 세대가 IndexedDB 내용을 다 담는다 (도장 기록 있음 · 지금 도장과 같음)
 * 3. 어느 탭에서도 열려 있지 않다 (Web Locks)
 * 4. 폴더 읽기 권한이 이미 있고, 폴더의 현재 세대가 기록한 세대와 같으며 part · 자산 해시까지 읽힌다
 * 확인과 삭제는 같은 트랜잭션에서 도장을 다시 대조한다 (`clearProjectLocalContent`).
 */
export async function evictStaleDirectoryProjects(
  options: DirectoryEvictionOptions = {},
): Promise<{ projectId: string; result: DirectoryEvictionResult }[]> {
  const now = options.now ?? Date.now();
  const olderThan = options.olderThanMs ?? PROJECT_EVICT_AFTER_MS;
  const withClosed = options.withClosedProject ?? defaultWithClosedProject;
  const targetFor =
    options.targetFor ?? ((record) => fsaDirectoryTarget(record.handle));
  const canRead = options.canRead ?? defaultCanRead;
  const records = await linksTx<LinkRecord[]>("readonly", (store) =>
    store.getAll(),
  );
  const results: { projectId: string; result: DirectoryEvictionResult }[] = [];
  for (const record of records) {
    const { projectId } = record;
    if (record.clearedAt) continue;
    if (projectId === options.openProjectId || links.has(projectId)) continue;
    const lastTouched = Math.max(
      Date.parse(record.lastOpenedAt ?? "") || 0,
      Date.parse(record.syncedAt ?? "") || 0,
      Date.parse(record.linkedAt) || 0,
    );
    if (now - lastTouched < olderThan) {
      results.push({ projectId, result: "recent" });
      continue;
    }
    const stamp = record.syncedStamp;
    if (!stamp || record.lastRevision === null) {
      results.push({ projectId, result: "unsynced" });
      continue;
    }
    // collections · API · 변수 행은 export 투영이 필드를 버려 폴더에 다 담기지 않는다 — 비우지 않는다
    if (hasProjectDataRows(stamp)) {
      results.push({ projectId, result: "has-data" });
      continue;
    }
    const result = await withClosed(projectId, async () => {
      if (!(await canRead(record).catch(() => false))) return "no-permission";
      const target = targetFor(record);
      const modified = (await target.lastModified?.("manifest.json")) ?? null;
      if (
        (await readManifestRevision(target)) !== record.lastRevision ||
        (record.lastModified !== null && modified !== record.lastModified)
      )
        return "folder-changed";
      try {
        const read = await readV2Generation(directoryV2Source(target));
        if (read.recovered || read.manifest.revision !== record.lastRevision)
          return "folder-unreadable";
      } catch {
        return "folder-unreadable";
      }
      if (!sameProjectLocalStamp(await readProjectLocalStamp(projectId), stamp))
        return "changed";
      // 비운다는 표식을 먼저 — 삭제 직후 중단돼도 열 때 빈 문서로 폴더를 덮지 않는다. 시작 뒤 기록이
      //   바뀌었으면 (누가 열었거나 썼다) 표식하지 않는다 (같은 트랜잭션의 비교 후 쓰기).
      const marked = await markClearedIfUnchanged(
        record,
        new Date(now).toISOString(),
      );
      if (!marked) return "open";
      const cleared = await clearProjectLocalContent(projectId, stamp).catch(
        () => "unavailable" as const,
      );
      if (cleared === "cleared") return "cleared";
      // 표식은 DB 에 문서가 남아 있을 때만 되돌린다 (이미 비워졌으면 표식이 폴더 덮어쓰기를 막는다)
      const remaining = await readProjectLocalStamp(projectId).catch(
        () => null,
      );
      if (remaining?.documentRevision)
        await linksTx("readwrite", (store) => store.put(record));
      return "changed";
    });
    results.push({ projectId, result });
  }
  return results;
}

/** 자산 GC 앞 — 연결 표식이 있을 때만 연결 DB 를 연다 (연결을 쓰지 않는 사용자는 비용 0) */
export async function evictStaleDirectoryProjectsIfLinked() {
  const linked = Object.keys(localStorage).some(
    (key) =>
      key.startsWith("composition.dir-link.") &&
      !key.startsWith("composition.dir-link.resuming.") &&
      !key.startsWith("composition.dir-link.evict") &&
      localStorage.getItem(key) === "1",
  );
  if (!linked) return [];
  // crash sentinel (복원과 같은 이유) — 연결 기록을 읽는 동안 브라우저가 죽은 적이 있으면 다시 돌지
  //   않는다. 값 = 시작 시각: 최근이면 다른 탭이 도는 중 (이번만 건너뜀), 오래됐으면 끝나지 못한 실행.
  const sentinel = "composition.dir-link.evicting";
  const disabled = "composition.dir-link.evict-disabled";
  if (localStorage.getItem(disabled)) return [];
  const started = Number(localStorage.getItem(sentinel) ?? 0);
  if (started) {
    if (Date.now() - started < 5 * 60 * 1000) return [];
    localStorage.removeItem(sentinel);
    localStorage.setItem(disabled, "1");
    return [];
  }
  localStorage.setItem(sentinel, String(Date.now()));
  // 탭을 닫는 것은 "끝나지 못한 실행" 이 아니다 — 닫힐 때 표식을 지운다 (브라우저 종료만 남긴다)
  const clearSentinel = () => localStorage.removeItem(sentinel);
  globalThis.addEventListener?.("pagehide", clearSentinel);
  const results = await evictStaleDirectoryProjects().finally(() => {
    globalThis.removeEventListener?.("pagehide", clearSentinel);
    clearSentinel();
  });
  const cleared = results.filter((entry) => entry.result === "cleared");
  if (cleared.length > 0) console.info("[directory-link] 비움", cleared);
  return results;
}

async function markClearedIfUnchanged(
  record: LinkRecord,
  clearedAt: string,
): Promise<boolean> {
  const db = await openLinksDb();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(LINKS_STORE, "readwrite");
    const store = tx.objectStore(LINKS_STORE);
    let marked = false;
    const request = store.get(record.projectId);
    request.onsuccess = () => {
      const current = request.result as LinkRecord | undefined;
      if (
        current &&
        !current.clearedAt &&
        (current.lastOpenedAt ?? null) === (record.lastOpenedAt ?? null) &&
        (current.syncedAt ?? null) === (record.syncedAt ?? null) &&
        current.lastRevision === record.lastRevision
      ) {
        store.put({ ...current, clearedAt });
        marked = true;
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(marked);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
