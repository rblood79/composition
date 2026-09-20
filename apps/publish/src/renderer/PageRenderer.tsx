/**
 * Page Renderer
 *
 * 🚀 Phase 10 B2.3: 페이지 렌더링 컴포넌트
 *
 * Element 트리를 받아서 전체 페이지를 렌더링합니다.
 *
 * @since 2025-12-11 Phase 10 B2.3
 */

import { memo, useMemo } from "react";
import type { Element, Page } from "@composition/shared";
import {
  collectResponsiveCssFromElements,
  getPageElements,
} from "@composition/shared";
import { ElementRenderer, groupChildrenByParent } from "./ElementRenderer";
import { useBodyElement } from "../hooks/useBodyElement";

// ============================================
// Types
// ============================================

export interface PageRendererProps {
  page: Page;
  elements: Element[];
  className?: string;
}

// ============================================
// Page Renderer Component
// ============================================

export const PageRenderer = memo(function PageRenderer({
  page,
  elements,
  className,
}: PageRendererProps) {
  // 현재 페이지의 요소들만
  const pageElements = useMemo(
    () => getPageElements(elements, page.id),
    [elements, page.id],
  );

  // 부모별 자식 표 한 번 — 루트는 null 키
  const childrenByParent = useMemo(
    () => groupChildrenByParent(pageElements),
    [pageElements],
  );
  const rootElements = childrenByParent.get(null) ?? [];

  // ADR-109 D1: body element → document.body className/style 동기화
  useBodyElement(pageElements);

  // ADR-154: 반응형 override(tablet/mobile) 를 @media <style> 로 emit. ElementRenderer
  // 는 base(props.style) 만 inline 으로 적용하므로, breakpoint override 는 이 스타일이
  // 담당한다 (선택자 [data-element-id] 는 ElementRenderer 가 이미 부여). Preview App /
  // generateStaticHtml 과 동일 SSOT(getResponsiveValueWithCascade) → 3경로 발산 0.
  const responsiveCss = useMemo(
    () => collectResponsiveCssFromElements(pageElements),
    [pageElements],
  );

  return (
    <div
      className={className}
      data-page-id={page.id}
      data-page-slug={page.slug}
    >
      {responsiveCss ? (
        <style data-adr154-responsive="">{responsiveCss}</style>
      ) : null}
      {rootElements.map((element) => (
        <ElementRenderer
          key={element.id}
          element={element}
          childrenByParent={childrenByParent}
        />
      ))}
    </div>
  );
});

export default PageRenderer;
