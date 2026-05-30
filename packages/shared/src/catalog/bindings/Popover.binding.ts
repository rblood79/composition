/**
 * ADR-142 family ⑥(overlays) — Popover primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Popover.tsx`)가 RAC Popover + OverlayArrow
 * 합성(internal source). 자식 Heading/Description 은 canonical children(SHELL_ONLY). arrow 는
 * portal/overlay 시각이라 Skia generic 미확정 → DOM-only cutover(skiaLegacy:true).
 */

import type { PrimitiveBinding } from "../types";

export const popoverBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "popover",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      hideArrow: {
        kind: "boolean",
        label: "Hide Arrow",
        section: "appearance",
      },
      containFocus: {
        kind: "boolean",
        label: "Contain Focus",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
