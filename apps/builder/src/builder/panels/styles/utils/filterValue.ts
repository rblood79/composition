/**
 * CSS `filter` 문자열 ↔ 패널 모델 (panel-ui 02 Effect · Filters).
 *
 * 패널은 blur 한 종만 편집한다 — Skia 는 blur (LayerBlurEffect) 외에 brightness/contrast/
 * saturate/hue-rotate/grayscale (ColorMatrix) 도 접붙이지만 시안은 blur 한 행이다. 다른
 * 함수가 저장돼 있으면 (import/paste) 순서·원문 그대로 보존하고 blur 만 갈아끼운다.
 */

/** `name(...)` 함수 단위로 나눈다 — 인자 안의 괄호 (`drop-shadow(… rgb(…))`) 는 깊이로 넘긴다. */
function splitFilterFunctions(filter: string): string[] {
  const fns: string[] = [];
  const nameRe = /[a-z-]+\(/gi;
  let match: RegExpExecArray | null;
  while ((match = nameRe.exec(filter))) {
    let depth = 0;
    let end = -1;
    for (let i = match.index + match[0].length - 1; i < filter.length; i++) {
      if (filter[i] === "(") depth++;
      else if (filter[i] === ")" && --depth === 0) {
        end = i;
        break;
      }
    }
    if (end < 0) break;
    fns.push(filter.slice(match.index, end + 1));
    nameRe.lastIndex = end + 1;
  }
  return fns;
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
