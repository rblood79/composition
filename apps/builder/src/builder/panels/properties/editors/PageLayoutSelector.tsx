/**
 * Page Layout Selector
 *
 * ADR-903 P3-C: page 의 layout 연결 → page 노드의 reusable frame ref 선택 UI.
 * ADR-111 direct cutover: canonical reusable FrameNode read path.
 * ADR-225: 사용자 문구는 Layout, binding 아래 저장 계약은 FrameNode ref 그대로.
 *
 * - active canonical document 의 reusable FrameNode 기반 layout surface 사용
 */

import { memo, useMemo, useCallback } from "react";
import { Layout, X } from "lucide-react";
import { PropertySelect, PropertySection } from "../../../components";
import { readImmediateSelectionSnapshot, useStore } from "../../../stores";
import { useCanonicalReusableLayouts } from "../../../stores/canonical/reusableLayoutStore";
import { translateKey, useOptionalI18n } from "../../../../i18n";
import { iconEditProps } from "../../../../utils/ui/uiConstants";
import {
  applyPageFrameBindingExplicit,
  applyPageFrameBindingFromSelection,
  getPageFrameBindingId,
} from "../../../../adapters/canonical/pageFrameBinding";

import "./styles/pageSelectors.css";
interface PageLayoutSelectorProps {
  pageId: string;
  bindingMode?: "selection" | "explicit";
  contextReason?: string;
}

export const PageLayoutSelector = memo(function PageLayoutSelector({
  pageId,
  bindingMode = "selection",
  contextReason = "page-layout-selector",
}: PageLayoutSelectorProps) {
  const i18n = useOptionalI18n();
  const t = useCallback(
    (key: string, params?: Record<string, string | number | boolean>) =>
      i18n ? i18n.t(key, params) : key,
    [i18n],
  );
  const page = useStore((state) => state.pages.find((p) => p.id === pageId));
  const layouts = useCanonicalReusableLayouts();

  // ADR-116 projection 제거: LayoutsTab 과 동일하게 active canonical document 를 사용.
  const reusableLayouts = useMemo<
    ReadonlyArray<{ id: string; name: string; description?: string }>
  >(() => {
    return layouts.map((layout) => ({
      id: layout.id,
      name: layout.name,
      description: layout.description,
    }));
  }, [layouts]);

  const selectedLayoutId = getPageFrameBindingId(page);
  const currentLayout = useMemo(
    () => reusableLayouts.find((layout) => layout.id === selectedLayoutId),
    [reusableLayouts, selectedLayoutId],
  );

  // "No Layout" 은 PropertySelect 의 semanticLabelKeys 경로로 번역된다 (labels.ts).
  const layoutOptions = useMemo(() => {
    const options = [{ value: "", label: "No Layout" }];
    reusableLayouts.forEach((layout) => {
      options.push({ value: layout.id, label: layout.name });
    });
    return options;
  }, [reusableLayouts]);

  const handleLayoutChange = useCallback(
    async (layoutId: string) => {
      try {
        const state = useStore.getState();
        if (bindingMode === "explicit") {
          await applyPageFrameBindingExplicit({
            pageId,
            contextReason,
            frameId: layoutId || null,
            getElementsState: () => useStore.getState(),
            setPages: state.setPages,
          });
          return;
        }

        const snapshot = readImmediateSelectionSnapshot();
        await applyPageFrameBindingFromSelection({
          snapshot,
          frameId: layoutId || null,
          getElementsState: () => useStore.getState(),
          setPages: state.setPages,
        });
      } catch (error) {
        console.error(
          "[PageLayoutSelector] Failed to update page layout:",
          error,
        );
      }
    },
    [bindingMode, contextReason, pageId],
  );

  if (reusableLayouts.length === 0) return null;

  return (
    <PropertySection title="Layout">
      <PropertySelect
        label="Apply Layout"
        value={selectedLayoutId}
        onChange={handleLayoutChange}
        options={layoutOptions}
        icon={Layout}
        description={
          currentLayout
            ? translateKey(
                t,
                "properties.usingLayout",
                `Using "${currentLayout.name}" layout`,
                { name: currentLayout.name },
              )
            : translateKey(
                t,
                "properties.selectReusableLayout",
                "Select a reusable layout for this page",
              )
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
            title={translateKey(
              t,
              "properties.removeLayoutFromPage",
              "Remove layout from this page",
            )}
          >
            <X size={iconEditProps.size} />
            <span>
              {translateKey(t, "properties.removeLayout", "Remove Layout")}
            </span>
          </button>
        </div>
      )}
    </PropertySection>
  );
});

export default PageLayoutSelector;
