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

/**
 * 라벨 보간 인자 — `t(key, params)` 로 그대로 넘어간다.
 */
export type LabelParams = Record<string, string | number | boolean>;

/**
 * 항목은 **키만** 싣는다 — 완성된 문자열은 표시 계층이 `t()` 로 만든다
 * (ADR-200). provider 가 문자열을 들면 그 자리에서 언어를 골라야 하고,
 * 그래서 `한국어 / English` 병기가 굳었다.
 */
export type ContextMenuItem =
  | {
      kind: "action";
      id: string;
      labelKey: string;
      labelParams?: LabelParams;
      icon?: ContextMenuIcon;
      shortcutId?: ShortcutId;
      destructive?: boolean;
      run: () => void | Promise<void>;
    }
  | {
      kind: "toggle";
      id: string;
      labelKey: string;
      labelParams?: LabelParams;
      icon?: ContextMenuIcon;
      checked: boolean;
      shortcutId?: ShortcutId;
      run: () => void | Promise<void>;
    }
  | {
      kind: "submenu";
      id: string;
      labelKey: string;
      labelParams?: LabelParams;
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
