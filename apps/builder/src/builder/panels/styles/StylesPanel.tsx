/**
 * StylesPanel - 스타일 편집 패널
 */

import { useState, useMemo, useCallback, memo } from "react";
import type { PanelProps } from "../core/types";
import { useStore, useDebouncedSelectedElementData } from "../../stores";
import { ActionIconButton, ActionIconToggleButton } from "../../components/ui";
import { Copy, ClipboardPaste, PencilRuler, Palette } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { EmptyState } from "../../components";
import {
  TransformSection,
  LayoutSection,
  AppearanceSection,
  TypographySection,
  ModifiedStylesSection,
  ComponentStateSection,
} from "./sections";
import { useSectionCollapse } from "./hooks/useSectionCollapse";
import { useStyleActions } from "./hooks/useStyleActions";
import { useKeyboardShortcutsRegistry } from "@/builder/hooks";
import "./StylesPanel.css";

export function StylesPanel({ isActive }: PanelProps) {
  if (!isActive) {
    return null;
  }
  return <StylesPanelContent />;
}

const ModifiedSectionsWrapper = memo(function ModifiedSectionsWrapper() {
  const selectedElement = useDebouncedSelectedElementData();
  if (!selectedElement) return null;
  return <ModifiedStylesSection selectedElement={selectedElement} />;
});

const AllSections = memo(function AllSections() {
  const selectedElement = useDebouncedSelectedElementData();
  const type = selectedElement?.type ?? null;
  const hasSpec = type != null && type !== "";

  return (
    <>
      <ComponentStateSection hasSpec={hasSpec} />
      <TransformSection />
      <LayoutSection />
      <AppearanceSection />
      <TypographySection />
    </>
  );
});

function StylesPanelContent() {
  const hasSelectedElement = useStore((s) => s.selectedElementId != null);
  const selectedElement = useDebouncedSelectedElementData();
  const selectedStyle =
    (selectedElement?.style as Record<string, unknown> | undefined) ?? null;
  const modifiedCount = useMemo(() => {
    if (!selectedStyle) return 0;
    return Object.keys(selectedStyle).filter(
      (k) => selectedStyle[k] !== undefined,
    ).length;
  }, [selectedStyle]);
  const isCopyDisabled = !selectedStyle || modifiedCount === 0;

  const [filter, setFilter] = useState<"all" | "modified">("all");
  const {
    expandAll,
    collapseAll,
    collapsedSections,
    focusMode,
    toggleFocusMode,
  } = useSectionCollapse();
  const { copyStyles, pasteStyles } = useStyleActions();

  const handleCopyStyles = useCallback(async () => {
    if (!selectedStyle) return;
    await copyStyles(selectedStyle as Record<string, unknown>);
  }, [selectedStyle, copyStyles]);

  const handlePasteStyles = useCallback(async () => {
    await pasteStyles();
  }, [pasteStyles]);

  const shortcuts = useMemo(
    () => [
      {
        key: "c",
        modifier: "cmdShift" as const,
        handler: handleCopyStyles,
        description: "Copy Styles",
      },
      {
        key: "v",
        modifier: "cmdShift" as const,
        handler: handlePasteStyles,
        description: "Paste Styles",
      },
      {
        key: "s",
        modifier: "altShift" as const,
        handler: toggleFocusMode,
        description: "Toggle Focus Mode",
      },
      {
        key: "s",
        modifier: "alt" as const,
        handler: () => {
          const allCollapsed = collapsedSections.size === 4;
          if (allCollapsed) {
            expandAll();
          } else {
            collapseAll();
          }
        },
        description: "Expand/Collapse All Sections",
      },
    ],
    [
      handleCopyStyles,
      handlePasteStyles,
      toggleFocusMode,
      collapsedSections,
      expandAll,
      collapseAll,
    ],
  );

  useKeyboardShortcutsRegistry(shortcuts, [
    handleCopyStyles,
    handlePasteStyles,
    toggleFocusMode,
    collapsedSections,
    expandAll,
    collapseAll,
  ]);

  if (!hasSelectedElement) {
    return <EmptyState message="요소를 선택하세요" />;
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-actions">
          <ActionIconToggleButton
            isSelected={filter === "all"}
            onChange={() => setFilter("all")}
            aria-label="Style"
            tooltip="전체 스타일"
          >
            <Palette
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ActionIconToggleButton>
          <ActionIconToggleButton
            className="panel-title"
            isSelected={filter === "modified"}
            onChange={() => setFilter("modified")}
            aria-label="Modify"
            tooltip="수정된 스타일"
          >
            <PencilRuler
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
            {modifiedCount > 0 && `modify ${modifiedCount}`}
          </ActionIconToggleButton>
        </div>
        <div className="panel-actions">
          <ActionIconButton
            onPress={handleCopyStyles}
            aria-label="Copy styles"
            isDisabled={isCopyDisabled}
            tooltip="스타일 복사"
          >
            <Copy
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ActionIconButton>
          <ActionIconButton
            onPress={handlePasteStyles}
            aria-label="Paste styles"
            tooltip="스타일 붙여넣기"
          >
            <ClipboardPaste
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </ActionIconButton>
        </div>

        {focusMode && <div className="focus-mode-indicator">Focus Mode</div>}
      </div>

      <div className="panel-contents">
        {filter === "all" ? <AllSections /> : <ModifiedSectionsWrapper />}
      </div>
    </div>
  );
}
