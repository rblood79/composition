import type { CSSProperties } from "react";

export const BODY_DOM_CLASS_NAME = "react-aria-Body";

const LEGACY_BODY_DOM_CLASSES = new Set([
  BODY_DOM_CLASS_NAME,
  "react-aria-body",
]);

const LEGACY_BODY_FONT_FAMILIES = new Set([
  `"Pretendard", "Inter Variable", system-ui, sans-serif`,
  `"Pretendard", "Inter Variable", monospace, system-ui, sans-serif`,
]);

export interface BodyDomPresentation {
  style: CSSProperties | undefined;
  fillsViewport: boolean;
}

/**
 * canonical `body` 노드의 DOM 투영을 정규화한다.
 *
 * D3 대칭(2026-07-15): canonical DOM 렌더 경로(builder Preview `CanonicalNodeRenderer`,
 * publish `ElementRenderer`)는 body 노드를 중첩 `<div>` 로 렌더하며 `element.props.style`
 * (height 無)만 얹어 content-fit 로 collapse 한다. 반면 Skia(builder canvas)는 layout map 의
 * body 높이(페이지 프레임/아트보드 높이)를 그대로 그린다 → body 박스가 비대칭.
 * 콘텐츠 좌표는 layout map 공유로 일치하나, body 배경/테두리·세로 중앙정렬·자식 height:100% 등
 * body 박스 높이에 의존하는 시각/레이아웃이 Builder ↔ DOM 사이에서 갈린다(대칭 위반).
 *
 * viewport 높이 fallback은 inline이 아니라 `data-body-viewport-fill` + generated Body CSS
 * (`&[data-body-viewport-fill] { height: 100vh }`, catalog `body` rootSelectors)가 담당한다.
 * min-height만 있으면 자식 percentage height의 containing block이 indefinite라 `height:100%`가
 * auto로 접히므로 definite `100vh`를 쓴다 (Canvas artboard와 같은 percentage basis). 한때
 * 같은 값을 inline `height:100vh`로도 투영했으나 (2026-09-18) DOM inline은 D3 채널 밖이라
 * 제거했다 — authored height/minHeight가 있으면 data attribute 자체를 내지 않는다.
 *
 * 과거 factory가 저장하던 display/fontFamily/overflow는 Body CSS와 catalog 기본값의
 * authored mirror였다. 기존 문서 데이터는 건드리지 않고 값이 정확히 구 기본값일 때만
 * DOM inline 투영에서 제거한다. 다른 값은 사용자 저작값이므로 보존한다.
 */
export function resolveBodyDomPresentation(
  type: string,
  style: CSSProperties | undefined,
): BodyDomPresentation {
  if (type !== "body") {
    return { style, fillsViewport: false };
  }

  const fillsViewport = style?.height == null && style?.minHeight == null;
  if (!style) return { style: undefined, fillsViewport };

  const normalized = { ...style };
  if (normalized.display === "block") delete normalized.display;
  if (normalized.overflow === "auto") delete normalized.overflow;
  if (
    typeof normalized.fontFamily === "string" &&
    LEGACY_BODY_FONT_FAMILIES.has(normalized.fontFamily)
  ) {
    delete normalized.fontFamily;
  }

  return {
    style: Object.keys(normalized).length > 0 ? normalized : undefined,
    fillsViewport,
  };
}

/** Body infrastructure class는 renderer가 소유하고 canonical className에는 중복 저장하지 않는다. */
export function resolveBodyDomClassName(
  type: string,
  authoredClassName: string | undefined,
): string | undefined {
  if (type !== "body") return authoredClassName;

  const authoredTokens = authoredClassName?.split(/\s+/).filter(Boolean) ?? [];
  const tokens = [
    BODY_DOM_CLASS_NAME,
    ...authoredTokens.filter((token) => !LEGACY_BODY_DOM_CLASSES.has(token)),
  ];
  return Array.from(new Set(tokens)).join(" ");
}
