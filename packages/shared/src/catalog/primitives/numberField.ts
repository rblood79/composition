import type { PrimitiveBinding } from "../types";
import {
  BUTTON_SIZE_VALUES,
  NUMBER_FIELD_FORMAT_STYLE_VALUES,
  NUMBER_FIELD_NOTATION_VALUES,
  TEXT_FIELD_LABEL_POSITION_VALUES,
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES,
  toNumberFieldRacProps,
  type NumberFieldCanonicalProps,
  type NumberFieldRacProps,
} from "../outputs/toRacProps";

const numberFieldAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Number",
  },
  value: {
    kind: "number",
    label: "Value",
    section: "content",
    default: 0,
  },
  placeholder: {
    kind: "string",
    label: "Placeholder",
    section: "content",
    default: "0",
  },
  description: {
    kind: "string",
    label: "Description",
    section: "content",
    emptyToUndefined: true,
  },
  size: {
    kind: "size",
    label: "Size",
    section: "appearance",
    default: "md",
  },
  labelPosition: {
    kind: "enum",
    label: "Label Position",
    section: "appearance",
    default: "top",
    options: TEXT_FIELD_LABEL_POSITION_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  isQuiet: {
    kind: "boolean",
    label: "Quiet",
    section: "appearance",
    default: false,
  },
  hideStepper: {
    kind: "boolean",
    label: "Hide Stepper",
    section: "appearance",
    default: false,
  },
  minValue: {
    kind: "number",
    label: "Minimum",
    section: "constraints",
    default: 0,
  },
  maxValue: {
    kind: "number",
    label: "Maximum",
    section: "constraints",
    default: 100,
  },
  step: {
    kind: "number",
    label: "Step",
    section: "constraints",
    default: 1,
    min: 0,
    step: 1,
  },
  locale: {
    kind: "enum",
    label: "Locale",
    section: "locale",
    options: [
      { value: "", label: "Auto" },
      { value: "ko-KR", label: "Korean" },
      { value: "en-US", label: "English (US)" },
      { value: "en-GB", label: "English (UK)" },
      { value: "ja-JP", label: "Japanese" },
      { value: "zh-CN", label: "Chinese" },
      { value: "de-DE", label: "German" },
      { value: "fr-FR", label: "French" },
    ] satisfies Array<{ value: string; label: string }>,
    emptyToUndefined: true,
  },
  "formatOptions.style": {
    kind: "enum",
    label: "Format",
    section: "format",
    default: "decimal",
    options: NUMBER_FIELD_FORMAT_STYLE_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  "formatOptions.notation": {
    kind: "enum",
    label: "Notation",
    section: "format",
    default: "standard",
    options: NUMBER_FIELD_NOTATION_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
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
  isInvalid: {
    kind: "boolean",
    label: "Invalid",
    section: "state",
    default: false,
  },
  errorMessage: {
    kind: "string",
    label: "Error Message",
    section: "state",
    visibleWhen: { key: "isInvalid", truthy: true },
    emptyToUndefined: true,
  },
  necessityIndicator: {
    kind: "enum",
    label: "Required",
    section: "state",
    options: TEXT_FIELD_NECESSITY_INDICATOR_VALUES.map((value) => ({
      value,
      label: value === "icon" ? "Icon (*)" : "Label",
    })),
  },
  isRequired: {
    kind: "boolean",
    label: "Required State",
    section: "state",
    inspector: false,
    default: false,
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

export const numberFieldPrimitiveBinding: PrimitiveBinding<
  NumberFieldCanonicalProps,
  NumberFieldRacProps
> = {
  tag: "NumberField",
  family: "fields",
  runtime: {
    source: "react-aria-components",
    exportName: "NumberField",
  },
  defaultProps: {
    label: "Number",
    value: 0,
    placeholder: "0",
    minValue: 0,
    maxValue: 100,
    step: 1,
    formatOptions: { style: "decimal", notation: "standard" },
    size: "md",
    labelPosition: "top",
    isRequired: false,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  },
  props: {
    accepts: numberFieldAccepts,
  },
  toRacProps: toNumberFieldRacProps,
  skiaPrimitive: { kind: "number-field" },
};

export const numberFieldInspectorThemeValues = {
  sizes: {
    NumberField: BUTTON_SIZE_VALUES,
  },
};
