import type { PrimitiveBinding } from "../types";

/**
 * ProgressBar — 진행률 표시 (ADR-256 Phase 7a: 노드 트리).
 *
 * DOM 은 RAC `ProgressBar` 가 자식 노드를 순서대로 그린다 (`delegatedDom` `progressbar`) — 원본
 * `ProgressBar > Label + ProgressBarValue {valueText} + ProgressBarTrack > ProgressBarFill (width
 * {percentage}%)` (react-aria.adobe.com ProgressBar 예제, G0 #14) 와 작성자가 넣은 자유 내용. 값 글자 ·
 * 채움 폭은 RAC render props 값 바인딩 (Decision 12 — `valueBindings.ts`): Preview 는 RAC 의 값, Canvas
 * 는 이 record 의 값 (RAC 와 같은 계산).
 *
 * Canvas: 부모는 빈 상자 (rule fill transparent), track 과 fill 노드가 각자 rule 로 칠한다 (variant 는
 * 부모의 것 — `catalogDerivedProps`).
 *
 * D1: RAC `<ProgressBar role="progressbar">` 그대로.
 * D2: value · minValue · maxValue · label · variant · size · isIndeterminate · showValueLabel ·
 *     valueLabel · labelPosition · staticColor.
 * D3: catalog ProgressBar rule (`.bar` · `.value` · `.fill` composition) + ProgressBarTrack ·
 *     ProgressBarFill rule.
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
      minValue: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 0,
        label: "Min",
        section: "content",
      },
      maxValue: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 100,
        label: "Max",
        section: "content",
      },
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
      // RSP S2 "over background" (design-data 감사 §2-F, 2026-08-21): 유색/이미지 배경 위
      //   고정 흑백 스킴 — Button 형(bg 반전)이 아니라 track=static 25% wash + fill=solid +
      //   label/value 텍스트=static. DOM = 수동 ProgressBar.css [data-static-color] var 재정의 /
      //   Skia = propagation(staticColor → Track, 텍스트는 style.color) + value_fill_bar·
      //   buildCatalogShapes track wash (0.25 대칭).
      staticColor: {
        kind: "enum",
        label: "Static Color",
        section: "appearance",
        default: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "white", label: "White" },
          { value: "black", label: "Black" },
        ],
      },
      isIndeterminate: {
        kind: "boolean",
        label: "Indeterminate",
        section: "state",
      },
      showValueLabel: {
        kind: "boolean",
        label: "Show Value Label",
        section: "appearance",
      },
      // RAC/RSP 정합 감사 (2026-07-15): valueLabel 은 ProgressBar wrapper 가 <span class="value"> 로
      //   직접 렌더. labelPosition(top/side) 은 D3 구현 완료로 재노출 — CSS(catalog structure.composition.
      //   containerVariants["label-position"].side → generated ProgressBar.css) + Skia(implicitStyles
      //   자식 order 재배치). side = label · track · value 가로 배치.
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
        section: "appearance",
        // RSP: valueLabel 은 showValueLabel 일 때만 표시 (2026-09-15)
        visibleWhen: { key: "showValueLabel", equals: true },
      },
    },
    toRacProps: "default",
  },
};
