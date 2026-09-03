/**
 * useStyleSource - 스타일 출처 감지 훅
 *
 * inline style, computed style, inherited, default를 구분하여 반환
 * Webflow 스타일: 컬러 도트로 출처 시각화
 */

import { useMemo } from "react";
import type { SelectedElement } from "../../../inspector/types";
import type { StyleSource } from "../types/styleTypes";

// Properties that should only show inline styles (not computed)
const INLINE_ONLY_PROPERTIES = [
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
  "padding",
  "margin",
  "gap",
] as const;

/**
 * Get style source for a specific property
 */
export function getStyleSource(
  element: SelectedElement | null,
  property: keyof React.CSSProperties,
): StyleSource {
  if (!element) {
    return { type: "default", location: "component-default" };
  }

  // Priority 1: Inline style (사용자가 직접 설정)
  if (element.style && element.style[property] !== undefined) {
    return { type: "inline", location: "user-set" };
  }

  // Priority 2: Computed style (CSS 클래스에서)
  if (
    !(INLINE_ONLY_PROPERTIES as readonly string[]).includes(
      property as string,
    ) &&
    element.computedStyle &&
    element.computedStyle[property] !== undefined
  ) {
    // Extract class name from element if available
    const className =
      (element as unknown as { className?: string }).className ||
      "unknown-class";
    return { type: "computed", location: className };
  }

  // Priority 3: Inherited (부모 요소에서 상속)
  // TODO: Implement parent element style checking
  // For now, we'll treat non-inline, non-computed as default

  // Priority 4: Default (컴포넌트 기본값)
  return { type: "default", location: "component-default" };
}

/**
 * Hook: Get style source information for an element
 */
export function useStyleSource(
  element: SelectedElement | null,
  property: keyof React.CSSProperties,
): StyleSource {
  return useMemo(() => {
    return getStyleSource(element, property);
  }, [element, property]);
}

/**
 * Helper: Get CSS class for style source dot
 */
export function getSourceDotClass(source: StyleSource): string {
  switch (source.type) {
    case "inline":
      return "source-dot inline";
    case "computed":
      return "source-dot computed";
    case "inherited":
      return "source-dot inherited";
    case "default":
      return "source-dot default";
    default:
      return "source-dot";
  }
}

/**
 * Helper: Get tooltip text for style source
 */
export function getSourceTooltip(source: StyleSource): string {
  switch (source.type) {
    case "inline":
      return "User set (inline style)";
    case "computed":
      return `CSS class: ${source.location}`;
    case "inherited":
      return `Inherited from: ${source.location}`;
    case "default":
      return "Component default";
    default:
      return "Unknown source";
  }
}
