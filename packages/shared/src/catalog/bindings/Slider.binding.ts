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
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      minValue: { kind: "number", label: "Min Value", section: "content" },
      maxValue: { kind: "number", label: "Max Value", section: "content" },
      step: { kind: "number", label: "Step", section: "content", min: 0 },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): 초기값 — renderSlider 가
      //   uncontrolled defaultValue 로 기소비 (드래그 상호작용 보존).
      value: { kind: "number", label: "Value", section: "content" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  // track/thumb 은 자식 SliderTrack/SliderThumb sub-part 가 그림 → skiaPrimitive 불필요.
};
