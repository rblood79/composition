/**
 * ADR-235 실행 문맥 해석기 — IndexedDB `assets` 바이트 → `blob:` URL.
 *
 * builder 탭 (같은 탭의 `/publish/*` route 포함) · Preview iframe 이 각자 하나씩 설치한다.
 * 같은 origin 이라 IndexedDB 를 직접 읽는다 — 다른 탭의 `blob:` URL 은 그 탭 수명에
 * 묶여 쓰지 않는다 (G0 (c)).
 *
 * `blob:` URL 은 자산이 지워질 때 (`revoke`) 만 해제한다 — CSS `url()` · `<img>` 같은
 * 동기 consumer 는 해제 시점을 알리지 않으므로, 자산 수명에 묶는 것이 유일하게 안전한
 * 기준이다 (URL 1개당 메모리는 핸들뿐, 바이트는 Blob 이 공유).
 */
import {
  assetHashFromRef,
  assetRefFromHash,
  setAssetUrlResolver,
  type AssetRef,
  type AssetUrlResolver,
} from "@composition/shared";

export interface IndexedDbAssetUrlResolver extends AssetUrlResolver {
  /** writer 가 방금 저장한 바이트를 즉시 해석 가능하게 한다 (IndexedDB 왕복 없이). */
  register(ref: AssetRef, blob: Blob): string;
  /** 자산 삭제 시 URL 해제 */
  revoke(ref: AssetRef): void;
}

export function createIndexedDbAssetUrlResolver(): IndexedDbAssetUrlResolver {
  const urls = new Map<AssetRef, string>();
  const listeners = new Set<() => void>();
  const inflight = new Map<AssetRef, Promise<void>>();

  const notify = () => {
    for (const listener of [...listeners]) listener();
  };

  const load = async (refs: AssetRef[]): Promise<void> => {
    const { readAssetRecords } = await import("./assetDb");
    const records = await readAssetRecords(
      refs.map((ref) => assetHashFromRef(ref) as string),
    );
    let added = false;
    for (const [hash, record] of records) {
      const ref = assetRefFromHash(hash);
      if (urls.has(ref)) continue;
      urls.set(ref, URL.createObjectURL(record.blob));
      added = true;
    }
    if (added) notify();
  };

  return {
    resolveSync(ref) {
      return urls.get(ref) ?? null;
    },
    async ensure(refs) {
      const waits: Promise<void>[] = [];
      const missing: AssetRef[] = [];
      for (const ref of refs) {
        if (urls.has(ref)) continue;
        const pending = inflight.get(ref);
        if (pending) waits.push(pending);
        else if (assetHashFromRef(ref)) missing.push(ref);
      }
      if (missing.length > 0) {
        const pending = load(missing).catch((error) => {
          console.warn("[assets] 자산 읽기 실패", error);
        });
        for (const ref of missing) inflight.set(ref, pending);
        void pending.finally(() => {
          for (const ref of missing) {
            if (inflight.get(ref) === pending) inflight.delete(ref);
          }
        });
        waits.push(pending);
      }
      await Promise.all(waits);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    register(ref, blob) {
      const existing = urls.get(ref);
      if (existing) return existing;
      const url = URL.createObjectURL(blob);
      urls.set(ref, url);
      notify();
      return url;
    },
    revoke(ref) {
      const url = urls.get(ref);
      if (!url) return;
      urls.delete(ref);
      URL.revokeObjectURL(url);
    },
  };
}

let installed: IndexedDbAssetUrlResolver | null = null;

/** 실행 문맥당 1회. 이미 설치돼 있으면 그 해석기를 돌려준다. */
export function installIndexedDbAssetUrlResolver(): IndexedDbAssetUrlResolver {
  if (!installed) {
    installed = createIndexedDbAssetUrlResolver();
    setAssetUrlResolver(installed);
  }
  return installed;
}

export function getInstalledAssetUrlResolver(): IndexedDbAssetUrlResolver | null {
  return installed;
}
