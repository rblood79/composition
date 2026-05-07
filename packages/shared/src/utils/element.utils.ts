/**
 * Element Utilities
 *
 * 🚀 Phase 10 B2.2: 공유 Element 유틸리티 함수
 *
 * @since 2025-12-11 Phase 10 B2.2
 */

import type { Element } from "../types/element.types";

// ============================================
// ID Generation
// ============================================

/**
 * 고유 ID 생성
 */
export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================
// Element Tree Utilities
// ============================================

/**
 * ID로 요소 찾기
 */
export function findElementById(
  elements: Element[],
  id: string,
): Element | undefined {
  return elements.find((el) => el.id === id);
}

/**
 * 부모 ID로 자식 요소들 찾기
 */
export function findChildElements(
  elements: Element[],
  parentId: string | null,
): Element[] {
  return elements.filter((el) => el.parent_id === parentId);
}

/**
 * 요소의 자손들 찾기 (재귀)
 */
export function findDescendants(
  elements: Element[],
  parentId: string,
): Element[] {
  const children = findChildElements(elements, parentId);
  let nestedChildren = [...children];

  for (const child of children) {
    nestedChildren = [
      ...nestedChildren,
      ...findDescendants(elements, child.id),
    ];
  }

  return nestedChildren;
}

/**
 * 요소의 조상들 찾기
 */
export function findAncestors(
  elements: Element[],
  elementId: string,
): Element[] {
  const ancestors: Element[] = [];
  let current = findElementById(elements, elementId);

  while (current?.parent_id) {
    const parent = findElementById(elements, current.parent_id);
    if (parent) {
      ancestors.push(parent);
      current = parent;
    } else {
      break;
    }
  }

  return ancestors;
}

/**
 * 요소 트리 구축.
 *
 * ADR-118: caller 가 넘긴 elements source order 를 보존한다. Element sibling
 * order 의 SSOT 는 canonical parent `children[]` 배열 index 다.
 */
export function buildElementTree(
  elements: Element[],
  parentId: string | null = null,
): Element[] {
  return elements.filter((el) => el.parent_id === parentId && !el.deleted);
}

// ============================================
// Element Rendering Utilities
// ============================================

/**
 * 렌더링할 수 있는 요소인지 확인
 */
export function isRenderableElement(element: Element): boolean {
  // 삭제된 요소 제외
  if (element.deleted) return false;

  // 특정 태그 제외 (필요 시 확장)
  const nonRenderableTags = ["Body", "Head", "Script"];
  if (nonRenderableTags.includes(element.type)) return false;

  return true;
}

/**
 * 요소의 style props에서 CSS 스타일 추출
 */
export function extractStyle(element: Element): React.CSSProperties {
  const props = element.props as Record<string, unknown>;
  return (props?.style as React.CSSProperties) || {};
}

/**
 * 요소의 텍스트 콘텐츠 추출
 */
export function extractTextContent(element: Element): string {
  const props = element.props as Record<string, unknown>;
  return String(props?.children || props?.text || props?.label || "");
}

// ============================================
// Page Utilities
// ============================================

/**
 * 페이지의 요소들 필터링
 */
export function getPageElements(
  elements: Element[],
  pageId: string,
): Element[] {
  return elements.filter((el) => el.page_id === pageId && !el.deleted);
}
