import type { PrimitiveBinding } from "../types";
import {
  CALENDAR_PAGE_BEHAVIOR_VALUES,
  CALENDAR_SELECTION_ALIGNMENT_VALUES,
  CALENDAR_SIZE_VALUES,
  CALENDAR_VARIANT_VALUES,
  DATE_FIELD_CALENDAR_VALUES,
  toCalendarRacProps,
  type CalendarCanonicalProps,
  type CalendarRacProps,
} from "../outputs/toRacProps";

const calendarAccepts = {
  variant: {
    kind: "enum",
    label: "Variant",
    section: "appearance",
    default: "default",
    options: CALENDAR_VARIANT_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
  },
  size: {
    kind: "enum",
    label: "Size",
    section: "appearance",
    default: "md",
    options: CALENDAR_SIZE_VALUES.map((value) => ({
      value,
      label: value.toUpperCase(),
    })),
  },
  defaultValue: {
    kind: "string",
    label: "Default Value",
    section: "content",
    placeholder: "2026-05-21",
    emptyToUndefined: true,
  },
  defaultFocusedValue: {
    kind: "string",
    label: "Focused Month",
    section: "content",
    placeholder: "2026-05-01",
    emptyToUndefined: true,
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
  selectionAlignment: {
    kind: "enum",
    label: "Selection Alignment",
    section: "appearance",
    default: "center",
    options: CALENDAR_SELECTION_ALIGNMENT_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
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
  defaultToday: {
    kind: "boolean",
    label: "Default Today",
    section: "state",
    default: true,
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
  "aria-label": {
    kind: "string",
    label: "ARIA Label",
    section: "state",
    default: "Calendar",
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

export const calendarPrimitiveBinding: PrimitiveBinding<
  CalendarCanonicalProps,
  CalendarRacProps
> = {
  tag: "Calendar",
  family: "date-color",
  runtime: {
    source: "react-aria-components",
    exportName: "Calendar",
  },
  defaultProps: {
    variant: "default",
    size: "md",
    maxVisibleMonths: 1,
    defaultToday: true,
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  },
  props: {
    accepts: calendarAccepts,
  },
  toRacProps: toCalendarRacProps,
  skiaPrimitive: { kind: "calendar" },
};

export const calendarInspectorThemeValues = {
  sizes: {
    Calendar: CALENDAR_SIZE_VALUES,
  },
  variants: {
    Calendar: CALENDAR_VARIANT_VALUES,
  },
};
