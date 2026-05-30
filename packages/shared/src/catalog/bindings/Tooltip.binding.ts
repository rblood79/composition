/**
 * ADR-142 family ⑥(overlays) — Tooltip primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Tooltip.tsx`)가 RAC Tooltip + OverlayArrow(svg)
 * 합성(internal source). 자식 Description 은 canonical children(SHELL_ONLY). arrow svg 는
 * portal/overlay 시각 → DOM-only cutover(skiaLegacy:true). Tooltip 은 TooltipTrigger 안에서 의미.
 */

import type { PrimitiveBinding } from "../types";

export const tooltipBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tooltip",
  },
  props: {
    accepts: {
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
