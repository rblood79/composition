/**
 * ADR-142/912 — ColorSwatch leaf RAC primitive 의 `PrimitiveBinding` (box-only cutover).
 *
 * 사용자 방침(2026-06-11): Color 계열은 빌더 완성 후 제일 나중에 진짜 구현. 지금은 spec 제거 +
 * catalog cutover 등록(6 registry collapse)을 위해 **box 영역만** 등록한다.
 *
 * D1: RAC `<ColorSwatch>` 단일 leaf(자식 없음). 색 프리뷰 = style fn(linear-gradient(color)).
 * D3: box-only — 동적 색(props.color)은 generic buildCatalogShapes 로 재현 안 함(의도적 손실).
 *     실제 색 프리뷰는 후속 작업에서 escape/전용 렌더로 복원.
 */

import type { PrimitiveBinding } from "../types";

export const colorSwatchBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ColorSwatch",
  },
  rac: {
    primitive: "ColorSwatch",
    parts: [],
    slots: [],
    states: [],
    renderProps: ["color"],
    dataAttributes: [],
  },
  props: {
    accepts: {
      color: { kind: "string", label: "Color Value", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // S2 1.8.0 ColorSwatch `rounding` ('default' | 'none' | 'full', 2026-10-10): the corner —
      //   S2 maps default → sm, none → 0, full → circle (ColorSwatch.tsx borderRadius). Our box
      //   was a circle (2026-06-22 reference 정합), so our default keeps it: "full" (S2's own
      //   default is "default"). DOM `data-rounding` (toRacProps DATA_ATTR_ENUM_KEYS) → the
      //   rule's `containerVariants.rounding` sheet blocks; Canvas reads the same blocks
      //   (`rulePaint.ts` container-variant paint).
      rounding: {
        kind: "enum",
        label: "Rounding",
        section: "appearance",
        default: "full",
        options: [
          { value: "full", label: "Full" },
          { value: "default", label: "Default" },
          { value: "none", label: "None" },
        ],
      },
    },
    toRacProps: "default",
  },
};
