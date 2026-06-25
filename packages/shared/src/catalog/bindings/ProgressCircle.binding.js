/**
 * ProgressCircle — 원형 진행률 leaf (track arc + value 비례 indicator arc).
 *
 * **ADR-912 진로 1번 ProgressCircle proof slice (value-fill internal leaf catalog 발효, 2026-06-06)**:
 *   ProgressCircle 은 catalog 미등록 상태에서 spec.render.shapes(ProgressCircle.spec.ts:125-235)가
 *   Skia 시각 source 였고, DOM 은 rendererMap.renderProgressCircle(LayoutRenderers.tsx:1717) inline
 *   함수가 SVG `<circle stroke-dasharray>` 로 담당했다. factory `children: []`(leaf, 자식 Element 아님,
 *   DisplayComponents.ts:530) + value/size/isIndeterminate 는 props.
 *
 *   **Skia escape 필요 (value-fill 군 — buildCatalogShapes 한계)**: `skiaPrimitive: "value_fill_arc"`
 *   escape(skiaPrimitives.ts:938-1007, **replace** 모드 — SKIA_PRIMITIVE_MODES 미등록 = replace 기본).
 *   value_fill_arc 가 track arc(360°) + indicator arc(value/100 × 360°)를 자체 생성한다.
 *   buildCatalogShapes 는 roundRect+border+text 만 그려 arc(원형 ring)를 표현 불가 → escape 필수
 *   (Avatar circle escape 동형, "원/선/아이콘 등 box+text 로 표현 안 되는 도형은 skiaPrimitive 담당"
 *   buildCatalogShapes 주석 정합). arc shape 는 specShapeConverter 가 렌더 지원(spec 이 이미 쓰던 경로).
 *
 *   **DOM**: source.renderer="progresscircle" → INTERNAL_RENDERERS["progresscircle"](ProgressCircle.tsx
 *   React 컴포넌트, SVG stroke-dasharray). value/size/isIndeterminate 가 props 라 generic box+text
 *   fallback 으로는 SVG ring 을 안 그린다(circle stroke-dasharray 미지원) → INTERNAL_RENDERERS 어댑터
 *   필수(Avatar 선례 동형 — circle 시각 + Skia primitive escape + props 정적).
 *
 *   **propPassthrough: ["size"] (Avatar 선례 동형)**: ProgressCircle.tsx(INTERNAL_RENDERERS 어댑터)는
 *   size 가 지름·strokeWidth 계산의 input 이다. catalog 의 size kind 는 기본 data-attr 라우팅(`data-size`)
 *   이라 그대로 두면 ProgressCircle.tsx 의 size prop 이 undefined → 항상 default(md) 고정(Avatar/
 *   StatusLight 변경 미반영 비대칭과 동일 root-cause). size 를 propPassthrough 로 통과시켜 React prop +
 *   data-size 둘 다 emit. value(number kind)/isIndeterminate(boolean kind)는 DATA_ATTR_KINDS 가 아니라
 *   기본 React prop 통과 → propPassthrough 불요. variant 는 단일 "default" 고정이라 accepts 제외.
 *
 * D1: composition `<div role="progressbar">` (SVG circle track + indicator, internal source, 어댑터).
 * D2: value(0-100) + size(sm/md/lg) + isIndeterminate.
 * D3: track 색 = rule fill base({color.neutral-subtle}=var(--bg-muted)) / indicator 색 = {color.accent}.
 *     Skia escape(value_fill_arc) ↔ DOM SVG stroke 시각 대칭.
 */
export const progressCircleBinding = {
    source: {
        kind: "internal",
        renderer: "progresscircle",
    },
    props: {
        accepts: {
            value: {
                kind: "number",
                label: "Value",
                section: "content",
                default: 0,
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
            isIndeterminate: {
                kind: "boolean",
                label: "Indeterminate",
                section: "content",
            },
        },
        toRacProps: "default",
        // size 는 ProgressCircle.tsx(INTERNAL_RENDERERS 어댑터)의 지름·strokeWidth 계산 input → data-attr
        // 가 아니라 React prop 으로 통과(Avatar 선례 동형). data-size 도 함께 emit(CSS/debug marker 보존).
        propPassthrough: ["size"],
    },
    skiaPrimitive: "value_fill_arc",
};
//# sourceMappingURL=ProgressCircle.binding.js.map