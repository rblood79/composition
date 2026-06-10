import type { PrimitiveBinding } from "../types";

/**
 * DisclosureContent — Disclosure 패널 콘텐츠 영역 leaf (RAC DisclosurePanel 내부 컨테이너 div).
 *
 * **ADR-912 catalog cutover (box+text 변환 군, 2026-06-10)**: DisclosureContent 는 catalog 미등록
 *   상태에서 spec.render.shapes(DisclosureContent.spec.ts)가 Skia 시각 유일 source 였다 — `_hasChildren`
 *   false 시 box+text generic 1개. 이때 spec sizes.paddingX(md 12)가 **Skia text x offset 에만 적용**
 *   되고 DOM(renderDisclosureContent `<div style>`, skipCSSGeneration 이라 generated CSS 없음)에는
 *   미적용 → "padding 이 Skia 에만 주입" 비대칭(사용자 보고 2026-06-10). catalog 등록으로 시각을 rule
 *   (`COMPONENT_RULES_TABLE.DisclosureContent`: fontSize+lineHeight+textWeight 400, paddingX 미정의=0)
 *   + buildCatalogShapes generic 으로 이전 → spec 의존 끊기 + padding 단일 source 화.
 *
 * **padding 단일 source = element.props.style (DOM↔Skia 대칭)**: buildCatalogShapes(:192)는
 *   `style.paddingLeft ?? size.paddingX ?? 0` 으로 text x 를 잡는다. rule paddingX 미정의 → 기본 0
 *   (spec 의 강제 12 제거 — 사용자 "spec 기본 padding 제거" 정합). 사용자가 style.padding 을 주면
 *   Skia(buildCatalogShapes style.paddingLeft) ↔ DOM(renderDisclosureContent `<div style>`)이 같은
 *   `element.props.style` 에서 파생 → 시각 대칭([[feedback-single-source-not-same-output-form]]).
 *
 * **Skia = box+text generic (escape 없음)**: 텍스트 담는 컨테이너 div = transparent bg + text.
 *   circle/arc/image 미사용이라 skiaPrimitive escape 불필요 (Description 동형). `_hasChildren`=true
 *   (자식 element 존재) 시 buildCatalogShapes shell box(transparent → 빈 box) + 자식 독립 렌더,
 *   텍스트 children 만이면 inline text — spec 의 `if hasChildren return [] / if !text return []` 와
 *   시각 대칭.
 *
 * **DOM = renderDisclosureContent (DELEGATING_INTERNAL_RENDERERS, 2026-06-10 sweep)**: 1차 경로는
 *   부모 renderDisclosure 가 DisclosureHeader 를 title 로 흡수하고 contentChildren(DisclosureContent
 *   포함)을 renderElement 로 재귀 → renderDisclosureContent 가 `<div style={element.props.style}>` +
 *   (자식 element 또는 텍스트) 렌더. renderDisclosureContent 는 `childrenByParent.get(id)` 로 자식
 *   element 를 받으므로(텍스트는 props.children fallback), 독립 진입(canonical 경로) 시 빈
 *   childrenByParent 로 자식 element 가 누락될 수 있어 DELEGATING 등록(flatten 보강 위임). 순수
 *   텍스트 콘텐츠는 flatten map 이 비어 fallback 으로 자연 동작 → 변화 0. 발효 가치는 Skia
 *   spec.render.shapes fallback 제거 + padding 단일 source 화.
 *
 * D1: composition `<div>` (internal source, renderDisclosureContent). RAC Disclosure D1/ARIA 권위 보존.
 * D2: children(텍스트 또는 자식 element) + size 편집 surface.
 * D3: 시각(텍스트 색 neutral/크기/lineHeight/weight 400)은 theme rule
 *     (COMPONENT_RULES_TABLE.DisclosureContent). Skia generic(box+text) ↔ DOM `<div style>` 시각 대칭.
 */
export const disclosureContentBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "disclosurecontent",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Content", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
};
