import type { PrimitiveBinding } from "../types";

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
export const progressCircleBinding: PrimitiveBinding = {
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
      // 형제 대칭 (design-data 감사 §1-3, 2026-08-21): ProgressBar 와 동일 min/max 표면.
      //   number kind 는 기본 React prop 통과 — 어댑터·Skia escape 가 (value-min)/(max-min)
      //   비율로 정규화 (구 0-100 하드코딩 해소).
      minValue: { kind: "number", label: "Min", section: "content" },
      maxValue: { kind: "number", label: "Max", section: "content" },
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
      // RSP S2 "over background" (design-data 감사 §2-F, 2026-08-21): 유색/이미지 배경 위
      //   고정 흑백 스킴 — Button 형(bg 반전)이 아니라 track=static 25% wash + indicator=solid.
      //   DOM = ProgressCircle.tsx 인라인 stroke / Skia = value_fill_arc 동일 상수 (0.25 대칭).
      staticColor: {
        kind: "enum",
        label: "Static Color",
        section: "appearance",
        default: "auto",
        options: [
          { value: "auto", label: "Auto" },
          { value: "white", label: "White" },
          { value: "black", label: "Black" },
        ],
      },
    },
    toRacProps: "default",
    // size 는 ProgressCircle.tsx(INTERNAL_RENDERERS 어댑터)의 지름·strokeWidth 계산 input → data-attr
    // 가 아니라 React prop 으로 통과(Avatar 선례 동형). data-size 도 함께 emit(CSS/debug marker 보존).
    // staticColor(enum kind → data-attr 라우팅)도 어댑터의 stroke 색 계산 input — 동일 사유 통과.
    propPassthrough: ["size", "staticColor"],
  },
  skiaPrimitive: "value_fill_arc",
};
