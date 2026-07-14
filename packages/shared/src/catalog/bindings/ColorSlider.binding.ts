/**
 * ADR-142/912 — ColorSlider leaf RAC primitive 의 `PrimitiveBinding` (box-only cutover).
 *
 * 사용자 방침(2026-06-11): Color 계열은 빌더 완성 후 제일 나중에 진짜 구현. 지금은 spec 제거 +
 * catalog cutover 등록(6 registry collapse)을 위해 box 영역만 등록한다.
 *
 * D1: RAC `<ColorSlider>` + Label + SliderOutput + `<SliderTrack>` + `<ColorThumb>` (grid 레이아웃).
 * D3: box-only — track gradient / thumb / output 텍스트는 generic buildCatalogShapes(box)로 재현
 *     안 함(의도적 손실).
 */

import type { PrimitiveBinding } from "../types";

export const colorSliderBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "ColorSlider",
  },
  rac: {
    primitive: "ColorSlider",
    parts: ["sliderTrack", "sliderOutput", "colorThumb"],
    slots: [],
    states: ["isDisabled"],
    renderProps: ["isDisabled"],
    dataAttributes: ["data-disabled"],
  },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): orientation 은 renderColorSlider
      //   기소비 (가로/세로 치수 전환). channel/colorSpace 는 RAC 공식이나 renderColorSlider
      //   가 정적 gradient div 라 소비 경로 부재 — dead 편집 UI 방지를 위해 미추가.
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
    },
    toRacProps: "default",
  },
};
