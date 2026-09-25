import type { CSSProperties } from "react";
import { isBodyType } from "../domain/predicates";

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
 * 페이지 프레임 높이 fallback 은 generated Body CSS 의 base `min-height: 100%` (catalog
 * `body.structure.containerStyles`) 가 담당한다 — inline 도, 조건부 data attribute 도 없다
 * (2026-09-18 사용자 결정; 그 전엔 `[data-body-viewport-fill] { height: 100vh }` 조건부 규칙과
 * 한때 inline `height:100vh`). 저작 height/minHeight 는 inline 으로 실려 base 를 덮는다.
 *
 * 과거 factory가 저장하던 display/fontFamily/overflow는 Body CSS와 catalog 기본값의
 * authored mirror였다. 기존 문서 데이터는 건드리지 않고 값이 정확히 구 기본값일 때만
 * DOM inline 투영에서 제거한다. 다른 값은 사용자 저작값이므로 보존한다.
 */
export function resolveBodyDomPresentation(
  type: string,
  style: CSSProperties | undefined,
): BodyDomPresentation {
  if (!isBodyType(type) || !style) return { style };

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
  };
}

/** Body infrastructure class는 renderer가 소유하고 canonical className에는 중복 저장하지 않는다. */
export function resolveBodyDomClassName(
  type: string,
  authoredClassName: string | undefined,
): string | undefined {
  if (!isBodyType(type)) return authoredClassName;

  const authoredTokens = authoredClassName?.split(/\s+/).filter(Boolean) ?? [];
  const tokens = [
    BODY_DOM_CLASS_NAME,
    ...authoredTokens.filter((token) => !LEGACY_BODY_DOM_CLASSES.has(token)),
  ];
  return Array.from(new Set(tokens)).join(" ");
}
