/**
 * ADR-142 family ⑦(date) — DatePicker primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`DatePicker.tsx`)가 RAC DatePicker +
 * Label/Group/DateInput/Button/Popover/Calendar 합성(internal source). 캔버스 정적 노드 시각은
 * trigger field(input box + display text + 후행 calendar icon) — Popover+Calendar grid 는 클릭
 * 시 열리는 portal(정적 캔버스 미표시). Skia 는 `datefield_trigger` skiaPrimitive(replace) escape 로
 * trigger field 재현(ADR-912 단계 5 (1b) — skiaLegacy 제거).
 */
import type { PrimitiveBinding } from "../types";
export declare const datePickerBinding: PrimitiveBinding;
//# sourceMappingURL=DatePicker.binding.d.ts.map