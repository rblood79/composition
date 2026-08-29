/**
 * PageBodyEditor - Page body 요소 전용 에디터
 *
 * Page body의 핵심 기능: Frame(Layout) 연결 + 부모 페이지(nested route) 지정
 * - id/class 는 전 타입 공통이라 ElementAttributesSection 이 담당 (2026-08-29)
 *
 * ⭐ Phase 6: BodyEditor에서 분리됨
 * - Page body: PageBodyEditor (Layout 선택)
 * - Layout body: LayoutBodyEditor (프리셋 + Slot 생성)
 */

import { memo } from "react";
import { PropertyEditorProps } from "../types/editorTypes";
import { useStore } from "../../../stores";
import { PageLayoutSelector } from "./PageLayoutSelector";
import { PageParentSelector } from "./PageParentSelector";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";

export const PageBodyEditor = memo(
  function PageBodyEditor({ elementId }: PropertyEditorProps) {
    const element = useCanonicalPropertyElement(elementId);

    // Page body는 live currentPageId와 일치할 때만 page-bound controls를 노출한다.
    // Frame/projection body처럼 page_id가 없는 경우에만 현재 편집 page로 fallback한다.
    const currentPageId = useStore((state) => state.currentPageId);
    const selectedElementPageId = element?.page_id ?? null;
    const hasStalePageMismatch =
      selectedElementPageId != null &&
      currentPageId != null &&
      selectedElementPageId !== currentPageId;
    const targetPageId = hasStalePageMismatch
      ? null
      : (selectedElementPageId ?? currentPageId);
    const isExplicitPageContext =
      selectedElementPageId == null && targetPageId != null;

    // ADR-177 페이지 캔버스 위치 입력은 Styles 패널 TransformSection 으로 이동
    // (적응형 통합 — body 선택 시 position row 가 pagePositions 를 편집).

    return (
      <>
        {/* ⭐ Page 전용: Layout 선택 */}
        {targetPageId &&
          (isExplicitPageContext ? (
            <PageLayoutSelector
              pageId={targetPageId}
              bindingMode="explicit"
              contextReason="projection-body"
            />
          ) : (
            <PageLayoutSelector pageId={targetPageId} />
          ))}

        {/* ⭐ Nested Routes & Slug System: Parent Page 선택 */}
        {targetPageId && <PageParentSelector pageId={targetPageId} />}

      </>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.elementId === nextProps.elementId &&
      JSON.stringify(prevProps.currentProps) ===
        JSON.stringify(nextProps.currentProps)
    );
  },
);

export default PageBodyEditor;
