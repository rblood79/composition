/**
 * 페이지 페인트 순서 — 활성 페이지 최상단 (2026-08-11)
 *
 * 페이지 간 z-order 는 산출물(publish/preview)에 반영되지 않는 순수 workspace
 * 표시 축이다. canonical 페이지 순서(패널 목록/문서 저장)는 불변으로 두고,
 * 겹침 표시와 포인터 판정만 "활성 페이지가 최상단" 으로 재배열한다.
 *
 * 소비자 3경로가 반드시 같은 순서를 공유해야 한다 — 한쪽만 바꾸면
 * "보이는데 클릭이 다른 페이지로 가는" 비대칭이 생긴다:
 *  1. 페인트: collectVisiblePageRoots → rootElementIds (배열 뒤 = 위에 그려짐)
 *  2. body 빈 영역 히트: findBodySelectionAtCanvasPoint (top-first 역순 순회)
 *  3. 요소 히트 tie-break: pickTopmostHitElementId 의 pagePaintRank
 */

export interface PageOrderLike {
  id: string;
}

/**
 * 문서 순서를 유지하되 활성 페이지만 마지막(=페인트 최상단)으로 이동한 배열을 반환.
 * activePageId 가 없거나 목록에 없으면 문서 순서 그대로.
 */
export function orderPagesForPaint<T extends PageOrderLike>(
  pages: readonly T[],
  activePageId: string | null | undefined,
): T[] {
  if (!activePageId) return [...pages];

  let active: T | null = null;
  const rest: T[] = [];
  for (const page of pages) {
    if (page.id === activePageId) {
      active = page;
    } else {
      rest.push(page);
    }
  }

  return active ? [...rest, active] : rest;
}

/**
 * pageId → 페인트 rank (높을수록 위에 그려짐). 요소 히트 tie-break 용.
 */
export function buildPagePaintRank(
  pages: readonly PageOrderLike[],
  activePageId: string | null | undefined,
): Map<string, number> {
  const rank = new Map<string, number>();
  const ordered = orderPagesForPaint(pages, activePageId);
  for (let i = 0; i < ordered.length; i++) {
    rank.set(ordered[i].id, i);
  }
  return rank;
}
