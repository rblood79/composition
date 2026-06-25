/**
 * ADR-142 family ⑤(Tree·Table) — Table primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Table.tsx`, default
 * export)가 useCollectionData(dataBinding → rows, ADR-132) + columns 로 채우고 RAC Table +
 * TableHeader/Column/Row/Cell 2D 합성(internal source). 2D collection 렌더는 RAC 담당.
 *
 * **Skia generic 발효 (skiaLegacy 제거, ADR-912 단계 4 C1 2026-06-03)**: DOM/Inspector·Skia 모두
 * catalog generic. 2D grid 는 Table 2D projection(RowsGroup → Row[i] → Cell[i][j])으로 Skia 렌더.
 * columns 는 columnMapping/binding 데이터라 generic Inspector kind:"binding" 로 표현.
 */
import type { PrimitiveBinding } from "../types";
export declare const tableBinding: PrimitiveBinding;
//# sourceMappingURL=Table.binding.d.ts.map