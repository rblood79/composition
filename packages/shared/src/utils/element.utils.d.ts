/**
 * Element Utilities
 *
 * 🚀 Phase 10 B2.2: 공유 Element 유틸리티 함수
 *
 * @since 2025-12-11 Phase 10 B2.2
 */
import type { Element } from "../types/element.types";
/**
 * 고유 ID 생성
 */
export declare function generateId(): string;
/**
 * ID로 요소 찾기
 */
export declare function findElementById(elements: Element[], id: string): Element | undefined;
/**
 * 부모 ID로 자식 요소들 찾기
 */
export declare function findChildElements(elements: Element[], parentId: string | null): Element[];
/**
 * 요소의 자손들 찾기 (재귀)
 */
export declare function findDescendants(elements: Element[], parentId: string): Element[];
/**
 * 요소의 조상들 찾기
 */
export declare function findAncestors(elements: Element[], elementId: string): Element[];
/**
 * 요소 트리 구축.
 *
 * ADR-118: caller 가 넘긴 elements source order 를 보존한다. Element sibling
 * order 의 SSOT 는 canonical parent `children[]` 배열 index 다.
 */
export declare function buildElementTree(elements: Element[], parentId?: string | null): Element[];
/**
 * 렌더링할 수 있는 요소인지 확인
 */
export declare function isRenderableElement(element: Element): boolean;
/**
 * 요소의 style props에서 CSS 스타일 추출
 */
export declare function extractStyle(element: Element): React.CSSProperties;
/**
 * 요소의 텍스트 콘텐츠 추출
 */
export declare function extractTextContent(element: Element): string;
/**
 * 페이지의 요소들 필터링
 */
export declare function getPageElements(elements: Element[], pageId: string): Element[];
//# sourceMappingURL=element.utils.d.ts.map