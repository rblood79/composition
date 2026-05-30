/**
 * ADR-142 family ⑥(overlays) — Dialog primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Dialog.tsx`)가 RAC
 * Dialog + Heading/dismiss 등을 합성(internal source). overlay 는 portal 렌더라 자식 Heading/
 * Description 은 canonical children 트리(SHELL_ONLY).
 *
 * **DOM-only cutover (skiaLegacy:true)**: DOM/Inspector 는 catalog generic(wrapper), Skia 만
 * legacy render.shapes 유지 — portal/overlay 시각(dismiss/arrow 등)은 Skia generic 미확정,
 * 전 family 후 일괄. (family ④/⑤ DOM-only 패턴 재사용.)
 */

import type { PrimitiveBinding } from "../types";

export const dialogBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "dialog",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isDismissable: {
        kind: "boolean",
        label: "Dismissable",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
