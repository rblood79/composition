import type { PrimitiveBinding } from "../types";

/**
 * ProgressBar — 진행률 표시 compound (label + value + track 채움 막대).
 *
 * **ADR-912 진로 1번 ProgressBar proof slice (value-fill compound catalog 발효, 2026-06-07)**:
 *   ProgressBar 는 factory(DisplayComponents.ts createProgressBarDefinition)가 Label +
 *   ProgressBarValue + ProgressBarTrack 3 자식을 자동 생성한다 → 항상 `_hasChildren=true`.
 *   ProgressCircle(leaf, children:[])과 달리 **자식 있는 compound** 라 발효 메커니즘이 다르다.
 *
 *   **DOM = internal wrapper 위임(Tabs 선례 동형)**: source.renderer="progressbar" →
 *   CanonicalNodeRenderer 의 위임 분기가 rendererMap.renderProgressBar(LayoutRenderers)로 위임한다.
 *   renderProgressBar 는 childrenByParent 에서 자식 Label 의 children 문자열만 추출해 자기완결 RAC
 *   `<ProgressBar label value min max variant size>` 를 렌더한다(render-prop 내부 self-compose —
 *   bar/fill 을 RAC 가 자체 생성). 자식 ProgressBarValue/Track 은 DOM 트리에 직접 렌더 안 됨(RAC 가
 *   value label + bar 를 자체 합성). generic 자식 재귀 경로(rac source `<RAC.ProgressBar>{children}`)는
 *   label 추출 손실 + 자식 중복이라 부적합 → **internal wrapper 위임이 정답**(Tabs renderTabs 위임 동형).
 *
 *   **Skia = shell-only + 자식 ProgressBarTrack value_fill_bar escape(이미 발효)**: ProgressBar.spec
 *   render.shapes 는 `_hasChildren=true` 시 빈 배열(monolithic 분기 dead) → buildCatalogShapes shell
 *   (rule fill transparent → 빈 box). value 채움 막대는 **자식 ProgressBarTrack 노드**가
 *   value_fill_bar escape(선행-2 발효, ProgressBarTrack.binding skiaPrimitive)로 그린다.
 *
 *   **DOM/Skia 비대칭은 의도된 모델(선행-2 확정)**: DOM=RAC 자체 bar(자식 Track 미렌더) /
 *   Skia=자식 ProgressBarTrack value_fill_bar. 구현 메커니즘은 다르나 **시각 결과(value 비례 채움
 *   막대)는 동일** = ssot-hierarchy "대칭 = 시각 결과의 동일성, 구현 방법 자유" 정합(ListBox row
 *   projection 동형 비대칭). ProgressBarTrack.binding 주석에 이 비대칭이 이미 명시됨.
 *
 * D1: composition RAC `<ProgressBar role="progressbar">` (internal wrapper, renderProgressBar 위임).
 * D2: value(0-100) + minValue + maxValue + label + variant + size + isIndeterminate + showValueLabel.
 * D3: track/fill 색 = rule(자식 ProgressBarTrack value_fill_bar) — DOM RAC self-bar 와 시각 대칭.
 */
export const progressBarBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "progressbar",
  },
  props: {
    accepts: {
      value: {
        kind: "number",
        label: "Value",
        section: "content",
        default: 50,
      },
      minValue: { kind: "number", label: "Min", section: "content" },
      maxValue: { kind: "number", label: "Max", section: "content" },
      label: { kind: "string", label: "Label", section: "content" },
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
      isIndeterminate: {
        kind: "boolean",
        label: "Indeterminate",
        section: "content",
      },
      showValueLabel: {
        kind: "boolean",
        label: "Show Value Label",
        section: "content",
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderProgressBar 기소비 —
      //   RSP ProgressBar 공식 prop (labelPosition top/side, valueLabel 커스텀 표기).
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      valueLabel: {
        kind: "string",
        label: "Value Label",
        section: "content",
      },
    },
    toRacProps: "default",
  },
  // Skia: 부모 shell-only(_hasChildren) + 자식 ProgressBarTrack value_fill_bar escape(선행-2 발효).
  // 부모 자체 skiaPrimitive 없음(자식 Track 이 value 막대 담당).
};
