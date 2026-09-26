import { useSyncExternalStore } from "react";
import { resolveAssetUrl, subscribeAssetUrls } from "@composition/shared";

/**
 * 패널 미리보기 (image fill 편집기 · fill swatch) 용 — `asset:` 참조를 해석하고 준비되면 다시
 * 그린다 (ADR-235). 준비 요청은 `resolveAssetUrl` 의 miss 가 한다. 비참조 값은 그대로,
 * 준비 전 참조는 `null`.
 */
export function useResolvedAssetUrl(
  url: string | undefined | null,
): string | null {
  return useSyncExternalStore(subscribeAssetUrls, () => resolveAssetUrl(url));
}
