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
 * 현재 dormant — Icon 은 아직 cutover 아님(CUTOVER_TYPES 미포함). 본 binding 은
 * 타입 갭 해소 + 투영(toRacProps) 검증용이며, internal source 전용 렌더 분기는
 * family ① flip 시 도입된다.
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
};
