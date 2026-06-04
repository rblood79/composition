import type { PrimitiveBinding } from "../types";

/**
 * ProgressBarTrack — ProgressBar compound 의 value 채움 막대 (Skia-전용 sub-part).
 *
 * **DOM no-op (ADR-912 선행-2, 2026-06-04)**: DOM 에서 ProgressBar 는 RAC `<ProgressBar>`
 *   단일 컴포넌트로 track+fill 을 내부 렌더한다(LayoutRenderers.renderProgressBar). 부모
 *   ProgressBar 가 자식 element 를 DOM 트리에서 순회하지 않으므로 ProgressBarTrack 자식
 *   노드는 DOM 에 렌더되지 않는다 → source.renderer 는 DOM 미도달(INTERNAL_RENDERERS 등록
 *   불요). Skia 만 ProgressBarTrack 노드를 그린다(ListBox row projection 과 동형 비대칭).
 *
 * **Skia = value_fill_bar escape**: track box(buildCatalogShapes) 위에 value 비례 채움 막대.
 *   value/min/max/isIndeterminate 는 props, 채움 색은 rule.fillBar(`{color.accent}`).
 *   기존 ProgressBarTrack.spec.ts render.shapes 의 fillWidth 계산을 escape 로 이전.
 */
export const progressBarTrackBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "progressbartrack" },
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
      value: {
        kind: "number",
        label: "Value",
        section: "content",
        default: 0,
      },
      isIndeterminate: {
        kind: "boolean",
        label: "Indeterminate",
        section: "state",
        default: false,
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "value_fill_bar",
};
