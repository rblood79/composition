/**
 * ADR-142 family ④(collections) — GridList primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`GridList.tsx`)가 useResolvedCollectionItems(dataBinding|items → rows)로 채우고
 * RAC GridList + GridListItem 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4 C1).
 */
import type { PrimitiveBinding } from "../types";
export declare const gridListBinding: PrimitiveBinding;
//# sourceMappingURL=GridList.binding.d.ts.map