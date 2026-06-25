import type { PrimitiveBinding } from "../types";
/**
 * FormField — Form 필드 그룹 슬롯 컨테이너 (Label + 입력 컨트롤 묶음, composition 자체 추상,
 * RAC/starter 전용 컴포넌트 없음). Form factory(`FormComponents.ts`)가 Form 생성 시 Heading/
 * Description 과 함께 자동 생성한다. palette 미노출 sub-part(DialogFooter/Field 동형).
 *
 * **ADR-912 childSpec→catalog cutover (2026-06-15)**:
 *   FormField 는 `FormField.spec.ts`(render.shapes:()=>[], skipCSSGeneration:true) 가 부모
 *   `Form.spec.childSpecs`(ADR-094 expandChildSpecs) 경로로 TAG_SPEC_MAP/Taffy 에 자동 등록되고,
 *   generated CSS 는 Form.css 내부 embed(ADR-078, CSSGenerator embedMode 가 skipCSSGeneration
 *   우회) 됐다. catalog 등록으로 시각 source 를 rule(`COMPONENT_RULES_TABLE.FormField`, 이미 freeze
 *   정본에 존재) + buildCatalogShapes generic box(shell)로 이전하여 spec 의존(childSpecs 경로)을 끊는다.
 *   DialogFooter cutover(2026-06-15) 동형 — 두 번째 childSpec 제거 사례.
 *
 * **시각 = factory props.style SSOT (ADR-907 Layer B)**: 필드 그룹 layout(`display:flex` /
 *   `flexDirection:column` / `gap:"4px"` / `width:"100%"`)은 factory `props.style`
 *   (FormComponents.ts:222-227)가 담당 — Skia/Taffy 가 직접 read. rule/CSS 의 base(`inline-flex`)/
 *   size-indexed gap 은 fallback. buildCatalogShapes 는 shell-only(render.shapes []와 시각 동일 —
 *   필드 그룹 시각은 자식 Label/입력 Element 가 그림).
 *
 * **DOM parity = 변화 0 (Body/DialogFooter 동형)**: INTERNAL_RENDERERS 미등록 → CanonicalNodeRenderer
 *   generic fallback 유지. isSpecOrCatalogBacked(spec || isCatalogCutover) 가 catalog 등록 후에도
 *   true → `react-aria-FormField` className + data-size 보존. KNOWN_HTML FormField→div(선재 등록,
 *   불변)로 generic tag 도 `<div>` 유지. builder 메인 Preview(App.tsx)는 resolveHtmlTag switch 가
 *   이미 div 반환(불변).
 *
 * D1: composition `<div>` (internal source, generic DOM via KNOWN_HTML FormField→div).
 * D2: size 만 — slot 컨테이너 최소 surface.
 * D3: 시각 shell(투명, fill 없음). layout 은 factory props.style.
 */
export declare const formFieldBinding: PrimitiveBinding;
//# sourceMappingURL=FormField.binding.d.ts.map