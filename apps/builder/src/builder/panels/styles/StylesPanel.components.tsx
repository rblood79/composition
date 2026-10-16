/**
 * StylesPanel - 스타일 편집 뷰 (ADR-252: Design 패널의 Layout · Style · Text · Screen 탭)
 *
 * 절 (Size · Position · Layout · Spacing / Fill · Border · Effect / Typography / Responsive) 을 **4개 그룹 탭**으로 묶어
 * 한 번에 한 그룹만 보여준다 (섹션 삭제 없음 — 그룹화만). 「수정된 속성만」 뷰 (Modified 탭) 는
 * ADR-252 에서 뺐다 (사용자 2026-10-04) — 그룹 탭 dot · 섹션 reset 이 같은 dirty 판정을 쓴다.
 * 그룹 정의·그룹별 dirty 판정은 `constants/styleGroups.ts`, 탭 UI 어법(선택된 탭에만 라벨)은
 * `components/StylesPanelTabs.tsx`.
 *
 * 패널 (헤더 · 탭 줄 · 탭 상태) 은 `panels/design/DesignPanel.tsx` 가 소유한다. 이 파일은 스타일
 * 탭의 본문 (`StylesTabBody`) · 헤더 액션 (`StylesHeaderActions`) · 단축키 등록부
 * (`StylesTabShortcuts`) · 탭 표시 (`useStylesTabMarks`) 를 준다.
 */

import { PaintRoller } from "lucide-react";

import { memo, useCallback, useMemo, type ReactElement } from "react";

import { useI18n } from "../../../i18n";

import { iconProps } from "../../../utils/ui/uiConstants";

import { EmptyState } from "../../components/feedback/EmptyState";

import { ActionIconButton } from "../../components/ui";

import { ACTION_ICONS } from "../../config/actionIcons";

import { useActiveScope } from "../../hooks/useActiveScope";

import {
  bindHandlersToDefinitions,
  useKeyboardShortcutsRegistry,
} from "../../hooks/useKeyboardShortcutsRegistry";

import "./StylesPanel.css";

import { type StyleGroupId } from "./constants/styleGroups";

import {
  STYLE_PANEL_SECTION_IDS,
  useSectionCollapse,
  useSectionGroupToggle,
} from "./hooks/useSectionCollapse";

import { useStyleActions } from "./hooks/useStyleActions";

import {
  BorderSection,
  EffectSection,
  FillSection,
  LayoutSection,
  PositionSection,
  ResponsiveSection,
  SizeSection,
  SpacingSection,
  TypographySection,
} from "./sections";

import { useStylesSelection } from "./StylesPanel.runtime";

import { catalogElementlessType } from "../../../../../../packages/shared/src/catalog/runtime/elementless";

// 절 순서 Layout → Size → Spacing → Position (panel-ui 01 — 대조 B1): Position 은 접힌 채 마지막.
// grid 의 열 · 행 목록은 Layout 탭에 두지 않는다 — Canvas 에서 열 · 행을 고르면 Design 패널이 「격자」
// 보기로 바뀐다 (Figma, 사용자 2026-10-16 — `panels/design/DesignPanel.tsx` GridTrackView).
const LayoutGroupSections = memo(function LayoutGroupSections() {
  return (
    <>
      <LayoutSection />
      <SizeSection />
      <SpacingSection />
      <PositionSection />
    </>
  );
});

const StyleGroupSections = memo(function StyleGroupSections() {
  return (
    <>
      <FillSection />
      <BorderSection />
      <EffectSection />
    </>
  );
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

/** 스타일 탭 본문 (탭의 `.panel-contents` 안). 빈 선택 · sub-part 는 탭 본문만 안내로 바꾼다. */
export const StylesTabBody = memo(function StylesTabBody({
  view,
}: {
  view: StyleGroupId;
}) {
  const { t } = useI18n();
  const {
    hasSelectedElement,
    selectedElement,
    selectedSubpartOwnerType,
    delegatedSubpart,
  } = useStylesSelection();

  if (!hasSelectedElement) {
    return (
      <EmptyState
        icon={<PaintRoller size={32} />}
        message={t("styles.selectElement")}
      />
    );
  }

  if (delegatedSubpart && selectedElement) {
    return (
      <EmptyState
        icon={<PaintRoller size={32} />}
        message={t("styles.delegatedSubpartMessage")}
        description={t("styles.delegatedSubpartDescription", {
          type: selectedElement.type,
          parent: selectedSubpartOwnerType ?? "",
        })}
      />
    );
  }

  // A node RAC renders without an element (MenuTrigger …) has no box: its layout · style · text
  // reach no consumer. Its breakpoint visibility (Screen) hides its children, so that view stays.
  if (
    view !== "screen" &&
    selectedElement &&
    catalogElementlessType(selectedElement.type)
  ) {
    return (
      <EmptyState
        icon={<PaintRoller size={32} />}
        message={t("styles.elementlessMessage")}
        description={t("styles.elementlessDescription", {
          type: selectedElement.type,
        })}
      />
    );
  }

  return <GroupSections group={view} />;
});

/** 스타일 탭의 헤더 액션 — focus 표시 + 스타일 복사 / 붙여넣기. */
export function StylesHeaderActions() {
  const { t } = useI18n();
  const { selectedElement, delegatedSubpart } = useStylesSelection();
  const selectedStyle =
    (selectedElement?.style as Record<string, unknown> | undefined) ?? null;
  // copy 활성화는 baseline 무관 — 복사 대상은 "현재 inline style 전체"라 키 존재 여부가 기준.
  const hasInlineStyle = useMemo(() => {
    if (!selectedStyle) return false;
    return Object.keys(selectedStyle).some(
      (k) => selectedStyle[k] !== undefined,
    );
  }, [selectedStyle]);
  const isCopyDisabled = !hasInlineStyle;
  const focusMode = useSectionCollapse((s) => s.focusMode);
  const { copyStyles, pasteStyles } = useStyleActions();

  const handleCopyStyles = useCallback(async () => {
    if (!selectedStyle) return;
    await copyStyles(selectedStyle as Record<string, unknown>);
  }, [selectedStyle, copyStyles]);

  const handlePasteStyles = useCallback(async () => {
    await pasteStyles();
  }, [pasteStyles]);

  if (!selectedElement || delegatedSubpart) return null;
  return (
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
  );
}

/**
 * ⌥⇧S focus mode · ⌥⇧E 전체 섹션 토글 — 스타일 탭이 활성일 때만 마운트된다 (ADR-252).
 * key/modifier/scope 는 `SHORTCUT_DEFINITIONS` 가 정본이다. 종전에는 여기서
 * 손으로 적으면서 scope 를 빠뜨려, registry 가 global 로 간주해 모달 위에서도
 * 동작했다 — 게다가 ⌥S 가 정렬(⌥S, canvas-focused)과 같은 조합이 된다.
 * ⌥S 전체 토글 — Styles 절 (STYLE_PANEL_SECTION_IDS) 만 id 집합으로 판정·조작한다. 종전에는 접힌 섹션의
 * 개수를 세어 판정해 다른 패널 섹션이 하나라도 접혀 있으면 영원히 거짓이었고, 펼칠 때
 * 전 패널의 접힘 상태를 지웠다.
 */
export function StylesTabShortcuts() {
  const toggleFocusMode = useSectionCollapse((s) => s.toggleFocusMode);
  const { toggle: toggleStyleSections } = useSectionGroupToggle(
    STYLE_PANEL_SECTION_IDS,
  );
  const activeScope = useActiveScope();
  const shortcuts = useMemo(
    () =>
      bindHandlersToDefinitions(["toggleFocusMode", "toggleSections"], {
        toggleFocusMode,
        toggleSections: toggleStyleSections,
      }),
    [toggleFocusMode, toggleStyleSections],
  );

  useKeyboardShortcutsRegistry(shortcuts, [shortcuts], { activeScope });
  return null;
}
const { copy: CopyIcon, paste: PasteIcon } = ACTION_ICONS;
