/**
 * useStyleValues - 스타일 값 계산 훅
 *
 * inline style, computed style, default value의 우선순위에 따라 스타일 값을 반환
 * Performance: useMemo + useRef로 참조 안정성 최적화
 *
 * 🚀 Phase 21: 값이 동일하면 이전 객체 재사용 (참조 안정성)
 */

import { useMemo } from "react";
import type { SelectedElement } from "../../../inspector/types";

// Properties that should only show inline styles (not computed)
// Reason: computedStyle.width/height/position always returns pixel values, even when not explicitly set
// Note: padding, margin, gap CAN use computed styles as they return actual values
const INLINE_ONLY_PROPERTIES = [
  "width",
  "height",
  "top",
  "left",
  "right",
  "bottom",
] as const;

/**
 * Get style value with priority (inline > computed > default)
 */
export function getStyleValue(
  element: SelectedElement | null,
  property: keyof React.CSSProperties,
  defaultValue: string,
): string {
  if (!element) return defaultValue;

  // Priority 1: Inline style
  if (element.style && element.style[property] !== undefined) {
    return String(element.style[property]);
  }

  // Priority 2: Computed style (skip for inline-only properties)
  if (
    !(INLINE_ONLY_PROPERTIES as readonly string[]).includes(
      property as string,
    ) &&
    element.computedStyle &&
    element.computedStyle[property] !== undefined
  ) {
    return String(element.computedStyle[property]);
  }

  // Priority 3: Default value
  return defaultValue;
}

// 🚀 Phase 20: 스타일 값 타입 정의
export interface StyleValues {
  // Transform
  width: string;
  height: string;
  top: string;
  left: string;
  // Layout
  display: string;
  flexDirection: string;
  alignItems: string;
  justifyContent: string;
  gap: string;
  padding: string;
  margin: string;
  // Appearance
  backgroundColor: string;
  borderColor: string;
  borderWidth: string;
  borderRadius: string;
  borderStyle: string;
  // Typography
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  lineHeight: string;
  letterSpacing: string;
  color: string;
  textAlign: string;
  textDecoration: string;
  textTransform: string;
  verticalAlign: string;
}

/**
 * Hook: 모든 스타일 값을 메모이제이션하여 반환
 * 🚀 Phase 20: 1회 파싱으로 성능 최적화
 * 🚀 Phase 21: useMemo가 selectedElement 기반으로 메모이제이션 제공
 */
export function useStyleValues(
  selectedElement: SelectedElement | null,
): StyleValues | null {
  return useMemo(() => {
    if (!selectedElement) {
      return null;
    }

    return {
      // Transform
      width: getStyleValue(selectedElement, "width", "auto"),
      height: getStyleValue(selectedElement, "height", "auto"),
      top: getStyleValue(selectedElement, "top", "auto"),
      left: getStyleValue(selectedElement, "left", "auto"),

      // Layout
      display: getStyleValue(selectedElement, "display", "block"),
      flexDirection: getStyleValue(selectedElement, "flexDirection", "row"),
      alignItems: getStyleValue(selectedElement, "alignItems", ""),
      justifyContent: getStyleValue(selectedElement, "justifyContent", ""),
      gap: getStyleValue(selectedElement, "gap", "0px"),
      padding: getStyleValue(selectedElement, "padding", "0px"),
      margin: getStyleValue(selectedElement, "margin", "0px"),

      // Appearance
      backgroundColor: getStyleValue(
        selectedElement,
        "backgroundColor",
        "#FFFFFF",
      ),
      borderColor: getStyleValue(selectedElement, "borderColor", "#000000"),
      borderWidth: getStyleValue(selectedElement, "borderWidth", "0px"),
      borderRadius: getStyleValue(selectedElement, "borderRadius", "0px"),
      borderStyle: getStyleValue(selectedElement, "borderStyle", "solid"),

      // Typography
      fontFamily: getStyleValue(selectedElement, "fontFamily", "Arial"),
      fontSize: getStyleValue(selectedElement, "fontSize", "16px"),
      fontWeight: getStyleValue(selectedElement, "fontWeight", "normal"),
      fontStyle: getStyleValue(selectedElement, "fontStyle", "normal"),
      lineHeight: getStyleValue(selectedElement, "lineHeight", "normal"),
      letterSpacing: getStyleValue(selectedElement, "letterSpacing", "normal"),
      color: getStyleValue(selectedElement, "color", "#000000"),
      textAlign: getStyleValue(selectedElement, "textAlign", "left"),
      textDecoration: getStyleValue(selectedElement, "textDecoration", "none"),
      textTransform: getStyleValue(selectedElement, "textTransform", "none"),
      verticalAlign: getStyleValue(
        selectedElement,
        "verticalAlign",
        "baseline",
      ),
    };
  }, [selectedElement]);
}

/**
 * Helper: Get selected vertical alignment button ID
 */
export function getVerticalAlignmentKeys(
  element: SelectedElement | null,
): string[] {
  if (!element) return [];

  const alignItems = getStyleValue(element, "alignItems", "");
  const reverseMap: Record<string, string> = {
    "flex-start": "align-vertical-start",
    center: "align-vertical-center",
    "flex-end": "align-vertical-end",
  };
  return alignItems && reverseMap[alignItems] ? [reverseMap[alignItems]] : [];
}

/**
 * Helper: Get selected horizontal alignment button ID
 */
export function getHorizontalAlignmentKeys(
  element: SelectedElement | null,
): string[] {
  if (!element) return [];

  const justifyContent = getStyleValue(element, "justifyContent", "");
  const reverseMap: Record<string, string> = {
    "flex-start": "align-horizontal-start",
    center: "align-horizontal-center",
    "flex-end": "align-horizontal-end",
  };
  return justifyContent && reverseMap[justifyContent]
    ? [reverseMap[justifyContent]]
    : [];
}

/**
 * Helper: Get selected flex alignment button ID (3x3 grid)
 */
export function getFlexAlignmentKeys(
  element: SelectedElement | null,
): string[] {
  if (!element) return [];

  const display = getStyleValue(element, "display", "");
  const justifyContent = getStyleValue(element, "justifyContent", "");
  const alignItems = getStyleValue(element, "alignItems", "");
  const flexDirection = getStyleValue(element, "flexDirection", "row");

  // display: flex가 아니면 alignment 선택 없음
  if (display !== "flex") {
    return [];
  }

  // Exclude spacing values (space-around, space-between, space-evenly)
  const spacingValues = ["space-around", "space-between", "space-evenly"];
  if (spacingValues.includes(justifyContent)) {
    return []; // No selection in 3x3 grid when using spacing
  }

  // For row (default): horizontal = justifyContent, vertical = alignItems
  // For column: horizontal = alignItems, vertical = justifyContent
  let horizontal: string, vertical: string;

  if (flexDirection === "column") {
    horizontal = alignItems;
    vertical = justifyContent;
  } else {
    // row or default
    horizontal = justifyContent;
    vertical = alignItems;
  }

  // Only select if both values are valid alignment values
  const validAlignmentValues = ["flex-start", "center", "flex-end"];
  if (
    !validAlignmentValues.includes(horizontal) ||
    !validAlignmentValues.includes(vertical)
  ) {
    return [];
  }

  // Map combinations to button IDs (horizontal:vertical)
  const combinationMap: Record<string, string> = {
    "flex-start:flex-start": "leftTop",
    "center:flex-start": "centerTop",
    "flex-end:flex-start": "rightTop",
    "flex-start:center": "leftCenter",
    "center:center": "centerCenter",
    "flex-end:center": "rightCenter",
    "flex-start:flex-end": "leftBottom",
    "center:flex-end": "centerBottom",
    "flex-end:flex-end": "rightBottom",
  };

  const key = `${horizontal}:${vertical}`;
  return combinationMap[key] ? [combinationMap[key]] : [];
}

/**
 * Helper: Get selected flex direction button ID
 * - 'block': display: block (or not flex)
 * - 'row': display: flex + flex-direction: row
 * - 'column': display: flex + flex-direction: column
 */
export function getFlexDirectionKeys(
  element: SelectedElement | null,
): string[] {
  if (!element) return ["block"];

  const display = getStyleValue(element, "display", "");
  const flexDirection = getStyleValue(element, "flexDirection", "");

  // display: flex가 아니면 block 선택
  if (display !== "flex") return ["block"];

  // display: flex일 때 direction 확인
  if (flexDirection === "column") return ["column"];

  // flex + row (기본값) 또는 flexDirection 없음
  return ["row"];
}

/**
 * Helper: Get selected justify content spacing (space-around/between/evenly)
 */
export function getJustifyContentSpacingKeys(
  element: SelectedElement | null,
): string[] {
  if (!element) return [];

  const display = getStyleValue(element, "display", "");
  const justifyContent = getStyleValue(element, "justifyContent", "");

  // display: flex가 아니면 spacing 선택 없음
  if (display !== "flex") {
    return [];
  }

  if (justifyContent === "space-around") return ["space-around"];
  if (justifyContent === "space-between") return ["space-between"];
  if (justifyContent === "space-evenly") return ["space-evenly"];

  return [];
}

/**
 * Helper: Get selected flex wrap button ID
 */
export function getFlexWrapKeys(element: SelectedElement | null): string[] {
  if (!element) return [];

  const display = getStyleValue(element, "display", "");
  const flexWrap = getStyleValue(element, "flexWrap", "");

  // display: flex가 아니면 wrap 선택 없음
  if (display !== "flex") {
    return [];
  }

  if (flexWrap === "wrap") return ["wrap"];
  if (flexWrap === "wrap-reverse") return ["wrap-reverse"];

  // 기본값 또는 nowrap
  return ["nowrap"];
}
