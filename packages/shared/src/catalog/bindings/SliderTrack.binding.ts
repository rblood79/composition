import type { PrimitiveBinding } from "../types";

/**
 * SliderTrack — Slider compound 의 트랙 (배경 + value 채움 막대 + thumb 핸들, Skia-전용 sub-part).
 *
 * **DOM no-op (ADR-912 SliderTrack, ProgressBarTrack 동형)**: DOM 에서 Slider 는 RAC `<Slider>`
 *   컴포넌트가 `<SliderTrack>{({state})=>...}` render-prop 으로 track-bg/fill/thumb 를 내부 self-compose
 *   한다(Slider.tsx). 부모 Slider 가 자식 SliderTrack element 를 DOM 트리에서 순회하지 않으므로
 *   SliderTrack 자식 노드는 DOM 에 렌더되지 않는다 → source.renderer 는 DOM 미도달(INTERNAL_RENDERERS
 *   등록 불요). Skia 만 SliderTrack 노드를 그린다(ListBox row projection 동형 비대칭 — 시각 결과 동일).
 *
 * **Skia = slider_fill_bar escape (replace)**: track 배경 + value 비례 채움 막대 + thumb 핸들(들)을
 *   자체 생성한다. value/min/max 는 props, 채움/thumb 색은 rule.fillBar(`{color.accent}`), track
 *   배경은 rule.fill.base(neutral-subtle). thumb border 는 `{color.base}` 2px(spec 정합).
 *   - **value_fill_bar(Progress/Meter, append)와 다른 점**: thumb(단일 1 / range 2) 를 그리고,
 *     layout box=thumbSize(thumb 컨테이너, implicitStyles ADR-086 P2)라 box 좌표계와 spec track(y=trackY
 *     세로 중앙)이 어긋나 **replace 모드**(자체 track box 생성, buildCatalogShapes box 대체).
 *   - **SliderThumb 자식 spec.render.shapes 는 `[]`(hitbox 만)** → thumb 를 여기서 그려도 이중 렌더 0.
 *   - SliderThumb 자식 보유로 `_hasChildren=true` → value_fill_bar 의 `_hasChildren` early-return dead
 *     분기를 slider_fill_bar 가 우회(thumb 자체 생성).
 *
 * D1: composition RAC `<Slider>` 가 self-compose (SliderTrack 단독 DOM 노드 없음).
 * D2: value(single|range) + minValue + maxValue + variant + size (부모 Slider 에서 상속 주입).
 * D3: track/fill/thumb 색 = rule(slider_fill_bar) — DOM RAC self-track 과 시각 대칭.
 */
export const sliderTrackBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "slidertrack" },
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
        default: 50,
      },
      minValue: { kind: "number", label: "Min", section: "content" },
      maxValue: { kind: "number", label: "Max", section: "content" },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "slider_fill_bar",
};
