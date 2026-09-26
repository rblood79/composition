/**
 * ADR-235 자산 store 접근 — 버전을 지정하지 않고 `composition` DB 를 연다.
 *
 * - 업그레이드 (DB_VERSION 23 store 생성) 는 builder adapter 만 한다. 이 모듈은 이미 있는
 *   store 를 읽고 쓰기만 하므로 Preview · publish 탭에서도 adapter 없이 쓸 수 있다.
 * - DB 가 없으면 만들지 않는다 (upgrade 트랜잭션 abort) — 빈 v1 DB 가 생기면 builder 의
 *   정상 업그레이드 경로를 망친다.
 * - store 가 없으면 (`assets` 미생성 = 구버전 DB) `null` — 호출자는 "미해석" 으로 처리한다.
 * - 다른 탭이 업그레이드하면 즉시 닫는다 (짧은 트랜잭션만 쓰므로 다음 호출이 다시 연다).
 */
import type {
  AssetGcRecord,
  AssetRecord,
  StoredAssetRecord,
} from "./assetSchema";
import { ASSET_DB_NAME, ASSET_GC_STORE, ASSETS_STORE } from "./assetSchema";

let dbPromise: Promise<IDBDatabase | null> | null = null;

export function openAssetDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  const pending = new Promise<IDBDatabase | null>((resolve) => {
    const request = indexedDB.open(ASSET_DB_NAME);
    request.onupgradeneeded = () => {
      // 버전 미지정 open 에서 upgrade 는 DB 가 없을 때뿐이다 — 만들지 않고 되돌린다.
      request.transaction?.abort();
    };
    // abort 로 인한 실패 (DB 없음) 포함 — 미해석으로 처리
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (
        !db.objectStoreNames.contains(ASSETS_STORE) ||
        !db.objectStoreNames.contains(ASSET_GC_STORE)
      ) {
        db.close();
        resolve(null);
        return;
      }
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
  });
  dbPromise = pending;
  // store 가 아직 없으면 (builder 업그레이드 전) 다음 호출에서 다시 연다.
  void pending.then((db) => {
    if (!db && dbPromise === pending) dbPromise = null;
  });
  return pending;
}

/** 테스트 · DB 삭제 전 정리용 */
export async function closeAssetDb(): Promise<void> {
  const current = dbPromise;
  dbPromise = null;
  const db = await current;
  db?.close();
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 성공 = request 성공이 아니라 transaction complete (breakdown §3.1-1) */
export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new DOMException("aborted", "AbortError"));
  });
}

export async function readAssetRecords(
  hashes: Iterable<string>,
): Promise<Map<string, AssetRecord>> {
  const result = new Map<string, AssetRecord>();
  const list = [...new Set(hashes)];
  if (list.length === 0) return result;
  const db = await openAssetDb();
  if (!db) return result;
  const tx = db.transaction(ASSETS_STORE, "readonly");
  const store = tx.objectStore(ASSETS_STORE);
  const records = await Promise.all(
    list.map((hash) =>
      requestResult(
        store.get(hash) as IDBRequest<StoredAssetRecord | undefined>,
      ),
    ),
  );
  records.forEach((record) => {
    const normalized = record ? toAssetRecord(record) : null;
    if (normalized) result.set(normalized.hash, normalized);
  });
  return result;
}

/** 저장 모양 → 읽은 모양 (ArrayBuffer → Blob, 옛 Blob 레코드는 그대로) */
export function toAssetRecord(record: StoredAssetRecord): AssetRecord | null {
  const blob =
    record.blob ??
    (record.data ? new Blob([record.data], { type: record.mime }) : null);
  if (!blob) return null;
  const { data: _data, ...rest } = record;
  return { ...rest, blob };
}

export async function readAllAssetGcRecords(): Promise<AssetGcRecord[]> {
  const db = await openAssetDb();
  if (!db) return [];
  const tx = db.transaction(ASSET_GC_STORE, "readonly");
  return requestResult(
    tx.objectStore(ASSET_GC_STORE).getAll() as IDBRequest<AssetGcRecord[]>,
  );
}
