/**
 * ADR-142 family ④(collections) — Menu primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Menu.tsx`/MenuButton)가 useCollectionData(dataBinding → items)로 채우고
 * RAC Menu + MenuItem 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */
import type { PrimitiveBinding } from "../types";
export declare const menuBinding: PrimitiveBinding;
//# sourceMappingURL=Menu.binding.d.ts.map