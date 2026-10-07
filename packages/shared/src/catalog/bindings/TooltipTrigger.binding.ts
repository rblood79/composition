import type { PrimitiveBinding } from "../types";

/**
 * ADR-255 — RAC TooltipTrigger: opens its Tooltip on its trigger's hover / focus (D1 — RAC owns
 * the state, the delay, the position). The props are RAC's (RSP TooltipTrigger's); the shared
 * component wraps the children in a layout box as DialogTrigger does.
 */
export const tooltipTriggerBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "tooltiptrigger" },
  props: {
    accepts: {
      isOpen: { kind: "boolean", label: "Open", section: "state" },
      defaultOpen: {
        kind: "boolean",
        label: "Initially Open",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/react-stately 기본과 같은 값 — 패널이 비어 보이지 않게 (racDefaultSync 관례).
      delay: {
        kind: "number",
        label: "Delay",
        section: "state",
        default: 1500,
      },
      closeDelay: {
        kind: "number",
        label: "Close Delay",
        section: "state",
        default: 500,
      },
      trigger: {
        kind: "enum",
        label: "Trigger",
        section: "state",
        default: "hover",
        options: [
          { value: "hover", label: "Hover" },
          { value: "focus", label: "Focus" },
        ],
      },
    },
    toRacProps: "default",
  },
};
