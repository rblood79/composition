import type { PrimitiveBinding } from "../types";
import {
  SLIDER_ORIENTATION_VALUES,
  SLIDER_SIZE_VALUES,
  toSliderRacProps,
  type SliderCanonicalProps,
  type SliderRacProps,
} from "../outputs/toRacProps";

const sliderAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Slider",
  },
  value: {
    kind: "number",
    label: "Value",
    section: "content",
    default: 50,
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: SLIDER_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    section: "appearance",
    default: "horizontal",
    options: SLIDER_ORIENTATION_VALUES.map((value) => ({
      value,
      label: value[0].toUpperCase() + value.slice(1),
    })),
  },
  isEmphasized: {
    kind: "boolean",
    label: "Emphasized",
    section: "appearance",
    default: false,
  },
  showValueLabel: {
    kind: "boolean",
    label: "Show Value",
    section: "appearance",
    default: true,
  },
  locale: {
    kind: "string",
    label: "Locale",
    section: "locale",
    default: "ko-KR",
  },
  formatOptions: {
    kind: "string",
    label: "Format Options",
    section: "locale",
    inspector: false,
  },
  minValue: {
    kind: "number",
    label: "Min Value",
    section: "range",
    default: 0,
  },
  maxValue: {
    kind: "number",
    label: "Max Value",
    section: "range",
    default: 100,
  },
  step: {
    kind: "number",
    label: "Step",
    section: "range",
    default: 1,
    min: 0,
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    section: "state",
    default: false,
  },
  isReadOnly: {
    kind: "boolean",
    label: "Read Only",
    section: "state",
    default: false,
  },
  isLoading: {
    kind: "boolean",
    label: "Loading",
    section: "state",
    default: false,
  },
  defaultValue: {
    kind: "number",
    label: "Default Value",
    section: "state",
    inspector: false,
  },
  thumbLabels: {
    kind: "string-array",
    label: "Thumb Labels",
    section: "content",
    inspector: false,
  },
  name: {
    kind: "string",
    label: "Name",
    section: "state",
    inspector: false,
  },
  form: {
    kind: "string",
    label: "Form",
    section: "state",
    inspector: false,
  },
  className: {
    kind: "string",
    label: "Class name",
    section: "appearance",
    inspector: false,
  },
  style: {
    kind: "string",
    label: "Style",
    section: "appearance",
    inspector: false,
  },
} as const;

export const sliderPrimitiveBinding: PrimitiveBinding<
  SliderCanonicalProps,
  SliderRacProps
> = {
  tag: "Slider",
  family: "selection",
  runtime: {
    source: "react-aria-components",
    exportName: "Slider",
  },
  defaultProps: {
    label: "Slider",
    value: 50,
    minValue: 0,
    maxValue: 100,
    step: 1,
    size: "md",
    orientation: "horizontal",
    isEmphasized: false,
    showValueLabel: true,
    isDisabled: false,
    isReadOnly: false,
  },
  props: {
    accepts: sliderAccepts,
  },
  toRacProps: toSliderRacProps,
  skiaPrimitive: { kind: "slider" },
};

export const sliderInspectorThemeValues = {
  sizes: {
    Slider: SLIDER_SIZE_VALUES,
  },
};
