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
export declare const dateRangePickerBinding: PrimitiveBinding;
//# sourceMappingURL=DateRangePicker.binding.d.ts.map