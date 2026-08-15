import type { ShortcutId } from "../../../config/keyboardShortcuts";

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
      shortcutId?: ShortcutId;
      destructive?: boolean;
      run: () => void | Promise<void>;
    }
  | {
      kind: "toggle";
      id: string;
      label: string;
      checked: boolean;
      shortcutId?: ShortcutId;
      run: () => void | Promise<void>;
    }
  | {
      kind: "submenu";
      id: string;
      label: string;
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
