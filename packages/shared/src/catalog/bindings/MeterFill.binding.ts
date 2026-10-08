import type { PrimitiveBinding } from "../types";

/**
 * MeterFill — the filled part of a Meter's track (ADR-256 Phase 7b — the reference ProgressBar
 * anatomy `… + div.track > div.fill`, its width `{percentage}%`, Decision 12; RAC's Meter gives the
 * same render props). DOM is a plain `div.fill`; its box is the Meter sheet's `.fill`.
 *
 * D1: none — a plain element in RAC's `Meter` children.
 * D2: no props of its own (`variant` · `size` come from its Meter — `catalogDerivedProps`).
 * D3: the fill color (`COMPONENT_RULES_TABLE.MeterFill` — the owner's `--fill-color` per variant).
 */
export const meterFillBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "meterfill" },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "informative",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
};
