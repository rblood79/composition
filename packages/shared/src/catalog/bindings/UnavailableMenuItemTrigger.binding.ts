import type { PrimitiveBinding } from "../types";

/**
 * UnavailableMenuItemTrigger — S2 `UnavailableMenuItemTrigger` (S2 체크리스트 §9.3, 2026-11-23): a menu
 * item that is unavailable opens a help popover in place of its action (`Menu.tsx:1074-1091`). Its
 * first child is the MenuItem, its second the Popover holding the help (S2 `ContextualHelpPopover` —
 * `Popover > frame > Heading[slot=title] + Content`).
 *
 * D1: unavailable, RAC's `SubmenuTrigger` around the two (the item opens the Popover — `end top`,
 *   offset −2, cross offset −8, no arrow; the item is described by its info glyph); available, the
 *   item alone (the Popover is not drawn). No element of its own.
 * D2: S2's `isUnavailable` (default false).
 * D3: none — the item and the Popover keep their own rules; the item's info glyph is a node of the
 *   MenuItem origin (`showWhen: isUnavailable`) in the submenu chevron's place.
 */
export const unavailableMenuItemTriggerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "unavailablemenuitemtrigger",
  },
  props: {
    accepts: {
      isUnavailable: {
        kind: "boolean",
        label: "Unavailable",
        section: "state",
        default: false,
      },
    },
    toRacProps: "default",
  },
};
