/**
 * ADR-235 Phase 5 — 브라우저 저장소 보호 (Decision 5).
 *
 * - 첫 저장 시 `navigator.storage.persist()` 를 한 번 요청하고 결과 (허용 / 거부 / 미지원) 와
 *   `estimate()` 사용량을 상태로 둔다. 거부면 UI 가 "브라우저가 이 프로젝트를 지울 수 있음" 을
 *   상시 표시한다.
 * - 원본 쓰기의 `QuotaExceededError` 는 캐시를 비우고 1회 재시도, 그래도 실패하면 이벤트로 알린다
 *   (UI 가 내보내기를 권유).
 * - Storage Buckets 지원 브라우저는 캐시를 `persisted: false` bucket 에 두어 브라우저가 원본과 따로
 *   비우게 한다 (`openCacheDatabase`). 미지원이면 원본 DB 에 두되 용량 상한 · 사용률 기준 선제 정리.
 */

export type PersistState = "unknown" | "granted" | "denied" | "unsupported";

export interface StorageStatus {
  persist: PersistState;
  usage: number | null;
  quota: number | null;
  /** Storage Buckets 로 캐시를 원본과 분리했는가 */
  cacheSeparated: boolean;
}

export const STORAGE_STATUS_EVENT = "composition:storage-status";
export const STORAGE_QUOTA_EVENT = "composition:storage-quota-exceeded";

/** 캐시 (collection_runtime) 용량 상한 — 미지원 브라우저의 원본 DB 공유 대비 */
export const CACHE_BYTES_LIMIT = 25 * 1024 * 1024;
/** 사용률이 이 이상이면 캐시를 먼저 비운다 */
export const PREEMPTIVE_CLEANUP_RATIO = 0.8;

let status: StorageStatus = {
  persist: "unknown",
  usage: null,
  quota: null,
  cacheSeparated: false,
};
let persistRequested = false;

export function getStorageStatus(): StorageStatus {
  return status;
}

function publish(next: Partial<StorageStatus>): void {
  status = { ...status, ...next };
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(STORAGE_STATUS_EVENT, { detail: status }),
    );
  }
}

export async function refreshStorageEstimate(): Promise<StorageStatus> {
  const storage = globalThis.navigator?.storage;
  if (storage?.estimate) {
    try {
      const { usage, quota } = await storage.estimate();
      publish({ usage: usage ?? null, quota: quota ?? null });
    } catch {
      /* 추정 실패는 표시만 비운다 */
    }
  }
  return status;
}

/** 첫 저장 시 1회 — 이미 persisted 면 요청하지 않는다 */
export async function requestPersistenceOnce(): Promise<StorageStatus> {
  if (persistRequested) return status;
  persistRequested = true;
  const storage = globalThis.navigator?.storage;
  if (!storage?.persist || !storage.persisted) {
    publish({ persist: "unsupported" });
    return refreshStorageEstimate();
  }
  try {
    const already = await storage.persisted();
    const granted = already || (await storage.persist());
    publish({ persist: granted ? "granted" : "denied" });
  } catch {
    publish({ persist: "denied" });
  }
  return refreshStorageEstimate();
}

export function isQuotaExceeded(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

/**
 * 원본 쓰기 — quota 초과면 `clearCaches` 뒤 1회 재시도, 그래도 실패하면 알림 이벤트 후 throw.
 */
export async function withQuotaRetry<T>(
  write: () => Promise<T>,
  clearCaches: () => Promise<void>,
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    if (!isQuotaExceeded(error)) throw error;
    await clearCaches().catch(() => {});
    try {
      return await write();
    } catch (retryError) {
      if (isQuotaExceeded(retryError) && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(STORAGE_QUOTA_EVENT));
      }
      throw retryError;
    }
  }
}

/** 사용률이 높으면 true — 호출부가 캐시를 먼저 비운다 */
export async function shouldPreemptivelyClearCaches(): Promise<boolean> {
  const { usage, quota } = await refreshStorageEstimate();
  return (
    usage !== null &&
    quota !== null &&
    quota > 0 &&
    usage / quota >= PREEMPTIVE_CLEANUP_RATIO
  );
}

// ============================================
// 캐시 DB — Storage Buckets (지원 시) 또는 원본 DB
// ============================================

export const CACHE_BUCKET = "composition-cache";
export const CACHE_DB = "composition-cache";
export const CACHE_RUNTIME_STORE = "collection_runtime";

interface StorageBucketLike {
  indexedDB: IDBFactory;
}
interface StorageBucketManagerLike {
  open(
    name: string,
    options?: { persisted?: boolean; durability?: string },
  ): Promise<StorageBucketLike>;
}

let bucketPromise: Promise<StorageBucketLike | null> | null = null;

function openCacheBucket(): Promise<StorageBucketLike | null> {
  if (bucketPromise) return bucketPromise;
  const buckets = (
    globalThis.navigator as Navigator & {
      storageBuckets?: StorageBucketManagerLike;
    }
  )?.storageBuckets;
  bucketPromise = buckets?.open
    ? buckets
        .open(CACHE_BUCKET, { persisted: false, durability: "relaxed" })
        .catch(() => null)
    : Promise.resolve(null);
  return bucketPromise;
}

/**
 * Storage Buckets 지원 시 `persisted: false` bucket 안의 캐시 DB 를 **이번 연산용으로** 연다
 * (호출자가 닫는다). 미지원이면 null — 호출부는 원본 DB 의 같은 store 를 쓴다.
 *
 * 연결을 오래 들고 있지 않는 이유: Chrome 153 실측 — bucket IndexedDB 연결을 유지하면 수 초
 * 유휴 뒤 그 연결의 트랜잭션이 complete · error 없이 멈춘다 (새 연결은 정상, close 이벤트 없음).
 */
export async function openCacheDatabase(): Promise<IDBDatabase | null> {
  const bucket = await openCacheBucket();
  if (!bucket) return null;
  return new Promise<IDBDatabase | null>((resolve) => {
    const request = bucket.indexedDB.open(CACHE_DB, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(CACHE_RUNTIME_STORE, {
        keyPath: "collectionId",
      });
      store.createIndex("project_id", "project_id", { unique: false });
    };
    request.onsuccess = () => {
      if (!status.cacheSeparated) publish({ cacheSeparated: true });
      resolve(request.result);
    };
    request.onerror = () => resolve(null);
  });
}
