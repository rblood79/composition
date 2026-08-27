/**
 * ADR-192 Contextual Action Bar — 캔버스 하단 중앙 플로팅 (Photoshop 모델).
 *
 * - 항목: ADR-182 provider 정본의 부분집합 (`buildActionBarItems`) — 액션 신규 0
 * - ⋯ : 182 컨텍스트 메뉴를 버튼 위치에서 그대로 연다
 * - 적격 항목 0 / 텍스트 편집 중 / Hide → 미마운트 (Photoshop 자동 숨김)
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
import { useCallback, useEffect, useState } from "react";
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
import { focusCanvasContainer } from "../../../hooks/useActiveScope";
import { useContextMenu } from "../contextMenu";
import type { ContextMenuItem } from "../contextMenu/types";
import { ShortcutTooltip } from "../ShortcutTooltip";
import type { ActionBarModel } from "./actionBarPolicy";
import { buildActionBarItems } from "./buildActionBarItems";
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
  const isEditing = useCanvasStore((state) => state.isEditing);
  const selectedElementIds = useStore((state) => state.selectedElementIds);
  // `elements` 배열은 요소 변경(컴포넌트 토글·재부모화·삭제)마다 교체된다 —
  // 항목 라벨/조건이 갈리는 모든 경우를 덮는 가장 단순한 재산출 트리거.
  //
  // 2026-08-27 code-review #15 는 이 트리거가 과하다고 봤으나, 실측에서 비용이
  // 성립하지 않아 그대로 둔다 (live, 55 요소 프로젝트):
  //   - 캔버스 텍스트 편집 중 타이핑 10자 → `elements` identity 변경 0회
  //     (초안이 로컬이라 store 를 건드리지 않는다 — 키 입력당 재산출 없음)
  //   - 요소 드래그 → 0회 (드롭 시 1회 commit, 위 서술대로)
  //   - 속성 1건 확정(Gap) → 2회. 재산출 1회의 O(N) 부분은 provider 의
  //     `hasReorderableSiblings` 형제 탐색뿐이고 같은 형태를 재면 55개 0.0015ms /
  //     5,000개 0.049ms — 5,000 요소 문서의 편집 1회 비용 205ms 대비 무시 가능.
  // 트리거를 좁히면 라벨이 낡을 위험만 커진다.
  const elements = useStore((state) => state.elements);
  // undo 로 선택 대상이 사라진 경우(그룹 해제 등) — 선택 id 가 문서에 없으면
  // 182 provider 가 interactive map 잔상으로 항목을 만들 수 있어 바를 내린다.
  const selectionResolved = useStore((state) =>
    state.selectedElementIds.every((id) => state.elementsMap.has(id)),
  );
  const contextMenu = useContextMenu();
  const placement = useActionBarPlacement();

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
      // RAC Menu 는 닫힘(exit 애니메이션 ~80ms) 뒤 FocusScope 가 포커스를
      // 복원하는데 그 결과가 body 라 `canvas-focused` scope 가 풀린다 (Phase 3
      // live). 동기 focus() 는 그 복원에 덮이므로 (Phase 4 live) 복원 이후로
      // 미뤄 캔버스 컨테이너로 되돌린다.
      window.setTimeout(focusCanvasContainer, 150);
    },
    [placement],
  );

  if (placement.hidden || isEditing || !model) return null;

  return (
    <div
      ref={placement.barRef}
      className="contextual-action-bar"
      onMouseDown={keepCanvasFocus}
      data-shortcut-scope="global"
      onKeyDown={returnFocusOnEscape}
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
          onPress={(event) => openOverflow(event.target)}
        >
          <MoreHorizontal size={ICON_SIZE} aria-hidden="true" />
        </Button>
        <OptionsMenu pinned={placement.pinned} onAction={onOption} />
      </Toolbar>
    </div>
  );
}
