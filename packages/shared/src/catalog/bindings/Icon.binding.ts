/**
 * ADR-142 foundation #1 — Icon leaf primitive 의 PrimitiveBinding.
 *
 * Icon 은 RAC primitive 가 아니라 composition 내부 Lucide SVG 렌더러다
 * (getIconData → DOM `<svg>` / Skia CanvasKit Path). 따라서 `source.kind: "internal"`
 * 로 표현 — PrimitiveBinding `PrimitiveSource` 타입 일반화의 첫 소비자.
 *
 * family ①(primitives/actions)의 leaf 이며, "아이콘이 붙은 Button" 같은 조합에서
 * child 노드로 합성된다(설계 §3 — icon=reusable 조합). 시각(크기/색)은 theme/tokens.
 *
 * Icon 은 box+text 가 아닌 비-DOM-trivial primitive → Skia 는 `skiaPrimitive: "icon_font"`
 * draw module(renderers/skiaPrimitives.ts)이 Lucide glyph 단일 shape 로 그린다.
 */
import type { PrimitiveBinding } from "../types";

export const iconBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "icon",
  },
  props: {
    accepts: {
      iconName: { kind: "icon", label: "Icon", section: "content" },
      // 시각 차원 → data-variant / data-size (theme 가 값 집합 제공)
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      strokeWidth: {
        kind: "number",
        label: "Stroke Width",
        section: "appearance",
        default: 2,
        min: 0.5,
        max: 4,
        step: 0.5,
      },
    },
    toRacProps: "default",
  },
  // Icon 은 Lucide glyph(icon_font) primitive — box+text 가 아님.
  skiaPrimitive: "icon_font",
};
