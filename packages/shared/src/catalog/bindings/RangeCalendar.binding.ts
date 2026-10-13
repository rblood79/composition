/**
 * ADR-142 family ⑦(date) — RangeCalendar primitive 의 `PrimitiveBinding`.
 *
 * ADR-256 Phase 9: DOM = RAC `RangeCalendar` drawing its node tree — the same month blocks as a
 * Calendar (`delegatedDom` `rangecalendar`); the Canvas shell is the Calendar's (`calendar_grid`).
 *
 * No `size` (사용자 2026-10-13 「size 삭제하고 레퍼런스처럼 폭에 반응하는 크기까지」 — RAC · S2 take
 * none): a month is at most 238 wide (7 cells of 30) and shrinks with its parent, its cells with it
 * (S2 `calendarStyles`); an old document's `size` is dropped on load (`s2PropAlignment`).
 */

import type { PrimitiveBinding } from "../types";
import {
  DATE_CALENDAR_SYSTEM_PROP,
  DATE_LOCALE_PROP,
  FIRST_DAY_OF_WEEK_PROP,
  VISIBLE_DURATION_PROP,
  WEEKS_IN_MONTH_PROP,
} from "./dateLocaleProps";

export const rangeCalendarBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "rangecalendar",
  },
  // ADR-912 단계 5 (1b): Calendar 와 동일 grid 시각 → `calendar_grid` skiaPrimitive 재사용.
  skiaPrimitive: "calendar_grid",
  props: {
    accepts: {
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      // design-data 감사 §1-3 (2026-08-21): Calendar 만 노출 중이던 3종 대칭 회복.
      //   RSP RangeCalendar 규정 prop — delegatedDom `rangecalendar` (`calendarProps`) 가 전달한다.
      isInvalid: { kind: "boolean", label: "Invalid", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      pageBehavior: {
        kind: "enum",
        // RAC/HTML 기본과 같은 값 — 패널이 비어 보이지 않게 (2026-09-16)
        default: "visible",
        label: "Page Behavior",
        section: "content",
        options: [
          { value: "visible", label: "Visible" },
          { value: "single", label: "Single" },
        ],
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): delegatedDom `rangecalendar` 가 소비 —
      //   RAC RangeCalendar 공식 prop. min/maxValue 는 ISO 문자열로 렌더러가 파싱.
      minValue: { kind: "string", label: "Min Value", section: "state" },
      maxValue: { kind: "string", label: "Max Value", section: "state" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      visibleDuration: VISIBLE_DURATION_PROP,
      weeksInMonth: WEEKS_IN_MONTH_PROP,
      allowsNonContiguousRanges: {
        kind: "boolean",
        label: "Non-contiguous Ranges",
        section: "state",
      },
      // react-aria.adobe.com "International calendars": unset = the browser's locale.
      locale: DATE_LOCALE_PROP,
      calendarSystem: DATE_CALENDAR_SYSTEM_PROP,
      firstDayOfWeek: FIRST_DAY_OF_WEEK_PROP,
    },
    toRacProps: "default",
  },
};
