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
 *
 * **propPassthrough: ["size"] (2026-07-14, 사용자 적발 — "md 를 제외하고 정합 불일치")**:
 * `Icon.tsx` 는 size 를 **React prop 으로 소비**해 `ICON_SIZE_MAP[size]` → `<svg width>` 를
 * 계산한다. SVG width 는 **속성**이라 `data-size` CSS 로는 도달 불가 — passthrough 가 없으면
 * size 가 `undefined` → default `"md"` → **DOM 이 영원히 24px 고정**이다. Skia 는 store 의
 * `props.size` 를 직접 읽어 정상(16/18/24/36/48) → **md 에서만 우연히 24 로 일치**하고 나머지
 * 4 size 는 전부 비대칭. Avatar / ProgressCircle / StatusLight 선례와 동일 root-cause.
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
    // Icon.tsx 가 size 를 React prop 으로 소비(ICON_SIZE_MAP[size] → svg width). data-size 만으로는
    //   CSS 가 SVG 속성에 도달 못 함 → React prop + data-* 둘 다 emit.
    propPassthrough: ["size"],
  },
  // Icon 은 Lucide glyph(icon_font) primitive — box+text 가 아님.
  skiaPrimitive: "icon_font",
};
