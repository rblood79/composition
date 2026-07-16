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
        default: "md",
      },
      // 2026-07-16: orientation 패널 항목 제거 → labelPosition 으로 대체 (사용자 명세).
      //   labelPosition="side" 시 Label · Track · Value 가로 배치 (RSP Slider labelPosition
      //   레퍼런스 정합, ProgressBar/Meter side 선례 동형). D3 구현 3중:
      //   CSS(catalog structure.composition.containerVariants["label-position"] → generated
      //   Slider.css) + Skia(top-level containerVariants + implicitStyles 자식 재정렬) +
      //   DOM(shared Slider data-label-position emit / renderSlider forward).
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
      minValue: { kind: "number", label: "Min Value", section: "content" },
      maxValue: { kind: "number", label: "Max Value", section: "content" },
      step: { kind: "number", label: "Step", section: "content", min: 0 },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): 초기값 — renderSlider 가
      //   uncontrolled defaultValue 로 기소비 (드래그 상호작용 보존).
      value: { kind: "number", label: "Value", section: "content" },
      // ADR-915 P1.5-d (2026-07-16): 값 라벨(SliderOutput) 표시 여부 (RSP showValueLabel).
      //   Skia(buildSpecNodeData:800)/layout(utils:2608, implicitStyles:1827)/factory
      //   (FormComponents:499 default true) 기소비. renderSlider→shared Slider DOM forward 동반.
      showValueLabel: {
        kind: "boolean",
        label: "Show Value Label",
        section: "appearance",
        default: true,
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  // track/thumb 은 자식 SliderTrack/SliderThumb sub-part 가 그림 → skiaPrimitive 불필요.
};
