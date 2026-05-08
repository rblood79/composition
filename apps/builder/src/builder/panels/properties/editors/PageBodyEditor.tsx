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

    // Page body가 선택된 경우에는 element.page_id가 적용 대상의 정본이다.
    // Frame/projection body처럼 page_id가 없는 경우에만 현재 편집 page로 fallback한다.
    const currentPageId = useStore((state) => state.currentPageId);
    const selectedElementPageId = element?.page_id ?? null;
    const targetPageId = selectedElementPageId ?? currentPageId;

    // ⭐ 최적화: 각 필드별 onChange 함수를 개별 메모이제이션
    const handleClassNameChange = useCallback(
      (value: string) => {
        onUpdate({ className: value || undefined });
      },
      [onUpdate],
    );

    return (
      <>
        {/* ⭐ Page 전용: Layout 선택 */}
        {targetPageId && <PageLayoutSelector pageId={targetPageId} />}

        {/* ⭐ Nested Routes & Slug System: Parent Page 선택 */}
        {targetPageId && <PageParentSelector pageId={targetPageId} />}

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
