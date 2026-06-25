/**
 * ADR-142 family ④(collections) — Tabs primitive 의 `PrimitiveBinding`.
 *
 * composition wrapper(`Tabs.tsx`)가 useCollectionData(dataBinding → tab items)로 채우고
 * RAC Tabs + TabList/Tab/TabPanel 합성(internal source). Skia generic 발효(skiaLegacy 제거, ADR-912 단계 4).
 */
import type { PrimitiveBinding } from "../types";
export declare const tabsBinding: PrimitiveBinding;
//# sourceMappingURL=Tabs.binding.d.ts.map