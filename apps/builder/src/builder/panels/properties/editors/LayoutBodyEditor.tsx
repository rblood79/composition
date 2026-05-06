/**
 * LayoutBodyEditor - Layout body 요소 전용 에디터
 *
 * Frame body의 핵심 기능: 프리셋을 통한 Slot 생성
 * - LayoutPresetSelector를 통해 레이아웃 프리셋 적용
 * - Slot 자동 생성 및 containerStyle 적용
 *
 * ⭐ Phase 6: BodyEditor에서 분리됨
 * - Page body: PageBodyEditor (Layout 선택)
 * - Layout body: LayoutBodyEditor (프리셋 + Slot 생성)
 */

import { memo, useMemo } from "react";
import { PropertySection } from "../../../components";
import { PropertyEditorProps } from "../types/editorTypes";
import { useStore } from "../../../stores";
import { LayoutPresetSelector } from "./LayoutPresetSelector";
import { getFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";

export const LayoutBodyEditor = memo(
  function LayoutBodyEditor({ elementId }: PropertyEditorProps) {
    // ⭐ 최적화: layoutId를 현재 시점에만 가져오기 (Zustand 구독 방지)
    const layoutId = useMemo(() => {
      const element = useStore.getState().elementsMap.get(elementId);
      return element ? getFrameElementMirrorId(element) : null;
    }, [elementId]);

    return (
      <>
        {/* ⭐ Frame 전용: 프리셋 선택기 (Slot 자동 생성) */}
        {layoutId && (
          <PropertySection title="Frame Preset">
            <LayoutPresetSelector
              layoutId={layoutId}
              bodyElementId={elementId}
            />
          </PropertySection>
        )}
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

export default LayoutBodyEditor;
