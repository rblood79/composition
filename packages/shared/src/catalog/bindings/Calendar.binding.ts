/**
 * ADR-142 family ⑦(date) — Calendar primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Calendar.tsx`)가 RAC
 * Calendar + CalendarGrid/CalendarHeader/CalendarCell 합성(internal source). 날짜 grid 는
 * 비-box 시각(6주 × 7일 cell + 헤더) → DOM 은 RAC 가 grid 자동 합성, Skia 는 `calendar_grid`
 * skiaPrimitive(replace) escape 로 grid 시각 재현(ADR-912 단계 5 (1b) — skiaLegacy 제거).
 *
 * color 계열은 ADR-912 단계5에서 leaf/container 별도 slice 로 catalog cutover 완료.
 */

import type { PrimitiveBinding } from "../types";

export const calendarBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "calendar",
  },
  // ADR-912 단계 5 (1b): 날짜 grid(6주×7일) Skia 시각을 `calendar_grid` skiaPrimitive(replace)로
  // 이전(spec.render.shapes → escape hatch). skiaLegacy 제거 → isCatalogSkiaCutover=true 경로.
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
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): renderCalendar 기소비 —
      //   RAC Calendar 공식 prop. min/maxValue 는 ISO 문자열로 렌더러가 파싱,
      //   maxVisibleMonths 는 RSP visibleMonths 대응 (렌더러 기본 1).
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      pageBehavior: {
        kind: "enum",
        label: "Page Behavior",
        section: "content",
        options: [
          { value: "visible", label: "Visible" },
          { value: "single", label: "Single" },
        ],
      },
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
    },
    toRacProps: "default",
  },
};
