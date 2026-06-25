import type { PrimitiveBinding } from "../types";
/**
 * DialogFooter — Dialog 액션 버튼 영역 슬롯 컨테이너 (composition 자체 추상, RAC/starter 전용
 * 컴포넌트 없음). Dialog factory(`OverlayComponents.ts`)가 Dialog 생성 시 Heading/Description 과
 * 함께 자동 생성한다. palette 미노출 sub-part(SelectTrigger/SelectValue/Field 동형).
 *
 * **ADR-912 childSpec→catalog cutover (2026-06-15)**:
 *   DialogFooter 는 `DialogFooter.spec.ts`(render.shapes:()=>[], skipCSSGeneration:true) 가 부모
 *   `Dialog.spec.childSpecs`(ADR-094 expandChildSpecs) 경로로 TAG_SPEC_MAP/Taffy 에 자동 등록되고,
 *   generated CSS 는 Dialog.css 내부 embed(ADR-078) 됐다. catalog 등록으로 시각 source 를 rule
 *   (`COMPONENT_RULES_TABLE.DialogFooter`, 이미 freeze 정본에 존재) + buildCatalogShapes generic
 *   box(shell)로 이전하여 spec 의존(childSpecs 경로)을 끊는다.
 *
 * **시각 = factory props.style SSOT (ADR-907 Layer B)**: footer layout(`display:flex` /
 *   `justifyContent:flex-end` / `gap:"8px"`)은 factory `props.style`(OverlayComponents.ts:65-69)가
 *   담당 — Skia/Taffy 가 직접 read. rule/CSS 의 base(`inline-flex`)/gap 은 fallback. buildCatalogShapes
 *   는 shell-only(render.shapes []와 시각 동일 — footer 시각은 자식 버튼 Element 가 그림).
 *
 * **DOM parity = 변화 0 (Body 동형)**: INTERNAL_RENDERERS 미등록 → CanonicalNodeRenderer generic
 *   fallback 유지. isSpecOrCatalogBacked(spec || isCatalogCutover) 가 catalog 등록 후에도 true →
 *   `react-aria-DialogFooter` className + data-size 보존. KNOWN_HTML DialogFooter→footer(이번 cutover
 *   동시 추가)로 generic tag 도 `<footer>` 시맨틱(선재 `<dialogfooter>` raw tag 동시 해소). builder
 *   메인 Preview(App.tsx)는 resolveHtmlTag switch case 가 이미 footer 반환(불변).
 *
 * D1: composition `<footer>` (internal source, generic DOM via KNOWN_HTML DialogFooter→footer).
 * D2: size 만 — slot 컨테이너 최소 surface.
 * D3: 시각 shell(투명, fill 없음). layout 은 factory props.style.
 */
export declare const dialogFooterBinding: PrimitiveBinding;
//# sourceMappingURL=DialogFooter.binding.d.ts.map