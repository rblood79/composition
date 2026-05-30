/**
 * ADR-142 family ⑥(overlays) — Modal primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Modal.tsx`)가 RAC ModalOverlay/Modal +
 * focus trap 합성(internal source). 자식(Dialog 등)은 canonical children. Modal render.shapes
 * = [] (portal 시각 없음). DOM-only cutover(skiaLegacy:true).
 */

import type { PrimitiveBinding } from "../types";

export const modalBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "modal",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      trapFocus: { kind: "boolean", label: "Trap Focus", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
    },
    toRacProps: "default",
  },
};
