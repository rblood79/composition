/**
 * ADR-142 family ④(collections) — ComboBox primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`ComboBox.tsx`)가 useResolvedCollectionItems(dataBinding|items → rows)로 채우고
 * RAC ComboBox + Label/Input/Button/Popover/ListBox 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */
import type { PrimitiveBinding } from "../types";
export declare const comboBoxBinding: PrimitiveBinding;
//# sourceMappingURL=ComboBox.binding.d.ts.map