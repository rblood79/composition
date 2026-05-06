/**
 * Page Layout Selector
 *
 * ADR-903 P3-C: page 의 layout 연결 → page 노드의 reusable frame ref 선택 UI.
 * ADR-911 direct cutover: canonical reusable FrameNode read path.
 *
 * - active canonical document 의 reusable FrameNode 기반 layout surface 사용
 */

import { memo, useMemo, useCallback } from "react";
import { Layout, X } from "lucide-react";
import { PropertySelect, PropertySection } from "../../../components";
import { useStore } from "../../../stores";
import { useCanonicalReusableFrameLayouts } from "../../../stores/canonical/canonicalFrameStore";
import { iconEditProps } from "../../../../utils/ui/uiConstants";
import {
  applyPageFrameBindingCanonicalPrimary,
  getPageFrameBindingId,
} from "../../../../adapters/canonical/pageFrameBinding";

interface PageLayoutSelectorProps {
  pageId: string;
}

export const PageLayoutSelector = memo(function PageLayoutSelector({
  pageId,
}: PageLayoutSelectorProps) {
  const page = useStore((state) => state.pages.find((p) => p.id === pageId));
  const layouts = useCanonicalReusableFrameLayouts();

  // ADR-916 projection 제거: FramesTab 과 동일하게 active canonical document 를 사용.
  const reusableFrames = useMemo<
    ReadonlyArray<{ id: string; name: string; description?: string }>
  >(() => {
    return layouts.map((layout) => ({
      id: layout.id,
      name: layout.name,
      description: layout.description,
    }));
  }, [layouts]);

  const selectedFrameId = getPageFrameBindingId(page);
  const currentLayout = useMemo(
    () => reusableFrames.find((f) => f.id === selectedFrameId),
    [reusableFrames, selectedFrameId],
  );

  const layoutOptions = useMemo(() => {
    const options = [{ value: "", label: "No Frame" }];
    reusableFrames.forEach((frame) => {
      options.push({ value: frame.id, label: frame.name });
    });
    return options;
  }, [reusableFrames]);

  const handleLayoutChange = useCallback(
    async (frameId: string) => {
      try {
        const state = useStore.getState();
        await applyPageFrameBindingCanonicalPrimary({
          pageId,
          frameId: frameId || null,
          getElementsState: () => useStore.getState(),
          setPages: state.setPages,
          setElements: state.setElements,
        });
      } catch (error) {
        console.error(
          "[PageLayoutSelector] Failed to update page layout:",
          error,
        );
      }
    },
    [pageId],
  );

  if (reusableFrames.length === 0) return null;

  return (
    <PropertySection title="Frame" icon={Layout}>
      <PropertySelect
        label="Apply Frame"
        value={selectedFrameId}
        onChange={handleLayoutChange}
        options={layoutOptions}
        icon={Layout}
        description={
          currentLayout
            ? `Using "${currentLayout.name}" frame`
            : "Select a reusable frame for this page"
        }
      />

      {currentLayout && (
        <div className="page-layout-info">
          {currentLayout.description && (
            <p className="page-layout-description">
              {currentLayout.description}
            </p>
          )}
          <button
            className="page-layout-clear"
            onClick={() => handleLayoutChange("")}
            title="Remove frame from this page"
          >
            <X size={iconEditProps.size} />
            <span>Remove Frame</span>
          </button>
        </div>
      )}
    </PropertySection>
  );
});

export default PageLayoutSelector;
