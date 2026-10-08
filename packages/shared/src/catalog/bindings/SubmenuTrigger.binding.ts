import type { PrimitiveBinding } from "../types";

/**
 * SubmenuTrigger — a menu item that opens a submenu (ADR-256 Phase 5g — reference `SubmenuTrigger >
 * MenuItem + Popover > Menu`). DOM is RAC `SubmenuTrigger`: its first child is the item (RAC gives it
 * `aria-haspopup` — the item's `hasSubmenu`), its second the Popover holding the submenu's Menu.
 *
 * D1: RAC's `SubmenuTrigger` as is — no element of its own.
 * D2: no props of its own.
 * D3: none — the item and the Popover keep their own rules.
 */
export const submenuTriggerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "submenutrigger",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
