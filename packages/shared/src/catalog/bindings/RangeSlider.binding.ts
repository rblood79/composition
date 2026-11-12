import type { PrimitiveBinding } from "../types";
import { sliderBinding } from "./Slider.binding";

const {
  value: _value,
  fillOffset: _fillOffset,
  showValueLabel: _showValueLabel,
  ...accepts
} = sliderBinding.props.accepts;

/** S2 RangeSlider uses RAC Slider with two authored thumb children. */
export const rangeSliderBinding: PrimitiveBinding = {
  ...sliderBinding,
  source: { kind: "internal", renderer: "rangeslider" },
  props: {
    ...sliderBinding.props,
    accepts: {
      ...accepts,
      value: {
        kind: "number-range",
        label: "Value",
        section: "value",
        default: { start: 25, end: 75 },
      },
      startName: { kind: "string", label: "Start name", section: "forms" },
      endName: { kind: "string", label: "End name", section: "forms" },
      // (2026-11-11 사용자 결정 「숨김」: developer HTML · ARIA attributes — accepted, not offered in the panel.)
      form: {
        kind: "string",
        label: "Form",
        section: "content",
        editorHidden: true,
      },
    },
  },
};
