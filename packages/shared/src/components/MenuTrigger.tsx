import {
  MenuTrigger as RACMenuTrigger,
  type MenuTriggerProps as RACMenuTriggerProps,
} from "react-aria-components/Menu";
import type { ReactNode } from "react";

export interface MenuTriggerProps
  extends Omit<RACMenuTriggerProps, "children"> {
  children?: ReactNode;
  /** S2 — where the menu opens; its Popover reads it from this node (`catalogS2OverlayPlacement`). */
  direction?: "bottom" | "top" | "left" | "right" | "start" | "end";
  /** S2 — the menu's alignment to the trigger (with `direction`). */
  align?: "start" | "end";
}

/**
 * RAC MenuTrigger — no element of its own (ADR-256 G5 · the reference: the trigger is the Button
 * itself). RAC gives the trigger Button its press through context (`PressResponder`) and the
 * Popover · Menu theirs (`PopoverContext` · `MenuContext`). The Canvas lays the node out as
 * `display: contents` (its rule).
 */
export function MenuTrigger({
  isOpen,
  defaultOpen,
  onOpenChange,
  trigger,
  children,
  // (The Popover node reads these from the record.)
  direction: _direction,
  align: _align,
}: MenuTriggerProps) {
  return (
    <RACMenuTrigger
      isOpen={isOpen}
      defaultOpen={defaultOpen}
      onOpenChange={onOpenChange}
      trigger={trigger}
    >
      {children}
    </RACMenuTrigger>
  );
}
