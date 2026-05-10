import {
  Element,
  ComponentElementProps,
} from "../../../types/core/store.types";
import { ButtonSpec, getSizePreset } from "@composition/specs";

/**
 * Element 조회 및 속성 관리 헬퍼 함수들
 */

/**
 * Size별 border-radius 기본값 (CSS 변수 기준)
 * --radius-sm: 4px, --radius-md: 6px, --radius-lg: 8px
 */
const SIZE_BORDER_RADIUS: Record<string, number> = {
  xs: 4, // --radius-sm
  sm: 4, // --radius-sm
  md: 6, // --radius-md
  lg: 8, // --radius-lg
  xl: 8, // --radius-lg
};

/**
 * ID로 요소를 찾는 헬퍼 함수 (배열 기반 - O(n))
 * @deprecated 성능 최적화를 위해 elementsMap 사용을 권장합니다
 *
 * @param elements - 검색할 요소 배열
 * @param id - 찾을 요소의 ID
 * @returns 찾은 요소 또는 null
 */
export const findElementById = (
  elements: Element[],
  id: string,
): Element | null => {
  for (const element of elements) {
    if (element.id === id) return element;
  }
  return null;
};

/**
 * ID로 요소를 찾는 헬퍼 함수 (Map 기반 - O(1))
 * @param elementsMap - 요소 Map (id -> Element)
 * @param id - 찾을 요소의 ID
 * @returns 찾은 요소 또는 null
 */
export const getElementById = <TElement extends Element>(
  elementsMap: ReadonlyMap<string, TElement>,
  id: string,
): TElement | null => {
  return elementsMap.get(id) || null;
};

/**
 * 부모 ID로 자식 요소들을 찾는 헬퍼 함수 (Map 기반 - O(1))
 * @param childrenMap - 자식 Map (parent_id -> Element[])
 * @param parentId - 부모 요소의 ID
 * @returns 자식 요소 배열
 */
export const getChildElements = <TElement extends Element>(
  childrenMap: ReadonlyMap<string, readonly TElement[]>,
  parentId: string,
): TElement[] => {
  return [...(childrenMap.get(parentId) || [])];
};

/**
 * 요소의 완전한 props 객체를 생성하는 헬퍼 함수
 *
 * 요소의 기존 props에 새로운 props를 병합하고 type 정보를 추가합니다.
 *
 * @param element - 대상 Element 객체
 * @param props - 병합할 추가 props (선택적)
 * @returns 병합된 props 객체 (type 포함)
 */
export const createCompleteProps = (
  element: Element,
  props?: ComponentElementProps,
) => ({
  ...element.props,
  ...props,
  type: element.type,
});

/**
 * WebGL 요소의 computedStyle 계산
 *
 * Canvas에서 선택된 요소의 computed style을 계산합니다.
 * Preview(React)에서는 window.getComputedStyle()로 추출하지만,
 * WebGL에서는 spec/inline style에서 직접 계산해야 합니다.
 *
 * @param element - 대상 Element 객체
 * @returns computedStyle 객체 (borderRadius 등)
 */
export const computeCanvasElementStyle = (
  element: Element,
): Record<string, string> => {
  const computedStyle: Record<string, string> = {};
  const props = element.props as Record<string, unknown> | undefined;
  const style = props?.style as Record<string, unknown> | undefined;
  const type = element.type.toLowerCase();

  // 1. Inline style에서 borderRadius 추출 (최우선)
  if (style?.borderRadius !== undefined) {
    const value = style.borderRadius;
    computedStyle.borderRadius =
      typeof value === "number" ? `${value}px` : String(value);
    return computedStyle;
  }

  // 2. 컴포넌트별 spec에서 borderRadius 계산
  const size = String(props?.size || "sm");

  switch (type) {
    case "button": {
      // Button: ButtonSpec에서 size별 borderRadius 가져오기
      const sizeSpec =
        ButtonSpec.sizes[size as keyof typeof ButtonSpec.sizes] ||
        ButtonSpec.sizes[ButtonSpec.defaultSize];
      const sizePreset = getSizePreset(sizeSpec, "light");
      computedStyle.borderRadius = `${sizePreset.borderRadius}px`;
      break;
    }
    default: {
      // 다른 컴포넌트: SIZE_BORDER_RADIUS 기본값 사용
      const borderRadius = SIZE_BORDER_RADIUS[size] ?? SIZE_BORDER_RADIUS.sm;
      computedStyle.borderRadius = `${borderRadius}px`;
      break;
    }
  }

  return computedStyle;
};
