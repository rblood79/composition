import type { ActionIcon } from "../../../config/actionIcons";
import type { ShortcutId } from "../../../config/keyboardShortcuts";

/**
 * 항목 앞 아이콘 — lucide 컴포넌트를 **참조로** 받는다.
 *
 * provider 는 `.ts` 라 JSX 를 쓸 수 없어 `ReactNode` 가 아니라 컴포넌트 타입이다.
 * 크기·색은 오버레이와 CSS(`.context-menu-item svg`)가 정하므로 provider 는
 * 어떤 아이콘인지만 고른다.
 *
 * 여러 화면에 공통으로 나오는 액션은 `ACTION_ICONS` 에서 고른다 — 낱개 lucide
 * 심볼을 직접 집으면 다른 진입점과 갈린다 (`config/actionIcons.ts` §왜 필요한가).
 */
export type ContextMenuIcon = ActionIcon;

export type ContextMenuSurface =
  | "canvas-element"
  | "canvas-empty"
  | "layer-item";

export interface ContextMenuRequest {
  surface: ContextMenuSurface;
  clientX: number;
  clientY: number;
  scenePoint?: { x: number; y: number };
  targetElementIds: string[];
}

export type ContextMenuItem =
  | {
      kind: "action";
      id: string;
      label: string;
      icon?: ContextMenuIcon;
      shortcutId?: ShortcutId;
      destructive?: boolean;
      run: () => void | Promise<void>;
    }
  | {
      kind: "toggle";
      id: string;
      label: string;
      icon?: ContextMenuIcon;
      checked: boolean;
      shortcutId?: ShortcutId;
      run: () => void | Promise<void>;
    }
  | {
      kind: "submenu";
      id: string;
      label: string;
      icon?: ContextMenuIcon;
      items: ContextMenuItem[];
    }
  | { kind: "separator"; id: string };

export type ContextMenuProvider = (
  request: ContextMenuRequest,
  deps: ContextMenuDeps,
) => ContextMenuItem[];

export type ContextMenuModeOverride = (
  request: ContextMenuRequest,
) => ContextMenuItem[] | null;

export interface ContextMenuDeps {
  modeOverride?: ContextMenuModeOverride;
}

export interface ContextMenuState {
  request: ContextMenuRequest | null;
  isOpen: boolean;
}

export interface ContextMenuController {
  state: ContextMenuState;
  open: (request: ContextMenuRequest) => void;
  close: () => void;
}
