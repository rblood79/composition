/**
 * ADR-192 Contextual Action Bar — 선택 page 하단 중앙 플로팅.
 *
 * - 항목: ADR-182 provider 정본의 부분집합 (`buildActionBarItems`) — 액션 신규 0
 * - ⋯ : 182 컨텍스트 메뉴를 버튼 위치에서 그대로 연다
 * - 빈 선택 / 텍스트 편집 중 / Hide → 미마운트. page 단독 선택은 page chrome을
 *   표시하고 요소 액션은 노출하지 않는다.
 * - 재렌더 트리거는 선택 집합 + store `elements` 교체뿐 — 드래그 중 좌표는
 *   Skia 프리뷰가 들고 드롭 시 1회 commit 되므로 프레임 루프와 무관 (HC2)
 * - 포커스: 루트 mousedown `preventDefault` + `preventFocusOnPress` 라 마우스
 *   조작은 (버튼이든 여백이든) 포커스를 옮기지 않아
 *   캔버스가 `canvas-focused` scope 를 유지한다 (HC3). 키보드로 진입한 동안은
 *   루트가 선언한 `data-shortcut-scope="global"` 이 우선이라 캔버스 단축키
 *   (←/→ 형제 재배치 · Escape 선택 해제) 가 툴바 탐색을 덮지 않고, Escape 는
 *   선택을 유지한 채 캔버스로 되돌린다 (R2)
 * - 배치: 좌측 핸들 드래그 · 옵션 메뉴 (Pin / Reset / Hide) — Photoshop
 *   Contextual Task Bar 의 ⋯ 메뉴 동형 (Phase 3, `useActionBarPlacement`)
 */
import { memo, useCallback, useState } from "react";
import {
  ChevronDown,
  EllipsisVertical,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Pin,
  PinOff,
} from "lucide-react";
import { Menu, MenuItem, MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { Button, Toolbar } from "@composition/shared/components";
import { useI18n } from "@/i18n";
import { focusCanvasContainer } from "../../../hooks/useActiveScope";
import type { ContextMenuItem } from "../contextMenu/types";
import { ShortcutTooltip } from "../ShortcutTooltip";
import type { ActionBarModel } from "./actionBarPolicy";
import type { ActionBarPageRectOf } from "./useActionBarPlacement";
import { ACTION_ICONS } from "../../../config/actionIcons";

const ResetIcon = ACTION_ICONS.reset;
import { useActionBarPlacement } from "./useActionBarPlacement";
import "./actionBar.css";

const ICON_SIZE = 16;
const MENU_ICON_SIZE = 14;

// ADR-192 R2 — 키보드로 진입한 툴바에서 Escape 는 "캔버스로 복귀"다.
// 루트가 `data-shortcut-scope="global"` 을 선언해 전역 escape(선택 해제)가
// 이 상황에서 동작하지 않으므로 여기서 포커스만 되돌린다. 선택은 유지된다
// — 선택이 풀리면 바 자체가 언마운트돼 툴바를 떠날 방법이 사라진다
// (2026-08-27 code-review #8).
function returnFocusOnEscape(event: React.KeyboardEvent): void {
  if (event.key !== "Escape") return;
  event.preventDefault();
  event.stopPropagation();
  focusCanvasContainer();
}

// 바 chrome(루트 padding · 툴바 gap · separator · 툴팁 wrapper) 은 포커스를
// 받을 수 없어서, 여기를 클릭하면 캔버스가 포커스를 잃고 body 로 떨어진다 —
// 그 순간 `canvas-focused` 단축키(⌫ · 화살표 · ⌘G …) 가 통째로 침묵한다
// (2026-08-27 code-review #7). 버튼은 이미 `preventFocusOnPress` 라 마우스로
// 포커스를 옮기지 않으므로, 바 전체가 같은 규약을 따르게 한다.
// (click 은 그대로 동작한다 — mousedown 의 기본 포커스 이동만 막는다.)
function keepCanvasFocus(event: React.MouseEvent): void {
  event.preventDefault();
}

/** 항목은 키만 싣는다 — 바가 그리는 문자열은 여기서 만든다 (ADR-200). */
function useItemLabel(item: ContextMenuItem): string {
  const { t } = useI18n();
  return item.kind === "separator" ? "" : t(item.labelKey, item.labelParams);
}

function ItemIcon({ item }: { item: ContextMenuItem }) {
  const label = useItemLabel(item);
  const Icon = item.kind === "separator" ? undefined : item.icon;
  if (item.kind === "separator") return null;
  if (!Icon) return <span>{label}</span>;
  return <Icon size={ICON_SIZE} aria-hidden="true" />;
}

const ActionButton = memo(function ActionButton({
  item,
}: {
  item: ContextMenuItem;
}) {
  const label = useItemLabel(item);
  if (item.kind !== "action" && item.kind !== "toggle") return null;
  const button = (
    <Button
      variant="ghost"
      size="S"
      className="contextual-action-bar-item"
      aria-label={label}
      preventFocusOnPress
      onPress={() => {
        void item.run();
      }}
    >
      <ItemIcon item={item} />
    </Button>
  );
  if (!item.shortcutId) return button;
  return (
    <ShortcutTooltip shortcutId={item.shortcutId} label={label} placement="top">
      {button}
    </ShortcutTooltip>
  );
});

/** 정렬 서브메뉴 → 4×2 아이콘 popover (A1) */
function AlignPopover({
  item,
}: {
  item: Extract<ContextMenuItem, { kind: "submenu" }>;
}) {
  const { t } = useI18n();
  const label = useItemLabel(item);
  const runnable = item.items.filter(
    (child): child is Extract<ContextMenuItem, { kind: "action" }> =>
      child.kind === "action",
  );
  const onAction = useCallback(
    (key: React.Key) => {
      const target = runnable.find((child) => child.id === String(key));
      if (target) void target.run();
    },
    [runnable],
  );
  return (
    <MenuTrigger>
      <Button
        variant="ghost"
        size="S"
        className="contextual-action-bar-item"
        data-context="multi"
        aria-label={label}
        preventFocusOnPress
      >
        <ItemIcon item={item} />
        <ChevronDown size={12} aria-hidden="true" />
      </Button>
      <Popover
        placement="top"
        offset={6}
        className="contextual-action-bar-align-popover"
      >
        <Menu
          aria-label={label}
          className="contextual-action-bar-align-grid"
          onAction={onAction}
        >
          {runnable.map((child) => (
            <MenuItem
              key={child.id}
              id={child.id}
              aria-label={t(child.labelKey, child.labelParams)}
            >
              <ItemIcon item={child} />
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

type OptionKey = "pin" | "reset" | "hide";

const OptionsMenu = memo(function OptionsMenu({
  pinned,
  onAction,
}: {
  pinned: boolean;
  onAction: (key: OptionKey) => void;
}) {
  const { t } = useI18n();
  const PinIcon = pinned ? PinOff : Pin;
  return (
    <MenuTrigger>
      <Button
        variant="ghost"
        size="S"
        className="contextual-action-bar-item"
        aria-label={t("actionBar.options")}
        preventFocusOnPress
      >
        <EllipsisVertical size={ICON_SIZE} aria-hidden="true" />
      </Button>
      <Popover
        placement="top end"
        offset={6}
        className="contextual-action-bar-options-popover"
      >
        <Menu
          aria-label={t("actionBar.options")}
          className="contextual-action-bar-options"
          onAction={(key) => onAction(String(key) as OptionKey)}
        >
          <MenuItem id="pin" className="contextual-action-bar-option">
            <PinIcon size={MENU_ICON_SIZE} aria-hidden="true" />
            <span>{pinned ? t("actionBar.unpin") : t("actionBar.pin")}</span>
          </MenuItem>
          <MenuItem id="reset" className="contextual-action-bar-option">
            <ResetIcon size={MENU_ICON_SIZE} aria-hidden="true" />
            <span>{t("actionBar.reset")}</span>
          </MenuItem>
          <MenuItem id="hide" className="contextual-action-bar-option">
            <EyeOff size={MENU_ICON_SIZE} aria-hidden="true" />
            <span>{t("actionBar.hide")}</span>
          </MenuItem>
        </Menu>
      </Popover>
    </MenuTrigger>
  );
});

/** What the bar shows and runs — the old stores' selection, or the catalog Builder's. */
export interface ActionBarSource {
  isEditing: boolean;
  selectedIds: readonly string[];
  /** One page body selected: page chrome only (More + placement options). */
  pageSelection: boolean;
  /** The page the bar anchors below (automatic placement). */
  selectedPageId: string | null;
  /** Every selected id is in the document (an undo can take one away). */
  resolved: boolean;
  model: ActionBarModel | null;
  /** ⋯ — open the full context menu at the button. */
  openOverflow: (target: Element | null) => void;
  /** Page frames in scene px (the catalog's; absent = the old stores' page positions). */
  pageRectOf: ActionBarPageRectOf;
}

export function ActionBarView({
  isEditing,
  pageSelection,
  selectedPageId,
  resolved: selectionResolved,
  model,
  openOverflow,
  pageRectOf,
}: ActionBarSource) {
  const { t } = useI18n();
  const [barNode, setBarNode] = useState<HTMLDivElement | null>(null);
  const [handleNode, setHandleNode] = useState<HTMLElement | null>(null);
  const attachBar = useCallback((node: HTMLDivElement | null) => {
    setBarNode(node);
  }, []);
  const attachHandle = useCallback((node: HTMLElement | null) => {
    setHandleNode(node);
  }, []);
  const placement = useActionBarPlacement(selectedPageId, {
    barNode,
    handleNode,
    pageRectOf,
  });
  // 요소→page 전환 직후 effect가 이전 요소 model을 비우기 전에도 stale 액션을
  // 한 commit 노출하지 않는다. page context는 More + 위치 옵션만 사용한다.
  const visibleModel = pageSelection ? null : model;

  const { togglePinned, resetPosition, hide } = placement;
  const onOption = useCallback(
    (key: OptionKey) => {
      if (key === "pin") togglePinned();
      else if (key === "reset") resetPosition();
      else hide();
      // RAC Menu 는 닫힘(exit 애니메이션 ~80ms) 뒤 FocusScope 가 포커스를
      // 복원하는데 그 결과가 body 라 `canvas-focused` scope 가 풀린다 (Phase 3
      // live). 동기 focus() 는 그 복원에 덮이므로 (Phase 4 live) 복원 이후로
      // 미뤄 캔버스 컨테이너로 되돌린다.
      window.setTimeout(focusCanvasContainer, 150);
    },
    [togglePinned, resetPosition, hide],
  );

  if (
    placement.hidden ||
    isEditing ||
    !selectionResolved ||
    (!visibleModel && !pageSelection)
  )
    return null;

  return (
    <div
      ref={attachBar}
      className="contextual-action-bar"
      onMouseDown={keepCanvasFocus}
      data-shortcut-scope="global"
      onKeyDown={returnFocusOnEscape}
      data-dragging={placement.dragging || undefined}
      data-pinned={placement.pinned || undefined}
      data-context={visibleModel?.context ?? "page"}
      style={placement.style}
    >
      <span
        ref={attachHandle}
        className="contextual-action-bar-handle"
        title={t("actionBar.dragHandle")}
        aria-hidden="true"
      >
        <GripVertical size={MENU_ICON_SIZE} />
      </span>
      <Toolbar
        aria-label={t("actionBar.ariaLabel")}
        className="contextual-action-bar-toolbar"
      >
        {visibleModel?.items.map((item) =>
          item.kind === "submenu" ? (
            <AlignPopover key={item.id} item={item} />
          ) : (
            <ActionButton key={item.id} item={item} />
          ),
        )}
        {visibleModel && (
          <span
            className="contextual-action-bar-separator"
            aria-hidden="true"
          />
        )}
        <Button
          variant="ghost"
          size="S"
          className="contextual-action-bar-item"
          aria-label={t("actionBar.more")}
          preventFocusOnPress
          onPress={(event) => openOverflow(event.target)}
        >
          <MoreHorizontal size={ICON_SIZE} aria-hidden="true" />
        </Button>
        <OptionsMenu pinned={placement.pinned} onAction={onOption} />
      </Toolbar>
    </div>
  );
}
