/**
 * ADR-142 family ⑤(Tree·Table) — Tree primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Tree.tsx`)가
 * useCollectionData(dataBinding → tree nodes, ADR-132)로 채우고 RAC Tree + TreeItem 재귀 합성
 * (internal source). 재귀 2D collection 렌더는 RAC 담당.
 *
 * **Skia generic 발효 (skiaLegacy 제거, 2026-06-01 G2(a))**: DOM/Inspector·Skia 모두 catalog
 * generic. Tree render.shapes 는 shell-only(자식 TreeItem 이 독립 Skia 노드로 행 렌더).
 */
import type { PrimitiveBinding } from "../types";
export declare const treeBinding: PrimitiveBinding;
//# sourceMappingURL=Tree.binding.d.ts.map