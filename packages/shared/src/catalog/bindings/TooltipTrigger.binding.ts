import type { PrimitiveBinding } from "../types";

/**
 * ADR-255 — RAC TooltipTrigger: opens its Tooltip on its trigger's hover / focus (D1 — RAC owns
 * the state, the delay, the position). The props are S2 `TooltipTrigger`'s (RAC's open · delay ·
 * trigger, plus the tooltip's placement — 2026-10-14 D2 정렬); the shared component hands the
 * placement to its Tooltip by context.
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
      // S2 1.8 `TooltipTrigger` (2026-10-14 D2 정렬 — 전에는 Tooltip 의 것): the tooltip's placement
      //   props, handed to the Tooltip by context (shared `TooltipPlacementContext`). S2 fixes the offset
      //   (arrow + 4) and drops RAC `closeDelay`; `offset` stays as RAC's (`d2Provenance`).
      placement: {
        kind: "enum",
        default: "top",
        label: "Placement",
        section: "appearance",
        options: [
          { value: "top", label: "Top" },
          { value: "bottom", label: "Bottom" },
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
      },
      offset: {
        kind: "number",
        default: 0,
        label: "Offset",
        section: "appearance",
      },
      crossOffset: {
        kind: "number",
        default: 0,
        label: "Cross Offset",
        section: "appearance",
      },
      shouldFlip: {
        kind: "boolean",
        label: "Should Flip",
        section: "appearance",
        default: true,
      },
      containerPadding: {
        kind: "number",
        default: 12,
        label: "Container Padding",
        section: "appearance",
      },
    },
    toRacProps: "default",
  },
};
