import type { PrimitiveBinding } from "../types";

/**
 * Meter — 측정값 표시 compound (label + value + track 채움 막대).
 *
 * **ADR-912 진로 1번 Meter 확장 (ProgressBar 동형, 2026-06-08)**:
 *   Meter 는 factory(DisplayComponents.ts createMeterDefinition)가 Label + MeterValue +
 *   MeterTrack 3 자식을 자동 생성한다 → 항상 `_hasChildren=true`. [[progressBarBinding]] 와
 *   **완전 동형 compound** — 차이는 (a) variant 4색(informative/positive/warning/critical,
 *   default 부재 → informative 기본) (b) isIndeterminate **부재**(RAC `<Meter>` 에 해당 prop
 *   없음, 측정값은 항상 확정).
 *
 *   **DOM = internal wrapper 위임(ProgressBar/Tabs 선례 동형)**: source.renderer="meter" →
 *   CanonicalNodeRenderer 의 DELEGATING_INTERNAL_RENDERERS 위임 분기가
 *   rendererMap.renderMeter(LayoutRenderers)로 위임한다. renderMeter 는 childrenByParent 에서
 *   자식 Label 의 children 문자열만 추출해 자기완결 RAC `<Meter label value min max variant
 *   size>` 를 렌더한다(render-prop 내부 self-compose — bar/fill 을 RAC 가 자체 생성). 자식
 *   MeterValue/Track 은 DOM 트리에 직접 렌더 안 됨(RAC 가 value label + bar 를 자체 합성).
 *
 *   **Skia = shell-only + 자식 MeterTrack value_fill_bar escape(이미 발효)**: Meter 부모는
 *   buildCatalogShapes shell(rule fill transparent → 빈 box). value 채움 막대는 **자식
 *   MeterTrack 노드**가 value_fill_bar escape(선행-2 발효, MeterTrack.binding skiaPrimitive)로
 *   그린다. variant 4색 fillBar 는 MeterTrack rule.variants[v].fillBar(informative/positive/
 *   notice/negative)에서 resolveProgressProps 의 variant 전파 → value_fill_bar 가
 *   visual.fillBar 읽어 자동 적용(컴포넌트 분기 0 — no-classification). ProgressBar(accent
 *   단색)와 유일한 실질 차이.
 *
 *   **DOM/Skia 비대칭은 의도된 모델(선행-2 확정)**: DOM=RAC 자체 bar(자식 Track 미렌더) /
 *   Skia=자식 MeterTrack value_fill_bar. 구현 메커니즘은 다르나 **시각 결과(value 비례 채움
 *   막대 + variant 색)는 동일** = ssot-hierarchy "대칭 = 시각 결과의 동일성, 구현 방법 자유"
 *   정합. MeterTrack.binding 주석에 이 비대칭이 이미 명시됨.
 *
 * D1: composition RAC `<Meter role="meter">` (internal wrapper, renderMeter 위임).
 * D2: value(0-100) + minValue + maxValue + label + variant(4색) + size + showValueLabel.
 *     isIndeterminate 부재(ProgressBar 와 차이 — 측정값은 항상 확정).
 * D3: track/fill 색 = rule(자식 MeterTrack value_fill_bar variant 4색) — DOM RAC self-bar
 *     와 시각 대칭.
 */
export const meterBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "meter",
  },
  props: {
    accepts: {
      value: {
        kind: "number",
        label: "Value",
        section: "content",
        default: 75,
      },
      minValue: { kind: "number", label: "Min", section: "content" },
      maxValue: { kind: "number", label: "Max", section: "content" },
      label: { kind: "string", label: "Label", section: "content" },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "informative",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      showValueLabel: {
        kind: "boolean",
        label: "Show Value Label",
        section: "content",
      },
    },
    toRacProps: "default",
  },
  // Skia: 부모 shell-only(_hasChildren) + 자식 MeterTrack value_fill_bar escape(선행-2 발효).
  // 부모 자체 skiaPrimitive 없음(자식 Track 이 value 막대 + variant 4색 담당).
};
