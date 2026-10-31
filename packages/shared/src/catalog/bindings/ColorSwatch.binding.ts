/**
 * ADR-142/912 — ColorSwatch leaf RAC primitive 의 `PrimitiveBinding` (box-only cutover).
 *
 * 사용자 방침(2026-06-11): Color 계열은 빌더 완성 후 제일 나중에 진짜 구현. 지금은 spec 제거 +
 * catalog cutover 등록(6 registry collapse)을 위해 **box 영역만** 등록한다.
 *
 * D1: RAC `<ColorSwatch>` 단일 leaf(자식 없음). 색 = RAC 가 inline `background-color` 로 쓴다.
 * D3: 상자는 rule. 색 (props.color — 없으면 ColorSwatchPickerItem 의 color) 은 Canvas 도 칠한다
 *     (ADR-295 후속 C3, 2026-10-31 — `colorControlParts.ts` `catalogColorSwatchColor` → 파생
 *     `_swatchColor` → `rulePaint.ts` 의 상자 바탕). 그 전에는 모든 견본이 rule 의 흰 상자였다.
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
      // S2 1.8.0 / RAC ColorSwatch `colorName` (2026-10-11): the swatch's accessible color name
      //   (RAC `aria-label` — "Pantone 7621 C"; empty = RAC describes the value). Not painted:
      //   D1 only, Canvas unchanged.
      colorName: { kind: "string", label: "Color Name", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // S2 1.8.1 ColorSwatch `rounding` ('default' | 'none' | 'full', 2026-10-10): the corner —
      //   S2 maps default → sm, none → 0, full → circle (ColorSwatch.tsx borderRadius), and its default
      //   is "default" (`rounding = ctx?.rounding || 'default'`). ADR-295 후속 (2026-10-31 「S2 식으로」):
      //   ours was "full" (the 2026-06-22 reference circle) — now S2's. DOM `data-rounding`
      //   (toRacProps DATA_ATTR_ENUM_KEYS) → the rule's `containerVariants.rounding` sheet blocks;
      //   Canvas reads the same blocks (`rulePaint.ts` container-variant paint).
      rounding: {
        kind: "enum",
        label: "Rounding",
        section: "appearance",
        default: "default",
        options: [
          { value: "default", label: "Default" },
          { value: "none", label: "None" },
          { value: "full", label: "Full" },
        ],
      },
    },
    toRacProps: "default",
  },
};
