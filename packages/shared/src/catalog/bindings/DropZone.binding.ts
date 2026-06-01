/**
 * ADR-142 family ⑥(overlays) — DropZone primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`DropZone.tsx`)가 RAC DropZone + label/
 * description/drop 영역 합성(internal source). drop 시각(dashed border/hover 등)은 복잡한
 * render.shapes(12 refs) → DOM-only cutover(skiaLegacy:true).
 */

import type { PrimitiveBinding } from "../types";

export const dropZoneBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "dropzone",
  },
  props: {
    accepts: {
      label: {
        kind: "string",
        label: "Label",
        section: "content",
        default: "Drop files here",
      },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
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
