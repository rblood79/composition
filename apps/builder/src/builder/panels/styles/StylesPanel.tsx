/**
 * StylesPanel - 스타일 편집 패널
 *
 * 섹션 5개(Responsive / Transform / Layout / Appearance / Typography)를 **4개 그룹 탭**으로 묶어
 * 한 번에 한 그룹만 보여준다 (섹션 삭제 없음 — 그룹화만). 탭 정의·그룹별 dirty 판정은
 * `constants/styleGroups.ts`, 탭 UI 어법(선택된 탭만 라벨)은 `components/StylesPanelTabs.tsx`.
 *
 * 헤더는 두 줄이다:
 * - 타이틀 줄: 요소 타입 + "modify N" 배지(수정된 속성만 보기 토글)
 * - 탭 줄: 그룹 탭 4개 + 스타일 복사/붙여넣기
 */

import { useState, useMemo, useCallback, memo, type ReactElement } from "react";
import { Tabs, TabPanel } from "react-aria-components";
import { useStore, useDebouncedSelectedElementData } from "../../stores";
import { ActionIconButton, ActionIconToggleButton } from "../../components/ui";
import { PencilRuler, Palette } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 복사/붙여넣기 정본. */
const { copy: CopyIcon, paste: PasteIcon } = ACTION_ICONS;
import { iconProps } from "../../../utils/ui/uiConstants";
import { EmptyState, PanelHeader } from "../../components";
import {
  TransformSection,
  LayoutSection,
  AppearanceSection,
  TypographySection,
  ModifiedStylesSection,
  ResponsiveSection,
} from "./sections";
import { StylesPanelTabs } from "./components/StylesPanelTabs";
import {
  STYLE_GROUP_IDS,
  toDirtyGroups,
  type StyleGroupId,
} from "./constants/styleGroups";
import { useSectionCollapse } from "./hooks/useSectionCollapse";
import { useStyleActions } from "./hooks/useStyleActions";
import { useDirtyStyleProps } from "./hooks/useResetStyles";
import { useKeyboardShortcutsRegistry } from "@/builder/hooks";
import "./StylesPanel.css";

// 비활성 gating 은 PanelWorkspace 의 <Activity mode="hidden"> 이 담당 (ADR-922)
export function StylesPanel() {
  return <StylesPanelContent />;
}

const ModifiedSectionsWrapper = memo(function ModifiedSectionsWrapper() {
  const selectedElement = useDebouncedSelectedElementData();
  if (!selectedElement) return null;
  return <ModifiedStylesSection selectedElement={selectedElement} />;
});

const LayoutGroupSections = memo(function LayoutGroupSections() {
  return (
    <>
      <TransformSection />
      <LayoutSection />
    </>
  );
});

const StyleGroupSections = memo(function StyleGroupSections() {
  return <AppearanceSection />;
});

const TextGroupSections = memo(function TextGroupSections() {
  return <TypographySection />;
});

const ScreenGroupSections = memo(function ScreenGroupSections() {
  return <ResponsiveSection />;
});

function GroupSections({ group }: { group: StyleGroupId }): ReactElement {
  switch (group) {
    case "style":
      return <StyleGroupSections />;
    case "text":
      return <TextGroupSections />;
    case "screen":
      return <ScreenGroupSections />;
    case "layout":
    default:
      return <LayoutGroupSections />;
  }
}

function StylesPanelContent() {
  const hasSelectedElement = useStore((s) => s.selectedElementId != null);
  const selectedElement = useDebouncedSelectedElementData();
  const selectedStyle =
    (selectedElement?.style as Record<string, unknown> | undefined) ?? null;
  // "modify N" 뱃지는 baseline(factory default / spec preset / subpart)과 실제로 다른 prop 수만 센다.
  //   reset 버튼(useHasDirtyStyles)과 동일 baseline 공유 — factory 가 주입한 layout default 는 제외.
  const dirtyProps = useDirtyStyleProps();
  const modifiedCount = dirtyProps.length;
  // 탭 dot 은 "지금 안 보이는 그룹에 수정이 있다" 는 신호 — 배지와 같은 dirty 목록에서 파생.
  const dirtyGroups = useMemo(() => toDirtyGroups(dirtyProps), [dirtyProps]);
  // copy 활성화는 baseline 무관 — 복사 대상은 "현재 inline style 전체"라 키 존재 여부가 기준.
  const hasInlineStyle = useMemo(() => {
    if (!selectedStyle) return false;
    return Object.keys(selectedStyle).some(
      (k) => selectedStyle[k] !== undefined,
    );
  }, [selectedStyle]);
  const isCopyDisabled = !hasInlineStyle;

  const [filter, setFilter] = useState<"all" | "modified">("all");
  const [group, setGroup] = useState<StyleGroupId>("layout");
  const {
    expandAll,
    collapseAll,
    collapsedSections,
    focusMode,
    toggleFocusMode,
  } = useSectionCollapse();
  const { copyStyles, pasteStyles } = useStyleActions();

  // 탭을 누르면 "수정된 속성만" 보기에서 빠져나온다 — 배지 재클릭으로만 다시 들어간다.
  const handleGroupChange = useCallback((key: React.Key) => {
    setGroup(key as StyleGroupId);
    setFilter("all");
  }, []);

  const handleCopyStyles = useCallback(async () => {
    if (!selectedStyle) return;
    await copyStyles(selectedStyle as Record<string, unknown>);
  }, [selectedStyle, copyStyles]);

  const handlePasteStyles = useCallback(async () => {
    await pasteStyles();
  }, [pasteStyles]);

  // ADR-155 Phase 2: Copy/Paste Styles 단축키는 CanvasSelectionShortcuts host 로
  // 이전 (패널 Activity gating 중에도 동작 유지). 핸들러는 툴바 버튼용으로 잔류.
  const shortcuts = useMemo(
    () => [
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
    [toggleFocusMode, collapsedSections, expandAll, collapseAll],
  );

  useKeyboardShortcutsRegistry(shortcuts, [
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
      <PanelHeader
        icon={
          <Palette
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        }
        title={selectedElement?.type ?? "Styles"}
        actions={
          <>
            {focusMode && <span className="focus-mode-indicator">Focus</span>}
            {/* 수정 개수는 아이콘 옆 텍스트 대신 tooltip 으로 — 헤더가 요소 이름과 자리를 다투지 않는다.
                "어느 그룹이 수정됐나" 는 탭 dot 이 답한다. */}
            <ActionIconToggleButton
              isSelected={filter === "modified"}
              onChange={() =>
                setFilter((prev) => (prev === "modified" ? "all" : "modified"))
              }
              aria-label={
                modifiedCount > 0 ? `Modify (${modifiedCount})` : "Modify"
              }
              tooltip={
                modifiedCount > 0
                  ? `수정된 스타일 ${modifiedCount}개`
                  : "수정된 스타일"
              }
            >
              <PencilRuler
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ActionIconToggleButton>
            <ActionIconButton
              onPress={handleCopyStyles}
              aria-label="Copy styles"
              isDisabled={isCopyDisabled}
              tooltip="스타일 복사"
            >
              <CopyIcon
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
              <PasteIcon
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ActionIconButton>
          </>
        }
      />

      <Tabs
        className="styles-panel-groups"
        selectedKey={group}
        onSelectionChange={handleGroupChange}
      >
        <div className="panel-header styles-panel-tabrow">
          <StylesPanelTabs dirtyGroups={dirtyGroups} />
        </div>

        {STYLE_GROUP_IDS.map((id) => (
          <TabPanel key={id} id={id} className="panel-contents">
            {filter === "modified" ? (
              <ModifiedSectionsWrapper />
            ) : (
              <GroupSections group={id} />
            )}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
