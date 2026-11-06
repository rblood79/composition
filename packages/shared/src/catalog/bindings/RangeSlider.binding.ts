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
        section: "content",
        default: { start: 25, end: 75 },
      },
      startName: { kind: "string", label: "Start Name", section: "content" },
      endName: { kind: "string", label: "End Name", section: "content" },
      form: { kind: "string", label: "Form", section: "content" },
    },
  },
};
