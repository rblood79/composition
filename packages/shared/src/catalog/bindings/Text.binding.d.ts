import type { PrimitiveBinding } from "../types";
/**
 * Text — TEXT_LEAF 순수 텍스트 leaf (`<p>`).
 *
 * **ADR-912 위험군 해소 (선행-3/4 deletion-risk → catalog 등록, 2026-06-04)**: Text 는
 *   catalog 미등록 상태에서 spec.render.shapes 가 Skia 시각 + 텍스트 측정 height 의 이중
 *   유일 source 였다(deletion-risk). catalog 등록으로 시각·측정을 모두 rule(`COMPONENT_RULES_TABLE.Text`,
 *   fontSize+lineHeight 완비) + buildCatalogShapes generic 으로 이전하여 spec 의존을 끊는다.
 *
 * **source = internal**: RAC 에 standalone `Text` controller 없음(slot 컴포넌트) → internal.
 *   단 DOM 은 INTERNAL_RENDERERS 미등록이라 CanonicalNodeRenderer 의 generic fallthrough
 *   (`react-aria-Text` className + data-size + getElementForTag→`<p>` + generated CSS)로 렌더된다.
 *   별도 DOM 렌더러 신설 불요(generic 경로가 size 시각 커버).
 *
 * **Skia = box+text generic**: skiaPrimitive 없음 → buildCatalogShapes(transparent bg + text).
 *   height=0 순수 텍스트라 lineHeight 가 측정 본질 → buildCatalogShapes lineHeight push 보강
 *   (2026-06-04)으로 catalog 측정 경로의 fontSize*1.5 fallback drift 해소.
 *
 * D1: composition `<p>` (RAC primitive 아님 — internal source, generic DOM).
 * D2: children/size 편집 surface.
 * D3: 시각(텍스트 색/크기/lineHeight)은 theme rule(COMPONENT_RULES_TABLE.Text).
 */
export declare const textBinding: PrimitiveBinding;
//# sourceMappingURL=Text.binding.d.ts.map