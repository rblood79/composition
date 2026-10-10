/**
 * ADR-142 family ⑦(date) — Calendar primitive 의 `PrimitiveBinding`.
 *
 * ADR-256 Phase 9: DOM = RAC `Calendar` drawing its node tree — the reference starter's
 * `div.months > div.month (one per shown month) > header (Button[slot=previous] + CalendarHeading +
 * Button[slot=next]) + CalendarGrid > CalendarCell` (`delegatedDom` `calendar` — RAC's values only).
 * Display options (the reference's): `visibleDuration` (a count of days · weeks · months) ·
 * `pageBehavior` · `firstDayOfWeek` · `weeksInMonth`. Skia: the calendar's own box is a shell
 * (`calendar_grid`, Shell-only); its parts draw themselves.
 */

import type { PrimitiveBinding } from "../types";
import {
  DATE_CALENDAR_SYSTEM_PROP,
  DATE_LOCALE_PROP,
  FIRST_DAY_OF_WEEK_PROP,
  VISIBLE_DURATION_PROP,
  WEEKS_IN_MONTH_PROP,
} from "./dateLocaleProps";

export const calendarBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "calendar",
  },
  // ADR-912 단계 5 (1b): 날짜 grid(6주×7일) Skia 시각을 `calendar_grid` skiaPrimitive(replace)로
  // 이전(spec.render.shapes → escape hatch).
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
        default: "M",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): delegatedDom `calendarProps` 가 소비 —
      //   RAC Calendar 공식 prop. min/maxValue 는 ISO 문자열로 렌더러가 파싱,
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
      minValue: { kind: "string", label: "Min Value", section: "state" },
      maxValue: { kind: "string", label: "Max Value", section: "state" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "state",
      },
      visibleDuration: VISIBLE_DURATION_PROP,
      weeksInMonth: WEEKS_IN_MONTH_PROP,
      // react-aria.adobe.com "International calendars": unset = the browser's locale.
      locale: DATE_LOCALE_PROP,
      calendarSystem: DATE_CALENDAR_SYSTEM_PROP,
      firstDayOfWeek: FIRST_DAY_OF_WEEK_PROP,
    },
    toRacProps: "default",
  },
};
