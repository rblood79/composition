import type { PrimitiveBinding } from "../types";
/**
 * Heading — TEXT_LEAF 제목 텍스트 leaf (`<h1>`~`<h6>`, level prop).
 *
 * **ADR-912 위험군 해소 (선행-4 deletion-risk → catalog 등록, 2026-06-04)**: [[Text]] 동형.
 *   spec.render.shapes 가 Skia 시각 + 텍스트 측정 height 의 이중 유일 source 였다(deletion-risk).
 *   catalog 등록으로 rule(`COMPONENT_RULES_TABLE.Heading`, fontSize+lineHeight+textWeight:700 완비)
 *   + buildCatalogShapes generic 으로 이전 → spec 의존 끊기.
 *
 * **source = internal**: RAC `Heading` 은 Dialog/Disclosure slot 컴포넌트라 standalone leaf 부적합 →
 *   internal. DOM 은 generic fallthrough(`react-aria-Heading` + data-size + getElementForTag→`<h1-6>`).
 * **Skia = box+text generic**: skiaPrimitive 없음. height=0 TEXT_LEAF + textWeight:700(제목 굵기).
 *   buildCatalogShapes lineHeight + textWeight push 로 fontSize*1.5 / 500 fallback drift 해소.
 *
 * D1: composition `<h1-6>` (level prop, internal source, generic DOM).
 * D2: children/size/level 편집 surface.
 * D3: 시각(텍스트 색/크기/lineHeight/weight 700)은 theme rule(COMPONENT_RULES_TABLE.Heading).
 */
export declare const headingBinding: PrimitiveBinding;
//# sourceMappingURL=Heading.binding.d.ts.map