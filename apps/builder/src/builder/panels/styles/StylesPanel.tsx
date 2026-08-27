/**
 * StylesPanel - 스타일 편집 패널
 *
 * 섹션 5개(Responsive / Transform / Layout / Appearance / Typography)를 **4개 그룹 탭**으로 묶어
 * 한 번에 한 그룹만 보여준다 (섹션 삭제 없음 — 그룹화만). "수정된 속성만" 뷰도 같은 탭 줄의
 * 5번째 탭이다 — 콘텐츠 영역을 배타적으로 차지하는 뷰를 두 컨트롤이 나눠 쥐지 않게 한다.
 * 뷰 정의·그룹별 dirty 판정은 `constants/styleGroups.ts`, 탭 UI 어법(선택된 탭에만 라벨)은
 * `components/StylesPanelTabs.tsx`.
 *
 * 헤더는 두 줄이다:
 * - 타이틀 줄: 요소 타입 + 스타일 복사/붙여넣기
 * - 탭 줄: 뷰 탭 5개(Layout / Style / Text / Screen / Modified)
 */

import { useState, useMemo, useCallback, memo, type ReactElement } from "react";
import { Tabs, TabPanel } from "react-aria-components";
import { useStore, useDebouncedSelectedElementData } from "../../stores";
import { ActionIconButton } from "../../components/ui";
import { Palette } from "lucide-react";
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
  isStyleGroupId,
  STYLE_VIEW_IDS,
  toDirtyGroups,
  type StyleGroupId,
  type StyleViewId,
} from "./constants/styleGroups";
import { useSectionCollapse } from "./hooks/useSectionCollapse";
import { useStyleActions } from "./hooks/useStyleActions";
import { useDirtyStyleProps } from "./hooks/useResetStyles";
import {
  useKeyboardShortcutsRegistry,
  bindHandlersToDefinitions,
  useActiveScope,
} from "@/builder/hooks";
import { useI18n } from "../../../i18n";
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
  const { t } = useI18n();
  const hasSelectedElement = useStore((s) => s.selectedElementId != null);
  const selectedElement = useDebouncedSelectedElementData();
  const selectedStyle =
    (selectedElement?.style as Record<string, unknown> | undefined) ?? null;
  // 수정 개수는 baseline(factory default / spec preset / subpart)과 실제로 다른 prop 수만 센다.
  //   reset 버튼(useHasDirtyStyles)과 동일 baseline 공유 — factory 가 주입한 layout default 는 제외.
  const dirtyProps = useDirtyStyleProps();
  const modifiedCount = dirtyProps.length;
  // 탭 dot 은 "지금 안 보이는 그룹에 수정이 있다" 는 신호 — 같은 dirty 목록에서 파생.
  const dirtyGroups = useMemo(() => toDirtyGroups(dirtyProps), [dirtyProps]);
  // copy 활성화는 baseline 무관 — 복사 대상은 "현재 inline style 전체"라 키 존재 여부가 기준.
  const hasInlineStyle = useMemo(() => {
    if (!selectedStyle) return false;
    return Object.keys(selectedStyle).some(
      (k) => selectedStyle[k] !== undefined,
    );
  }, [selectedStyle]);
  const isCopyDisabled = !hasInlineStyle;

  const [view, setView] = useState<StyleViewId>("layout");
  const {
    expandAll,
    collapseAll,
    collapsedSections,
    focusMode,
    toggleFocusMode,
  } = useSectionCollapse();
  const { copyStyles, pasteStyles } = useStyleActions();

  const handleViewChange = useCallback((key: React.Key) => {
    setView(key as StyleViewId);
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
  // key/modifier/scope 는 `SHORTCUT_DEFINITIONS` 가 정본이다. 종전에는 여기서
  // 손으로 적으면서 scope 를 빠뜨려, registry 가 global 로 간주해 모달 위에서도
  // 동작했다 — 게다가 ⌥S 가 정렬(⌥S, canvas-focused)과 같은 조합이 된다.
  const activeScope = useActiveScope();
  const shortcuts = useMemo(
    () =>
      bindHandlersToDefinitions(["toggleFocusMode", "toggleSections"], {
        toggleFocusMode,
        toggleSections: () => {
          const allCollapsed = collapsedSections.size === 4;
          if (allCollapsed) {
            expandAll();
          } else {
            collapseAll();
          }
        },
      }),
    [toggleFocusMode, collapsedSections, expandAll, collapseAll],
  );

  useKeyboardShortcutsRegistry(shortcuts, [shortcuts], { activeScope });

  if (!hasSelectedElement) {
    return <EmptyState message={t("styles.selectElement")} />;
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
        title={selectedElement?.type ?? t("panels.styles")}
        actions={
          <>
            {focusMode && (
              <span className="focus-mode-indicator">{t("styles.focus")}</span>
            )}
            <ActionIconButton
              onPress={handleCopyStyles}
              aria-label={t("styles.copyStyles")}
              isDisabled={isCopyDisabled}
              tooltip={t("styles.copyStyles")}
              shortcutId="copyStyles"
            >
              <CopyIcon
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ActionIconButton>
            <ActionIconButton
              onPress={handlePasteStyles}
              aria-label={t("styles.pasteStyles")}
              tooltip={t("styles.pasteStyles")}
              shortcutId="pasteStyles"
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
        selectedKey={view}
        onSelectionChange={handleViewChange}
      >
        <div className="panel-header styles-panel-tabrow">
          <StylesPanelTabs
            dirtyGroups={dirtyGroups}
            modifiedCount={modifiedCount}
          />
        </div>

        {STYLE_VIEW_IDS.map((id) => (
          <TabPanel key={id} id={id} className="panel-contents">
            {isStyleGroupId(id) ? (
              <GroupSections group={id} />
            ) : (
              <ModifiedSectionsWrapper />
            )}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
