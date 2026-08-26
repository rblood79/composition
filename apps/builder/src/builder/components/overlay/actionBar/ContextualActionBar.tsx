/**
 * ADR-192 Contextual Action Bar — 캔버스 하단 중앙 플로팅 (Photoshop 모델).
 *
 * - 항목: ADR-182 provider 정본의 부분집합 (`buildActionBarItems`) — 액션 신규 0
 * - ⋯ : 182 컨텍스트 메뉴를 버튼 위치에서 그대로 연다
 * - 적격 항목 0 / 텍스트 편집 중 / Hide → 미마운트 (Photoshop 자동 숨김)
 * - 재렌더 트리거는 선택 집합 + store `elements` 교체뿐 — 드래그 중 좌표는
 *   Skia 프리뷰가 들고 드롭 시 1회 commit 되므로 프레임 루프와 무관 (HC2)
 * - 포커스: 루트 `data-scope="canvas"` + `preventFocusOnPress` 로
 *   `canvas-focused` 단축키 scope 유지 (HC3)
 * - 배치: 좌측 핸들 드래그 · 옵션 메뉴 (Pin / Reset / Hide) — Photoshop
 *   Contextual Task Bar 의 ⋯ 메뉴 동형 (Phase 3, `useActionBarPlacement`)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  EllipsisVertical,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Pin,
  PinOff,
  RotateCcw,
} from "lucide-react";
import { Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { Button, Toolbar } from "@composition/shared/components";
import { useI18n } from "@/i18n";
import { useStore } from "../../../stores";
import { useCanvasStore } from "../../../stores/canvasStore";
import { useContextMenu } from "../contextMenu";
import type { ContextMenuItem } from "../contextMenu/types";
import { ShortcutTooltip } from "../ShortcutTooltip";
import type { ActionBarModel } from "./actionBarPolicy";
import { buildActionBarItems } from "./buildActionBarItems";
import { useActionBarPlacement } from "./useActionBarPlacement";
import "./actionBar.css";

const ICON_SIZE = 16;
const MENU_ICON_SIZE = 14;

function ItemIcon({ item }: { item: ContextMenuItem }) {
  if (item.kind === "separator") return null;
  const Icon = item.icon;
  if (!Icon) return <span>{item.label}</span>;
  return <Icon size={ICON_SIZE} aria-hidden="true" />;
}

function ActionButton({ item }: { item: ContextMenuItem }) {
  if (item.kind !== "action" && item.kind !== "toggle") return null;
  const button = (
    <Button
      variant="ghost"
      size="sm"
      className="contextual-action-bar-item"
      aria-label={item.label}
      preventFocusOnPress
      data-scope="canvas"
      onPress={() => {
        void item.run();
      }}
    >
      <ItemIcon item={item} />
    </Button>
  );
  if (!item.shortcutId) return button;
  return (
    <ShortcutTooltip
      shortcutId={item.shortcutId}
      label={item.label}
      placement="top"
    >
      {button}
    </ShortcutTooltip>
  );
}

/** 정렬 서브메뉴 → 4×2 아이콘 popover (A1) */
function AlignPopover({
  item,
}: {
  item: Extract<ContextMenuItem, { kind: "submenu" }>;
}) {
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
        size="sm"
        className="contextual-action-bar-item"
        data-context="multi"
        aria-label={item.label}
        preventFocusOnPress
        data-scope="canvas"
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
          aria-label={item.label}
          className="contextual-action-bar-align-grid"
          onAction={onAction}
        >
          {runnable.map((child) => (
            <MenuItem key={child.id} id={child.id} aria-label={child.label}>
              <ItemIcon item={child} />
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

type OptionKey = "pin" | "reset" | "hide";

function OptionsMenu({
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
        size="sm"
        className="contextual-action-bar-item"
        aria-label={t("actionBar.options")}
        preventFocusOnPress
        data-scope="canvas"
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
            <RotateCcw size={MENU_ICON_SIZE} aria-hidden="true" />
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
}

export function ContextualActionBar() {
  const { t } = useI18n();
  const barRef = useRef<HTMLDivElement>(null);
  const isEditing = useCanvasStore((state) => state.isEditing);
  const selectedElementIds = useStore((state) => state.selectedElementIds);
  // `elements` 배열은 요소 변경(컴포넌트 토글·재부모화·삭제)마다 교체된다 —
  // 항목 라벨/조건이 갈리는 모든 경우를 덮는 가장 단순한 재산출 트리거.
  // 드래그 중에는 store 가 갱신되지 않아(드롭 시 1회 commit) 프레임 루프와 무관.
  const elements = useStore((state) => state.elements);
  // undo 로 선택 대상이 사라진 경우(그룹 해제 등) — 선택 id 가 문서에 없으면
  // 182 provider 가 interactive map 잔상으로 항목을 만들 수 있어 바를 내린다.
  const selectionResolved = useStore((state) =>
    state.selectedElementIds.every((id) => state.elementsMap.has(id)),
  );
  const contextMenu = useContextMenu();
  const placement = useActionBarPlacement(barRef);

  // 182 provider 는 BuilderCanvas 의 interactive map 을 읽는데, 그 ref 는
  // BuilderCanvas 의 useEffect(BuilderCanvas.tsx:756) 에서 갱신된다. 같은 store
  // 변경에 대해 render 단계(useMemo)에서 읽으면 한 단계 낡은 map 을 보므로
  // (live 실측: 컴포넌트 토글 라벨이 한 클릭 늦게 바뀜) commit 이후 effect 에서
  // 산출한다 — BuilderCanvas 가 앞선 형제라 그 effect 가 먼저 실행된다.
  const [model, setModel] = useState<ActionBarModel | null>(null);
  useEffect(() => {
    setModel(
      selectionResolved ? buildActionBarItems(selectedElementIds) : null,
    );
    // elements 는 재산출 트리거로만 쓴다 (항목 산출은 182 provider 가 담당)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementIds, selectionResolved, elements]);

  const openOverflow = useCallback(
    (target: Element | null) => {
      const rect = target?.getBoundingClientRect();
      contextMenu.open({
        surface: "canvas-element",
        clientX: rect ? rect.left : 0,
        clientY: rect ? rect.top : 0,
        targetElementIds: [...selectedElementIds],
      });
    },
    [contextMenu, selectedElementIds],
  );

  const onOption = useCallback(
    (key: OptionKey) => {
      if (key === "pin") placement.togglePinned();
      else if (key === "reset") placement.resetPosition();
      else placement.hide();
    },
    [placement],
  );

  if (placement.hidden || isEditing || !model) return null;

  return (
    <div
      ref={barRef}
      className="contextual-action-bar"
      data-scope="canvas"
      data-dragging={placement.dragging || undefined}
      data-pinned={placement.pinned || undefined}
      style={{ transform: placement.transform }}
    >
      <span
        className="contextual-action-bar-handle"
        title={t("actionBar.dragHandle")}
        aria-hidden="true"
        {...placement.handleProps}
      >
        <GripVertical size={MENU_ICON_SIZE} />
      </span>
      <Toolbar
        aria-label={t("actionBar.ariaLabel")}
        className="contextual-action-bar-toolbar"
      >
        {model.items.map((item) =>
          item.kind === "submenu" ? (
            <AlignPopover key={item.id} item={item} />
          ) : (
            <ActionButton key={item.id} item={item} />
          ),
        )}
        <span className="contextual-action-bar-separator" aria-hidden="true" />
        <Button
          variant="ghost"
          size="sm"
          className="contextual-action-bar-item"
          aria-label={t("actionBar.more")}
          preventFocusOnPress
          data-scope="canvas"
          onPress={(event) => openOverflow(event.target)}
        >
          <MoreHorizontal size={ICON_SIZE} aria-hidden="true" />
        </Button>
        <OptionsMenu pinned={placement.pinned} onAction={onOption} />
      </Toolbar>
    </div>
  );
}
