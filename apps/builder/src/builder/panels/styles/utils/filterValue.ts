/**
 * CSS `filter` 문자열 ↔ 패널 모델 (panel-ui 02 Effect · Filters).
 *
 * 패널은 blur 한 종만 편집한다 — Skia 는 blur (LayerBlurEffect) 외에 brightness/contrast/
 * saturate/hue-rotate/grayscale (ColorMatrix) 도 접붙이지만 시안은 blur 한 행이다. 다른
 * 함수가 저장돼 있으면 (import/paste) 순서·원문 그대로 보존하고 blur 만 갈아끼운다.
 */

const FILTER_FN_RE = /([a-z-]+)\(([^)]*)\)/gi;

function splitFilterFunctions(filter: string): string[] {
  return Array.from(filter.matchAll(FILTER_FN_RE), (m) => m[0]);
}

/** `blur(4px)` → 4. blur 가 없거나 "none" 이면 null. */
export function parseFilterBlurPx(filter: string | undefined): number | null {
  if (!filter || filter.trim() === "none") return null;
  for (const fn of splitFilterFunctions(filter)) {
    const match = fn.match(/^blur\(\s*(-?\d*\.?\d+)(px)?\s*\)$/i);
    if (match) {
      const px = Number(match[1]);
      return Number.isFinite(px) ? Math.max(0, px) : null;
    }
  }
  return null;
}

/**
 * blur 를 px 로 두거나 (null 이면 제거) 나머지 함수는 보존. 남는 함수가 없으면 "" (inline 키
 * 삭제 — "none" 을 기록하면 영구 dirty).
 */
export function setFilterBlurPx(
  filter: string | undefined,
  px: number | null,
): string {
  const others =
    filter && filter.trim() !== "none"
      ? splitFilterFunctions(filter).filter((fn) => !/^blur\(/i.test(fn))
      : [];
  const next = px === null ? others : [`blur(${Math.max(0, px)}px)`, ...others];
  return next.join(" ");
}
