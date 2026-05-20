import type { PrimitiveBinding } from "../types";
import {
  BUTTON_SIZE_VALUES,
  DATE_FIELD_CALENDAR_VALUES,
  DATE_FIELD_GRANULARITY_VALUES,
  DATE_FIELD_HOUR_CYCLE_VALUES,
  TEXT_FIELD_LABEL_POSITION_VALUES,
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES,
  toDateFieldRacProps,
  type DateFieldCanonicalProps,
  type DateFieldRacProps,
} from "../outputs/toRacProps";

const dateFieldAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Date",
  },
  value: {
    kind: "string",
    label: "Value",
    section: "content",
    default: "",
    placeholder: "2026-05-20",
  },
  placeholderValue: {
    kind: "string",
    label: "Placeholder Date",
    section: "content",
    default: "2026-01-01",
    placeholder: "2026-01-01",
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
  granularity: {
    kind: "enum",
    label: "Granularity",
    section: "appearance",
    default: "day",
    options: DATE_FIELD_GRANULARITY_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  hourCycle: {
    kind: "enum",
    label: "Hour Cycle",
    section: "appearance",
    default: "24",
    options: DATE_FIELD_HOUR_CYCLE_VALUES.map((value) => ({
      value,
      label: `${value} hour`,
    })),
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
    ] satisfies Array<{ value: string; label: string }>,
    emptyToUndefined: true,
  },
  calendar: {
    kind: "enum",
    label: "Calendar",
    section: "locale",
    default: "gregory",
    options: DATE_FIELD_CALENDAR_VALUES.map((value) => ({
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

export const dateFieldPrimitiveBinding: PrimitiveBinding<
  DateFieldCanonicalProps,
  DateFieldRacProps
> = {
  tag: "DateField",
  family: "fields",
  runtime: {
    source: "react-aria-components",
    exportName: "DateField",
  },
  defaultProps: {
    label: "Date",
    value: "",
    placeholderValue: "2026-01-01",
    granularity: "day",
    hourCycle: 24,
    size: "md",
    labelPosition: "top",
    isRequired: false,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  },
  props: {
    accepts: dateFieldAccepts,
  },
  toRacProps: toDateFieldRacProps,
  skiaPrimitive: { kind: "date-field" },
};

export const dateFieldInspectorThemeValues = {
  sizes: {
    DateField: BUTTON_SIZE_VALUES,
  },
};
