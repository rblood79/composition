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
export declare const calendarBinding: PrimitiveBinding;
//# sourceMappingURL=Calendar.binding.d.ts.map