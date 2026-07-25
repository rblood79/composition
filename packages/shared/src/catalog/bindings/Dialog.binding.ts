/**
 * ADR-142 family ⑥(overlays) — Dialog primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Dialog.tsx`)가 RAC
 * Dialog + Heading/dismiss 등을 합성(internal source). overlay 는 portal 렌더라 자식 Heading/
 * Description 은 canonical children 트리(SHELL_ONLY).
 *
 * **Skia generic 전환 (ADR-142 Inc3, 2026-06-01)**: bg 는 buildCatalogShapes(variant fill
 * `{color.layer-1}`), backdrop(반투명 전체화면 rect)은 skiaPrimitive draw module
 * (`overlay_backdrop`, prepend=base 앞) 합성.
 *
 * **Dialog 는 그림자를 갖지 않는다 (ADR-166 Phase 4, 2026-07-25)**: elevation 소유자는 Modal 이다
 * (`Dialog.tsx` 주석 "should be used within a Modal overlay", generated `Dialog.css` box-shadow 0건).
 * 구 `dialog_shadow` primitive 는 `target:"bg"` shadow 가 bg 추출 경로에서 삼켜져 캔버스 출력이
 * 0이었으므로(실측) 제거해도 시각 변화가 없다. Dialog 에 그림자가 필요해지면 primitive 가 아니라
 * `containerStyles.boxShadow`.
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
      // live consumer: LayoutRenderers.tsx renderDialog line 630
      role: {
        kind: "enum",
        label: "Role",
        section: "state",
        default: "dialog",
        options: [
          { value: "dialog", label: "Dialog" },
          { value: "alertdialog", label: "Alert Dialog" },
        ],
      },
    },
    toRacProps: "default",
  },
  // backdrop (base 앞 prepend) 만. box 는 buildCatalogShapes 가 담당.
  skiaPrimitive: ["overlay_backdrop"],
};
