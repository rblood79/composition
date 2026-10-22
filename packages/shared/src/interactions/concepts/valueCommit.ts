import type {
  ColorAreaProps,
  ColorSliderProps,
  ColorWheelProps,
  SliderProps,
} from "react-aria-components";
import type { InteractionConcept } from "./types";

/**
 * RAC `useSliderState` · color controls (Slider.md · ColorArea.md · ColorSlider.md ·
 * ColorWheel.md "Value"): `onChange` while dragging + `onChangeEnd` on release.
 */
const SLIDER = [
  "value",
  "defaultValue",
  "onChange",
  "onChangeEnd",
  "isDisabled",
] as const satisfies readonly (keyof SliderProps)[];
const COLOR_AREA = SLIDER satisfies readonly (keyof ColorAreaProps)[];
const COLOR_SLIDER = SLIDER satisfies readonly (keyof ColorSliderProps)[];
const COLOR_WHEEL = SLIDER satisfies readonly (keyof ColorWheelProps)[];
void [COLOR_AREA, COLOR_SLIDER, COLOR_WHEEL];

export const valueCommitNumber = {
  id: "valueCommit",
  racDoc: "Slider.md — Value (onChange · onChangeEnd)",
  racType: "SliderProps",
  events: ["onChange", "onChangeEnd"],
  args: { onChange: ["value"], onChangeEnd: ["value"] },
  state: {
    prop: "value",
    defaultProp: "defaultValue",
    callback: "onChange",
    valueType: "number",
  },
  conditions: ["isDisabled"],
  capabilities: {
    setValue: {
      labelKey: "capabilities.setValue",
      value: "!param",
      param: { kind: "number", labelKey: "capabilities.paramValue" },
    },
  },
} as const satisfies InteractionConcept;

export const valueCommitColor = {
  ...valueCommitNumber,
  racDoc: "ColorSlider.md — Value (onChange · onChangeEnd)",
  racType: "ColorAreaProps · ColorSliderProps · ColorWheelProps",
  state: { ...valueCommitNumber.state, valueType: "color" },
  capabilities: {
    setValue: {
      labelKey: "capabilities.setValue",
      value: "!param",
      param: { kind: "text", labelKey: "capabilities.paramValue" },
    },
  },
} as const satisfies InteractionConcept;
