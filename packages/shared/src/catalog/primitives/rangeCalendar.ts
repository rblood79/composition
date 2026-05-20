import type { PrimitiveBinding } from "../types";
import {
  CALENDAR_SIZE_VALUES,
  CALENDAR_VARIANT_VALUES,
  DATE_FIELD_CALENDAR_VALUES,
  toRangeCalendarRacProps,
  type RangeCalendarCanonicalProps,
  type RangeCalendarRacProps,
} from "../outputs/toRacProps";

const rangeCalendarAccepts = {
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
  defaultStartValue: {
    kind: "string",
    label: "Start Date",
    section: "content",
    default: "2026-05-10",
    placeholder: "2026-05-10",
  },
  defaultEndValue: {
    kind: "string",
    label: "End Date",
    section: "content",
    default: "2026-05-16",
    placeholder: "2026-05-16",
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
  allowsNonContiguousRanges: {
    kind: "boolean",
    label: "Non-contiguous",
    section: "state",
    default: false,
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
    default: "Range calendar",
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

export const rangeCalendarPrimitiveBinding: PrimitiveBinding<
  RangeCalendarCanonicalProps,
  RangeCalendarRacProps
> = {
  tag: "RangeCalendar",
  family: "date-color",
  runtime: {
    source: "react-aria-components",
    exportName: "RangeCalendar",
  },
  defaultProps: {
    variant: "default",
    size: "md",
    maxVisibleMonths: 1,
    defaultStartValue: "2026-05-10",
    defaultEndValue: "2026-05-16",
    isDisabled: false,
    isReadOnly: false,
    isInvalid: false,
  },
  props: {
    accepts: rangeCalendarAccepts,
  },
  toRacProps: toRangeCalendarRacProps,
  skiaPrimitive: { kind: "range-calendar" },
};

export const rangeCalendarInspectorThemeValues = {
  sizes: {
    RangeCalendar: CALENDAR_SIZE_VALUES,
  },
  variants: {
    RangeCalendar: CALENDAR_VARIANT_VALUES,
  },
};
