/**
 * ADR-142 family ⑦(date) — DateRangePicker primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`DateRangePicker.tsx`)가 RAC DateRangePicker +
 * Label/Group/DateInput(start·end)/Button/Popover/RangeCalendar 합성(internal source). 캔버스 정적
 * 노드 시각은 range trigger field(input box + "start – end" text + 후행 calendar icon, 기본 폭 320)
 * — Popover+범위 grid 는 portal(정적 캔버스 미표시). Skia 는 `datefield_trigger` skiaPrimitive
 * (replace) escape 로 trigger field 재현(ADR-912 단계 5 (1b) — skiaLegacy 제거).
 */

import type { PrimitiveBinding } from "../types";

export const dateRangePickerBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "daterangepicker",
  },
  // ADR-912 단계 5 (1b): range trigger field Skia 시각을 `datefield_trigger` skiaPrimitive(replace)로
  // 이전. range 판정은 escape 가 props.startDate/endDate/_dateRange 로 수행(폭 320 + "start – end").
  skiaPrimitive: "datefield_trigger",
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: {
        kind: "string",
        label: "Description",
        section: "content",
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
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      showCalendarIcon: {
        kind: "boolean",
        label: "Show Calendar Icon",
        section: "appearance",
      },
      // calendar 아이콘 이름 D2 (DatePicker 동형). SSOT=부모 props.iconName.
      iconName: {
        kind: "icon",
        label: "Calendar Icon",
        section: "appearance",
        default: "calendar",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      granularity: {
        kind: "enum",
        label: "Granularity",
        section: "content",
        options: [
          { value: "day", label: "Day" },
          { value: "hour", label: "Hour" },
          { value: "minute", label: "Minute" },
          { value: "second", label: "Second" },
        ],
      },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      minValue: { kind: "string", label: "Min Value", section: "state" },
      maxValue: { kind: "string", label: "Max Value", section: "state" },
    },
    toRacProps: "default",
  },
};
