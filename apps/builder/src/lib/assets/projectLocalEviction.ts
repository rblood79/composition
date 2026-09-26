/**
 * ADR-235 Decision 4 후속 — 오래 닫힌 폴더 연결 프로젝트의 IndexedDB 내용 비우기 (사용자 판정
 * 2026-09-26 "삭제해도 된다").
 *
 * 연결 프로젝트는 폴더가 원본이고 IndexedDB 는 작업본이다. 비우기는 "폴더에 이미 다 있다" 가 확인될
 * 때만 한다 — 판정은 호출부 (`projectDirectoryLink.evictStaleDirectoryProjects`) 가 하고, 이 모듈은
 * 두 가지만 맡는다:
 *
 * - `readProjectLocalStamp` — 이 프로젝트의 IndexedDB 내용 도장 (문서 head revision + collections ·
 *   API · 변수 행 해시). 폴더 세대를 쓰기 직전에 읽어 연결 기록에 남긴다.
 * - `clearProjectLocalContent` — 같은 readwrite 트랜잭션 안에서 도장을 다시 읽어 기록과 같을 때만
 *   프로젝트 행을 지운다 (마지막 폴더 저장 뒤 DB 가 바뀌었으면 아무것도 지우지 않는다). `projects`
 *   행 (이름 · 목록 표시용 요약) 은 남긴다. 자산 바이트는 root 가 사라진 뒤 GC 가 회수한다.
 *
 * lazy 전용 · barrel 값 import 금지 (HC2 — `lazyBarrelImport.static.test.ts`).
 */
import { openAssetDb, requestResult, transactionDone } from "./assetDb";

/** 마지막으로 열거나 폴더에 쓴 뒤 이 기간이 지나면 비우기 대상 */
export const PROJECT_EVICT_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export interface ProjectLocalStamp {
  /** `document_heads.revision` (구버전 단일 row 면 그 `updated_at`), 문서 없음 = null */
  documentRevision: string | null;
  /** collections · api_endpoints · variables 행 해시 (id 순) */
  dataStamp: string;
}

const HEADS = "document_heads";
const LEGACY_DOCUMENTS = "documents";
const PARTS = "document_parts";
const DATA_STAMP_STORES = ["collections", "api_endpoints", "variables"];
/** project_id 인덱스로 지우는 store — events · actions 는 문서 root 의 mirror, runtime 은 캐시 */
const INDEXED_STORES = [
  PARTS,
  "documents_backup",
  ...DATA_STAMP_STORES,
  "collection_runtime",
  "events",
  "actions",
];

const HISTORY_DB = "composition-history";
const HISTORY_ENTRIES = "history-entries";
const HISTORY_META = "page-meta";
const HISTORY_SNAPSHOTS = "snapshots";

/** 동기 문자열 해시 (cyrb53) — 트랜잭션 안에서 await 없이 도장을 다시 계산한다 */
function hashString(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function stampRows(groups: Record<string, unknown>[][]): string {
  return groups
    .map((rows) => {
      const sorted = [...rows].sort((a, b) =>
        String(a.id).localeCompare(String(b.id)),
      );
      return `${rows.length}:${hashString(JSON.stringify(sorted))}`;
    })
    .join("|");
}

function existing(db: IDBDatabase, names: string[]): string[] {
  return names.filter((name) => db.objectStoreNames.contains(name));
}

function projectRows(
  tx: IDBTransaction,
  store: string,
  projectId: string,
): Promise<Record<string, unknown>[]> {
  const os = tx.objectStore(store);
  if (!os.indexNames.contains("project_id")) return Promise.resolve([]);
  return requestResult(
    os.index("project_id").getAll(projectId) as IDBRequest<
      Record<string, unknown>[]
    >,
  );
}

async function readStampIn(
  tx: IDBTransaction,
  db: IDBDatabase,
  projectId: string,
): Promise<ProjectLocalStamp> {
  const head = db.objectStoreNames.contains(HEADS)
    ? await requestResult(
        tx.objectStore(HEADS).get(projectId) as IDBRequest<
          { revision?: string } | undefined
        >,
      )
    : undefined;
  let documentRevision = head?.revision ?? null;
  if (!documentRevision && db.objectStoreNames.contains(LEGACY_DOCUMENTS)) {
    const legacy = await requestResult(
      tx.objectStore(LEGACY_DOCUMENTS).get(projectId) as IDBRequest<
        { updated_at?: string } | undefined
      >,
    );
    documentRevision = legacy ? `legacy:${legacy.updated_at ?? ""}` : null;
  }
  const groups: Record<string, unknown>[][] = [];
  for (const store of DATA_STAMP_STORES) {
    groups.push(
      db.objectStoreNames.contains(store)
        ? await projectRows(tx, store, projectId)
        : [],
    );
  }
  return { documentRevision, dataStamp: stampRows(groups) };
}

export function sameProjectLocalStamp(
  a: ProjectLocalStamp | null | undefined,
  b: ProjectLocalStamp | null | undefined,
): boolean {
  return (
    !!a &&
    !!b &&
    a.documentRevision === b.documentRevision &&
    a.dataStamp === b.dataStamp
  );
}

/** collections · api_endpoints · variables 에 이 프로젝트의 행이 있는가 (도장의 행 수) */
export function hasProjectDataRows(stamp: ProjectLocalStamp): boolean {
  return stamp.dataStamp
    .split("|")
    .some((group) => Number(group.split(":")[0]) > 0);
}

/** 이 프로젝트의 IndexedDB 내용 도장. DB 가 없으면 null */
export async function readProjectLocalStamp(
  projectId: string,
): Promise<ProjectLocalStamp | null> {
  const db = await openAssetDb();
  if (!db) return null;
  const stores = existing(db, [HEADS, LEGACY_DOCUMENTS, ...DATA_STAMP_STORES]);
  const tx = db.transaction(stores, "readonly");
  const stamp = await readStampIn(tx, db, projectId);
  await transactionDone(tx);
  return stamp;
}

/** 문서 node id (history entry 는 pageId 로만 찾을 수 있다 — node id 전체가 page id 를 포함) */
function collectNodeIds(value: unknown, into: Set<string>): void {
  if (!value || typeof value !== "object") return;
  const node = value as { id?: unknown; children?: unknown };
  if (typeof node.id === "string") into.add(node.id);
  if (Array.isArray(node.children))
    for (const child of node.children) collectNodeIds(child, into);
}

export type ProjectLocalClearResult = "cleared" | "changed" | "unavailable";

/**
 * 도장이 `expected` 와 같을 때만 프로젝트 내용을 지운다 — 확인과 삭제가 한 트랜잭션이라 그 사이에
 * 끼어든 저장은 트랜잭션 순서상 앞이면 "changed", 뒤면 삭제 뒤의 새 행이 된다.
 */
export async function clearProjectLocalContent(
  projectId: string,
  expected: ProjectLocalStamp,
): Promise<ProjectLocalClearResult> {
  const db = await openAssetDb();
  if (!db) return "unavailable";
  const stores = existing(db, [HEADS, LEGACY_DOCUMENTS, ...INDEXED_STORES]);
  const tx = db.transaction(stores, "readwrite");
  const done = transactionDone(tx);
  const current = await readStampIn(tx, db, projectId);
  if (!sameProjectLocalStamp(current, expected)) {
    tx.abort();
    await done.catch(() => {});
    return "changed";
  }
  const nodeIds = new Set<string>();
  if (stores.includes(PARTS)) {
    for (const row of await projectRows(tx, PARTS, projectId)) {
      const key = String(row.key ?? "");
      if (key.startsWith("node:")) nodeIds.add(key.slice(5));
    }
  }
  if (stores.includes(LEGACY_DOCUMENTS)) {
    const legacy = await requestResult(
      tx.objectStore(LEGACY_DOCUMENTS).get(projectId) as IDBRequest<
        { document?: unknown } | undefined
      >,
    );
    collectNodeIds(legacy?.document, nodeIds);
    tx.objectStore(LEGACY_DOCUMENTS).delete(projectId);
  }
  if (stores.includes(HEADS)) tx.objectStore(HEADS).delete(projectId);
  for (const store of INDEXED_STORES) {
    if (!stores.includes(store)) continue;
    const os = tx.objectStore(store);
    if (!os.indexNames.contains("project_id")) continue;
    const keys = await requestResult(
      os.index("project_id").getAllKeys(projectId),
    );
    for (const key of keys) os.delete(key);
  }
  await done;
  await clearProjectHistory(projectId, nodeIds).catch(() => {});
  return "cleared";
}

function openExistingDb(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(name);
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

/** history (별도 DB) — 스냅샷은 projectId, entry · page meta 는 pageId 로. 실패해도 root 로 남을 뿐 */
async function clearProjectHistory(
  projectId: string,
  pageIds: Set<string>,
): Promise<void> {
  const db = await openExistingDb(HISTORY_DB);
  if (!db) return;
  try {
    const stores = existing(db, [
      HISTORY_ENTRIES,
      HISTORY_META,
      HISTORY_SNAPSHOTS,
    ]);
    if (stores.length === 0) return;
    const tx = db.transaction(stores, "readwrite");
    const done = transactionDone(tx);
    if (stores.includes(HISTORY_SNAPSHOTS)) {
      const os = tx.objectStore(HISTORY_SNAPSHOTS);
      if (os.indexNames.contains("projectId")) {
        const keys = await requestResult(
          os.index("projectId").getAllKeys(projectId),
        );
        for (const key of keys) os.delete(key);
      }
    }
    for (const pageId of pageIds) {
      if (stores.includes(HISTORY_META))
        tx.objectStore(HISTORY_META).delete(pageId);
      if (!stores.includes(HISTORY_ENTRIES)) continue;
      const os = tx.objectStore(HISTORY_ENTRIES);
      if (!os.indexNames.contains("pageId")) continue;
      const keys = await requestResult(os.index("pageId").getAllKeys(pageId));
      for (const key of keys) os.delete(key);
    }
    await done;
  } finally {
    db.close();
  }
}
