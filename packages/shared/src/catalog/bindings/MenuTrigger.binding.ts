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
    },
    toRacProps: "default",
  },
};
