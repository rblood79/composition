/**
 * ADR-235 Decision 4 후속 — 오래 닫힌 폴더 연결 프로젝트의 IndexedDB 내용 비우기 (사용자 판정
 * 2026-09-26 "삭제해도 된다").
 *
 * 연결 프로젝트는 폴더가 원본이고 IndexedDB 는 작업본이다. 비우기는 "폴더에 이미 다 있다" 가 확인될
 * 때만 한다 — 판정은 호출부 (`projectDirectoryLink.evictStaleDirectoryProjects`) 가 하고, 이 모듈은
 * 두 가지만 맡는다:
 *
 * - `readProjectLocalStamp` — 이 프로젝트의 IndexedDB 내용 도장 (collections · API · 변수 행 해시).
 *   폴더 세대를 쓰기 직전에 읽어 연결 기록에 남긴다.
 * - `clearProjectLocalContent` — 같은 readwrite 트랜잭션 안에서 도장을 다시 읽어 기록과 같을 때만
 *   프로젝트 행을 지운다 (마지막 폴더 저장 뒤 DB 가 바뀌었으면 아무것도 지우지 않는다). `projects`
 *   행 (이름 · 목록 표시용 요약) 은 남긴다. 자산 바이트는 root 가 사라진 뒤 GC 가 회수한다.
 *
 * ADR-248 이후 문서는 catalog DB (`CATALOG_DB_NAME`) 에 있고 이 도장은 그 문서를 담지 않는다 —
 * `documentRevision` 은 늘 null 이라 연결 모듈의 저장 확인이 성립하지 않아 비우기는 일어나지 않는다
 * (구 문서 store 를 읽던 때와 같은 동작). catalog 문서 대응은 별도 작업이다.
 *
 * lazy 전용 · barrel 값 import 금지 (HC2 — `lazyBarrelImport.static.test.ts`).
 */
import { openAssetDb, requestResult, transactionDone } from "./assetDb";

/** 마지막으로 열거나 폴더에 쓴 뒤 이 기간이 지나면 비우기 대상 */
export const PROJECT_EVICT_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export interface ProjectLocalStamp {
  /** 문서 revision — catalog 문서를 아직 담지 않아 늘 null (모듈 머리말) */
  documentRevision: string | null;
  /** collections · api_endpoints · variables 행 해시 (id 순) */
  dataStamp: string;
}

const DATA_STAMP_STORES = ["collections", "api_endpoints", "variables"];
/** project_id 인덱스로 지우는 store — runtime 은 캐시 */
const INDEXED_STORES = [...DATA_STAMP_STORES, "collection_runtime"];

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
  const groups: Record<string, unknown>[][] = [];
  for (const store of DATA_STAMP_STORES) {
    groups.push(
      db.objectStoreNames.contains(store)
        ? await projectRows(tx, store, projectId)
        : [],
    );
  }
  return { documentRevision: null, dataStamp: stampRows(groups) };
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
  const stores = existing(db, DATA_STAMP_STORES);
  const tx = db.transaction(stores, "readonly");
  const stamp = await readStampIn(tx, db, projectId);
  await transactionDone(tx);
  return stamp;
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
  const stores = existing(db, INDEXED_STORES);
  const tx = db.transaction(stores, "readwrite");
  const done = transactionDone(tx);
  const current = await readStampIn(tx, db, projectId);
  if (!sameProjectLocalStamp(current, expected)) {
    tx.abort();
    await done.catch(() => {});
    return "changed";
  }
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
  return "cleared";
}
