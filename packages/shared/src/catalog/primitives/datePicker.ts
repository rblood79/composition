import type { PrimitiveBinding } from "../types";
import {
  BUTTON_SIZE_VALUES,
  CALENDAR_PAGE_BEHAVIOR_VALUES,
  DATE_FIELD_CALENDAR_VALUES,
  DATE_FIELD_GRANULARITY_VALUES,
  DATE_PICKER_CALENDAR_ICON_POSITION_VALUES,
  DATE_PICKER_TIME_FORMAT_VALUES,
  FORM_VALIDATION_BEHAVIOR_VALUES,
  TEXT_FIELD_LABEL_POSITION_VALUES,
  TEXT_FIELD_NECESSITY_INDICATOR_VALUES,
  toDatePickerRacProps,
  type DatePickerCanonicalProps,
  type DatePickerRacProps,
} from "../outputs/toRacProps";

const datePickerAccepts = {
  label: {
    kind: "string",
    label: "Label",
    section: "content",
    default: "Date",
  },
  defaultValue: {
    kind: "string",
    label: "Default Value",
    section: "content",
    default: "2026-05-21",
    placeholder: "2026-05-21",
    emptyToUndefined: true,
  },
  placeholder: {
    kind: "string",
    label: "Placeholder",
    section: "content",
    emptyToUndefined: true,
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
  showCalendarIcon: {
    kind: "boolean",
    label: "Calendar Icon",
    section: "appearance",
    default: true,
  },
  calendarIconPosition: {
    kind: "enum",
    label: "Icon Position",
    section: "appearance",
    default: "right",
    options: DATE_PICKER_CALENDAR_ICON_POSITION_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
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
  pageBehavior: {
    kind: "enum",
    label: "Page Behavior",
    section: "appearance",
    default: "visible",
    options: CALENDAR_PAGE_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  maxVisibleMonths: {
    kind: "number",
    label: "Visible Months",
    section: "appearance",
    default: 1,
    min: 1,
    max: 3,
    step: 1,
  },
  includeTime: {
    kind: "boolean",
    label: "Include Time",
    section: "content",
    default: false,
  },
  timeFormat: {
    kind: "enum",
    label: "Time Format",
    section: "appearance",
    default: "24h",
    options: DATE_PICKER_TIME_FORMAT_VALUES.map((value) => ({
      value,
      label: value,
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
  calendarSystem: {
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
  validationBehavior: {
    kind: "enum",
    label: "Validation",
    section: "state",
    default: "native",
    options: FORM_VALIDATION_BEHAVIOR_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
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

export const datePickerPrimitiveBinding: PrimitiveBinding<
  DatePickerCanonicalProps,
  DatePickerRacProps
> = {
  tag: "DatePicker",
  family: "date-color",
  runtime: {
    source: "react-aria-components",
    exportName: "DatePicker",
  },
  defaultProps: {
    label: "Date",
    defaultValue: "2026-05-21",
    size: "md",
    labelPosition: "top",
    granularity: "day",
    showCalendarIcon: true,
    calendarIconPosition: "right",
    maxVisibleMonths: 1,
    includeTime: false,
    timeFormat: "24h",
    defaultToday: false,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  },
  props: {
    accepts: datePickerAccepts,
  },
  toRacProps: toDatePickerRacProps,
  skiaPrimitive: { kind: "date-picker" },
};

export const datePickerInspectorThemeValues = {
  sizes: {
    DatePicker: BUTTON_SIZE_VALUES,
  },
};
