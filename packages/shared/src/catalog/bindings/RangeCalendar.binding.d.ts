/**
 * ADR-142 family ⑦(date) — RangeCalendar primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`RangeCalendar.tsx`)가 RAC RangeCalendar +
 * grid 합성(internal source). 범위 선택 날짜 grid 는 Calendar 와 시각 동형(RangeCalendar.spec =
 * `...CalendarSpec`) → Skia 는 동일 `calendar_grid` skiaPrimitive(replace) escape 재사용
 * (ADR-912 단계 5 (1b) — skiaLegacy 제거).
 */
import type { PrimitiveBinding } from "../types";
export declare const rangeCalendarBinding: PrimitiveBinding;
//# sourceMappingURL=RangeCalendar.binding.d.ts.map