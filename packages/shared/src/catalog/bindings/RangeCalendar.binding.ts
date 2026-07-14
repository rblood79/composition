/**
 * ADR-142 family ⑦(date) — RangeCalendar primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`RangeCalendar.tsx`)가 RAC RangeCalendar +
 * grid 합성(internal source). 범위 선택 날짜 grid 는 Calendar 와 시각 동형(RangeCalendar.spec =
 * `...CalendarSpec`) → Skia 는 동일 `calendar_grid` skiaPrimitive(replace) escape 재사용
 * (ADR-912 단계 5 (1b) — skiaLegacy 제거).
 */

import type { PrimitiveBinding } from "../types";

export const rangeCalendarBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "rangecalendar",
  },
  // ADR-912 단계 5 (1b): Calendar 와 동일 grid 시각 → `calendar_grid` skiaPrimitive 재사용.
  skiaPrimitive: "calendar_grid",
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderRangeCalendar 기소비 —
      //   RAC RangeCalendar 공식 prop. min/maxValue 는 ISO 문자열로 렌더러가 파싱.
      minValue: { kind: "string", label: "Min Value", section: "state" },
      maxValue: { kind: "string", label: "Max Value", section: "state" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      maxVisibleMonths: {
        kind: "number",
        label: "Max Visible Months",
        section: "content",
        min: 1,
        default: 1,
      },
      allowsNonContiguousRanges: {
        kind: "boolean",
        label: "Non-contiguous Ranges",
        section: "state",
      },
    },
    toRacProps: "default",
  },
};
