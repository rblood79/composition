import type { PrimitiveBinding } from "../types";

/**
 * Keyboard — a keyboard shortcut (ADR-256 Phase 5g — reference `MenuItem > (… + Keyboard)`). DOM is
 * RAC `Keyboard` (`<kbd>`): in a MenuItem it takes the item's `KeyboardContext` (its id — the item's
 * `aria-describedby`); elsewhere it is a plain `<kbd>`.
 *
 * D1: RAC's `Keyboard` as is.
 * D2: its text (`children`) only.
 * D3: the key chip (`COMPONENT_RULES_TABLE.Keyboard` — the reference `Menu.css` `kbd`).
 */
export const keyboardBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "keyboard",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
    },
    toRacProps: "default",
  },
};
