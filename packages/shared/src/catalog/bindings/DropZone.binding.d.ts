/**
 * ADR-142 family ⑥(overlays) — DropZone primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`DropZone.tsx`)가 RAC DropZone + label/
 * description/drop 영역 합성(internal source). drop 시각(dashed border/hover 등)은 VariantSpec/
 * ComponentRuleVariant 의 textWeight/borderStyle 보편 D3 속성으로 표현 → Skia generic 발효
 * (skiaLegacy 제거, ADR-912 단계 4).
 */
import type { PrimitiveBinding } from "../types";
export declare const dropZoneBinding: PrimitiveBinding;
//# sourceMappingURL=DropZone.binding.d.ts.map