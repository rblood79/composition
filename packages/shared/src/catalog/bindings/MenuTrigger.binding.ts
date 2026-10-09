import type { PrimitiveBinding } from "../types";

/**
 * ADR-256 후속 4 — RAC MenuTrigger: its Button opens its Popover's Menu (D1 — RAC owns the open
 * state, the keyboard, the focus). The props are RAC's (RSP MenuTrigger's); the shared component
 * wraps the children in a layout box as DialogTrigger · TooltipTrigger do.
 */
export const menuTriggerBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "menutrigger" },
  props: {
    accepts: {
      isOpen: { kind: "boolean", label: "Open", section: "state" },
      defaultOpen: {
        kind: "boolean",
        label: "Initially Open",
        section: "state",
      },
      trigger: {
        kind: "enum",
        label: "Trigger",
        section: "state",
        default: "press",
        options: [
          { value: "press", label: "Press" },
          { value: "longPress", label: "Long Press" },
        ],
      },
      // S2 1.8.0 MenuTrigger — where the menu opens: `direction` + `align` are its Popover's
      //   placement (`domBinding.tsx` `catalogS2OverlayPlacement` — a sideways direction takes top
      //   for start, bottom for end; a placement chosen on the Popover node wins).
      direction: {
        kind: "enum",
        label: "Direction",
        section: "appearance",
        default: "bottom",
        options: [
          { value: "bottom", label: "Bottom" },
          { value: "top", label: "Top" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
      },
      align: {
        kind: "enum",
        label: "Align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
      },
    },
    toRacProps: "default",
  },
};
