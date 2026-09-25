import { useEffect, useSyncExternalStore } from "react";
import {
  isAssetRef,
  resolveAssetUrl,
  resolveAssetUrlAsync,
  subscribeAssetUrls,
} from "@composition/shared";

/**
 * 패널 미리보기 (image fill 편집기 · fill swatch) 용 — `asset:` 참조를 준비하고 준비되면
 * 다시 그린다 (ADR-235). 비참조 값은 그대로, 준비 전 참조는 `null`.
 */
export function useResolvedAssetUrl(
  url: string | undefined | null,
): string | null {
  const resolved = useSyncExternalStore(subscribeAssetUrls, () =>
    resolveAssetUrl(url),
  );
  useEffect(() => {
    if (!isAssetRef(url) || resolved) return;
    void resolveAssetUrlAsync(url);
  }, [url, resolved]);
  return resolved;
}
