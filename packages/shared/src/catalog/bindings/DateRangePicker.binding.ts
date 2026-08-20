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
      // design-data 감사 (2026-08-20): DateRenderers `resolvePlaceholder` 가
      //   placeholderValue → placeholder 순으로 읽어 renderDateRangePicker(304) 에서
      //   이미 소비하는데 accepts 선언이 없어 편집 표면이 통째 결손이었다. DatePicker
      //   binding 은 동일 채널을 노출 중 — 형제 대칭 회복.
      placeholder: {
        kind: "string",
        label: "Placeholder",
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
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderDateRangePicker 기소비 —
      //   RAC/RSP DateRangePicker 공식 prop. hideTimeZone/shouldForceLeadingZeros/
      //   shouldCloseOnSelect 는 렌더러 기본값이 true (`!== false`) 라 default: true 명시.
      startName: { kind: "string", label: "Start Name", section: "content" },
      endName: { kind: "string", label: "End Name", section: "content" },
      isRequired: { kind: "boolean", label: "Required", section: "state" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      hourCycle: {
        kind: "enum",
        label: "Hour Cycle",
        section: "locale",
        options: [
          { value: "12", label: "12" },
          { value: "24", label: "24" },
        ],
      },
      hideTimeZone: {
        kind: "boolean",
        label: "Hide Time Zone",
        section: "locale",
        default: true,
      },
      pageBehavior: {
        kind: "enum",
        label: "Page Behavior",
        section: "content",
        options: [
          { value: "visible", label: "Visible" },
          { value: "single", label: "Single" },
        ],
      },
      shouldForceLeadingZeros: {
        kind: "boolean",
        label: "Leading Zeros",
        section: "locale",
        default: true,
      },
      shouldCloseOnSelect: {
        kind: "boolean",
        label: "Close On Select",
        section: "state",
        default: true,
      },
      maxVisibleMonths: {
        kind: "number",
        label: "Max Visible Months",
        section: "content",
        min: 1,
      },
      allowsNonContiguousRanges: {
        kind: "boolean",
        label: "Non-contiguous Ranges",
        section: "state",
      },
      validationBehavior: {
        kind: "enum",
        label: "Validation",
        section: "state",
        options: [
          { value: "native", label: "Native" },
          { value: "aria", label: "ARIA" },
        ],
      },
    },
    toRacProps: "default",
    // size 는 DateRangePicker.tsx 가 React prop 으로 직접 소비 + 자기 `data-size` 를 다시 emit
    //   → passthrough 없으면 default("md") 고정 + toRacProps 의 data-size 를 덮어씀
    //   (DatePicker.binding 과 동일 근거, ProgressCircle/Avatar/StatusLight 선례).
    propPassthrough: ["size"],
  },
};
