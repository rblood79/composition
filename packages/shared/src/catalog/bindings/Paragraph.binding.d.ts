import type { PrimitiveBinding } from "../types";
/**
 * Paragraph — TEXT_LEAF 본문 단락 텍스트 leaf (`<p>`).
 *
 * **ADR-912 위험군 해소 (선행-4 deletion-risk → catalog 등록, 2026-06-04)**: [[Text]] 동형.
 *   spec.render.shapes 가 Skia 시각 + 텍스트 측정 height 의 이중 유일 source 였다(deletion-risk).
 *   catalog 등록으로 rule(`COMPONENT_RULES_TABLE.Paragraph`, fontSize+lineHeight+textWeight:400 완비)
 *   + buildCatalogShapes generic 으로 이전 → spec 의존 끊기.
 *
 * **source = internal**: RAC standalone Paragraph 없음 → internal. DOM 은 generic fallthrough
 *   (`react-aria-Paragraph` + data-size + getElementForTag→`<p>`).
 * **Skia = box+text generic**: skiaPrimitive 없음. height=0 TEXT_LEAF. buildCatalogShapes
 *   lineHeight + textWeight push 로 drift 해소(Text 와 동일).
 *
 * D1: composition `<p>` (internal source, generic DOM).
 * D2: children/size 편집 surface.
 * D3: 시각(텍스트 색/크기/lineHeight/weight 400)은 theme rule(COMPONENT_RULES_TABLE.Paragraph).
 */
export declare const paragraphBinding: PrimitiveBinding;
//# sourceMappingURL=Paragraph.binding.d.ts.map