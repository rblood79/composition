import type { ResumeRecord, ResumeStorage } from "../../types";

const PREFIX = "cu:";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * localStorage 재개 저장소 — 값은 `{u: url, e?: expires}` 만. 파일명·내용·크기 0 (§3-6).
 * 만료 지난 항목은 읽는 순간 지운다. 사설 모드 등 접근 실패는 조용히 null.
 */
export function createLocalStorageDriver(
  store: StorageLike | undefined = globalThis.localStorage,
): ResumeStorage {
  const key = (fp: string) => PREFIX + fp;
  return {
    get(fp) {
      try {
        const raw = store?.getItem(key(fp));
        if (!raw) return null;
        const v = JSON.parse(raw) as { u?: string; e?: number };
        if (!v.u || (v.e && Date.now() >= v.e)) {
          store?.removeItem(key(fp));
          return null;
        }
        return { url: v.u, expires: v.e };
      } catch {
        return null;
      }
    },
    set(fp, rec: ResumeRecord) {
      try {
        store?.setItem(key(fp), JSON.stringify({ u: rec.url, e: rec.expires }));
      } catch {
        /* quota / 사설 모드 — 재개 정보 없이 진행 */
      }
    },
    remove(fp) {
      try {
        store?.removeItem(key(fp));
      } catch {
        /* ignore */
      }
    },
  };
}

export function createMemoryStorage(): ResumeStorage {
  const map = new Map<string, ResumeRecord>();
  return {
    get: (fp) => map.get(fp) ?? null,
    set: (fp, rec) => void map.set(fp, rec),
    remove: (fp) => void map.delete(fp),
  };
}

/** 브라우저면 localStorage, 아니면 메모리 */
export function resolveStorage(): ResumeStorage {
  try {
    if (typeof localStorage !== "undefined" && localStorage) {
      return createLocalStorageDriver(localStorage);
    }
  } catch {
    /* 접근 자체가 throw 하는 환경 */
  }
  return createMemoryStorage();
}
