/**
 * 페이지 frame 크기 — 페이지 body 가 소유한 크기 (Styles 패널 Size 의 width/height) 가 있으면
 * 그것, 없으면 breakpoint 의 pageWidth/pageHeight.
 *
 * 페이지 테두리 (`renderFrameAreaBorder` 의 Page Borders) · body 선택 outline · 빈 페이지 영역
 * 히트 · 가이드 범위가 전부 이 하나를 읽는다 — body 높이를 1600 으로 바꿔도 테두리가 1080 에
 * 남아 "실제 상자와 다른 구분선" 이 보이던 결함 (2026-09-22 사용자 보고). `%` 는 breakpoint
 * 크기 기준, 그 밖의 값 (auto · calc · fit-content …) 은 breakpoint 크기로 둔다 — 레이아웃
 * 결과가 아니라 저작 값만 읽으므로 구조 스냅샷 (동기) 에서 계산할 수 있다.
 */

export interface PageFrameSize {
  width: number;
  height: number;
}

type StyleLike = Record<string, unknown> | null | undefined;

function resolveAuthoredLength(
  value: unknown,
  pageExtent: number,
): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const px = /^(\d+(?:\.\d+)?)px$/.exec(trimmed);
  if (px) {
    const n = Number(px[1]);
    return n > 0 ? n : null;
  }
  const pct = /^(\d+(?:\.\d+)?)%$/.exec(trimmed);
  if (pct) {
    const n = Number(pct[1]);
    return n > 0 ? (pageExtent * n) / 100 : null;
  }
  const bare = /^(\d+(?:\.\d+)?)$/.exec(trimmed);
  if (bare) {
    const n = Number(bare[1]);
    return n > 0 ? n : null;
  }
  return null;
}

export function resolvePageFrameSize(
  bodyStyle: StyleLike,
  pageWidth: number,
  pageHeight: number,
): PageFrameSize {
  const style = bodyStyle && typeof bodyStyle === "object" ? bodyStyle : null;
  return {
    width: resolveAuthoredLength(style?.width, pageWidth) ?? pageWidth,
    height: resolveAuthoredLength(style?.height, pageHeight) ?? pageHeight,
  };
}

interface BodyLookupNode {
  type: string;
  props?: { style?: unknown } | null;
  deleted?: boolean;
}

/** 페이지 요소 집합에서 body 를 찾아 frame 크기를 준다 (store `pageIndex` + `elementsMap` 모양). */
export function readPageFrameSize(
  pageId: string,
  elementsByPage: ReadonlyMap<string, ReadonlySet<string>> | undefined,
  elementsMap: ReadonlyMap<string, BodyLookupNode> | undefined,
  pageWidth: number,
  pageHeight: number,
): PageFrameSize {
  const ids = elementsByPage?.get(pageId);
  if (ids && elementsMap) {
    for (const id of ids) {
      const node = elementsMap.get(id);
      if (node && !node.deleted && node.type.toLowerCase() === "body") {
        return resolvePageFrameSize(
          node.props?.style as StyleLike,
          pageWidth,
          pageHeight,
        );
      }
    }
  }
  return { width: pageWidth, height: pageHeight };
}
