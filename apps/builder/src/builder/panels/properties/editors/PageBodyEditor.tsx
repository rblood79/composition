/**
 * PageBodyEditor - Page body 요소 전용 에디터
 *
 * Page body의 핵심 기능: Layout 선택
 * - PageLayoutSelector를 통해 Layout 템플릿 적용
 * - className, aria 속성 편집
 *
 * ⭐ Phase 6: BodyEditor에서 분리됨
 * - Page body: PageBodyEditor (Layout 선택)
 * - Layout body: LayoutBodyEditor (프리셋 + Slot 생성)
 */

import { memo, useCallback, useMemo } from "react";
import { Layout } from "lucide-react";
import {
  PropertyCustomId,
  PropertyInput,
  PropertySection,
} from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { useStore } from "../../../stores";
import { PageLayoutSelector } from "./PageLayoutSelector";
import { PageParentSelector } from "./PageParentSelector";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";

export const PageBodyEditor = memo(
  function PageBodyEditor({
    elementId,
    currentProps,
    onUpdate,
  }: PropertyEditorProps) {
    const element = useCanonicalPropertyElement(elementId);
    const customId = useMemo(
      () => element?.customId || "",
      [element?.customId],
    );

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

    // ⭐ 최적화: 각 필드별 onChange 함수를 개별 메모이제이션
    const handleClassNameChange = useCallback(
      (value: string) => {
        onUpdate({ className: value || undefined });
      },
      [onUpdate],
    );

    // ADR-177 Phase 3 — 페이지 캔버스 위치 (active breakpoint). 실제 page body
    // (page_id 보유 + stale mismatch 아님) 에만 노출 — projection/frame body 는
    // 페이지 이동 대상이 아니다. commit 은 updatePagePosition 경유라
    // 히스토리 entry + document 기록 + persist 가 자동 편입된다 (blur/Enter
    // commit — entry 는 commit 당 1개).
    const pagePositionPageId =
      !hasStalePageMismatch && selectedElementPageId != null
        ? selectedElementPageId
        : null;
    const pagePosition = useStore((state) =>
      pagePositionPageId ? state.pagePositions[pagePositionPageId] : undefined,
    );

    const handlePagePositionCommit = useCallback(
      (axis: "x" | "y", value: string) => {
        if (!pagePositionPageId) return;
        const parsed = Number.parseFloat(value);
        if (!Number.isFinite(parsed)) return;
        const state = useStore.getState();
        const current = state.pagePositions[pagePositionPageId];
        if (!current) return;
        state.updatePagePosition(
          pagePositionPageId,
          axis === "x" ? parsed : current.x,
          axis === "y" ? parsed : current.y,
        );
      },
      [pagePositionPageId],
    );
    const handlePageXCommit = useCallback(
      (value: string) => handlePagePositionCommit("x", value),
      [handlePagePositionCommit],
    );
    const handlePageYCommit = useCallback(
      (value: string) => handlePagePositionCommit("y", value),
      [handlePagePositionCommit],
    );

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

        {/* ADR-177: 페이지 캔버스 위치 (X/Y — active breakpoint) */}
        {pagePositionPageId && pagePosition && (
          <PropertySection title="Position">
            {/* String 변환 필수 — PropertyInput 의 `String(value || "")` 가
                숫자 0 을 빈 문자열로 삼킨다 (y=0 페이지가 빈 칸으로 표시) */}
            <PropertyInput
              label="X"
              type="number"
              value={String(Math.round(pagePosition.x))}
              onChange={handlePageXCommit}
            />
            <PropertyInput
              label="Y"
              type="number"
              value={String(Math.round(pagePosition.y))}
              onChange={handlePageYCommit}
            />
          </PropertySection>
        )}

        {/* Layout Section */}
        <PropertySection title="Layout">
          <PropertyCustomId
            label="ID"
            value={customId}
            elementId={elementId}
            placeholder="body"
          />

          <PropertyInput
            label="Class Name"
            value={String(currentProps.className || "")}
            onChange={handleClassNameChange}
            placeholder="page-container"
            icon={Layout}
          />
        </PropertySection>
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
