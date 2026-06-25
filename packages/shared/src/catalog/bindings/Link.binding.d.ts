/**
 * ADR-142 family ①(primitives/actions) — Link leaf RAC primitive 의 `PrimitiveBinding`.
 *
 * Link 는 text-only leaf(배경 없음, fill.alpha:0) + underline(D3 시각, theme/composition 데이터).
 * de-risk 그룹(box+text): Separator(divider) 다음으로 단순. icon/children 합성 없음.
 *
 * D1: RAC `Link` 가 `<a>` 를 emit. href/target/rel/isDisabled 는 RAC props 통과.
 * D2: variant(primary·secondary)/size/staticColor/isQuiet/isExternal 등 편집 surface.
 * D3: 시각(text 색/underline)은 theme/tokens data-* rules. underline 은 Skia 가
 *     buildCatalogShapes 의 spec.composition.rootSelectors text-decoration 데이터로 재현.
 */
import type { PrimitiveBinding } from "../types";
export declare const linkBinding: PrimitiveBinding;
//# sourceMappingURL=Link.binding.d.ts.map