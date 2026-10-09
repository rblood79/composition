/**
 * ADR-142 family ③(selection) — Slider leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. RAC `<Slider>` 가 Label/SliderOutput/
 * SliderTrack/SliderThumb slot 합성(D1). leaf binding.
 *
 * D3: track/fill/thumb 은 **자식 sub-part Element**(SliderTrack/SliderThumb, inventory §3 sub-part)
 *     가 그린다 — 부모 Slider 는 `_hasChildren` 빈 box shell(buildCatalogShapes 흡수). 따라서
 *     **skiaPrimitive 불필요**. SliderOutput/Label 도 자식 Element. theme/tokens 가 색 적용.
 */

import type { PrimitiveBinding } from "../types";

export const sliderBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Slider",
  },
  rac: {
    primitive: "Slider",
    parts: ["label", "output", "track", "thumb"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled", "orientation"],
    dataAttributes: ["data-disabled", "data-orientation"],
  },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // 2026-07-16: orientation 패널 항목 제거 → labelPosition 으로 대체 (사용자 명세).
      //   labelPosition="side" 시 Label · Track · Value 가로 배치 (RSP Slider labelPosition
      //   레퍼런스 정합, ProgressBar/Meter side 선례 동형). D3 구현 3중:
      //   CSS(catalog structure.composition.containerVariants["label-position"] → generated
      //   Slider.css) + Canvas(같은 블록 — 자식 order 는 `rulePartRules.ts`
      //   `containerVariantPartRules`) + DOM(`delegatedDom.tsx` `slider` 의 data-label-position).
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
      // S2 1.8.0 labelAlign (start · end — S2 `Alignment`, 2026-10-10): the side label column's text
      //   alignment, as the fields take it — DOM `data-label-align` → the rule's `label-align` block
      //   (`--form-label-align`), the Canvas reads the same block (`rulePartRules.ts` `LABEL_ALIGN_AXIS`).
      //   The side label is its text's width (S2 side label column `auto`). A Form's value fills
      //   it (`formContext.ts`).
      labelAlign: {
        kind: "enum",
        label: "Label Align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
        visibleWhen: { key: "labelPosition", equals: "side" },
      },
      minValue: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 0,
        label: "Min Value",
        section: "content",
      },
      maxValue: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 100,
        label: "Max Value",
        section: "content",
      },
      step: {
        kind: "number",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: 1,
        label: "Step",
        section: "content",
        min: 0,
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): 초기값 — `delegatedDom.tsx` `slider` 가
      //   uncontrolled defaultValue 로 전달 (드래그 상호작용 보존).
      value: { kind: "number", label: "Value", section: "content" },
      // ADR-915 P1.5-d (2026-07-16): 값 라벨(SliderOutput) 표시 여부 (RSP showValueLabel).
      //   false 면 SliderOutput 노드가 없다 — Canvas 와 DOM 이 같은 술어
      //   (`presence.ts` `catalogProgressValueHidden`) 를 읽는다.
      showValueLabel: {
        kind: "boolean",
        label: "Show Value Label",
        section: "appearance",
        default: true,
      },
      // S2 1.8.0 Slider `isEmphasized` (2026-10-10): the filled track — neutral, accent when
      //   emphasized (S2 `gray-700` · `accent-900`; our Checkbox · Switch selected pair). The thumb
      //   follows. DOM `data-emphasized` (`delegatedDom.tsx` `slider`) + the SliderFill's
      //   `data-variant`; Canvas the SliderFill · SliderThumb rules' `emphasized` variant
      //   (`presence.ts` — derived from the Slider).
      isEmphasized: {
        kind: "boolean",
        label: "Emphasized",
        section: "appearance",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  // track/thumb 은 자식 SliderTrack/SliderThumb sub-part 가 그림 → skiaPrimitive 불필요.
};
