import type { PrimitiveBinding } from "../types";

/**
 * ProgressBarFill — the filled part of a ProgressBar's track (ADR-256 Phase 7a — the reference
 * `ProgressBar > … + div.track > div.fill`, the fill's width `{percentage}%`, Decision 12). DOM is a
 * plain `div.fill` (RAC gives the fill no element of its own); its box is the ProgressBar sheet's
 * `.fill` (`COMPONENT_RULES_TABLE.ProgressBar` composition), its width the template binding.
 *
 * D1: none — a plain element in RAC's `ProgressBar` children.
 * D2: no props of its own (`variant` · `size` come from its ProgressBar — `catalogDerivedProps`).
 * D3: the fill color (`COMPONENT_RULES_TABLE.ProgressBarFill` — the owner's `--fill-color`).
 */
export const progressBarFillBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "progressbarfill" },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
        editorHidden: true,
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};
