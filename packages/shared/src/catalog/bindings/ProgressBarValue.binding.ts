import type { PrimitiveBinding } from "../types";

/**
 * ProgressBarValue — ProgressBar compound 의 현재 값 텍스트 leaf ([[MeterValue]] 동형).
 *
 * **DOM 부모 흡수 (ADR-912 value-label, 2026-06-11)**: DOM 에서 ProgressBar 는 RAC
 *   `<ProgressBar>` 가 value label 을 self-compose 한다(renderProgressBar 가 children=
 *   formatted value 흡수, 자식 노드 DOM 독립 렌더 안 됨). source.kind="internal" +
 *   renderer="progressbarvalue" 는 INTERNAL_RENDERERS 미등록 → cutover generic skip.
 *
 * **Skia = buildCatalogShapes text**: children(부모 resolveProgressProps 주입) 을 rule.variants
 *   (text color) + sizes(fontSize/lineHeight) 로 그림. 순수 text leaf (value_fill_* escape 없음).
 *   variant 는 "default" 단일 (Meter 의 4색과 달리 ProgressBar 는 accent 단색).
 */
export const progressBarValueBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "progressbarvalue" },
  props: {
    accepts: {
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
      children: {
        kind: "string",
        label: "Value",
        section: "content",
        default: "",
      },
    },
    toRacProps: "default",
  },
};
