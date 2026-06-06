import type { PrimitiveBinding } from "../types";

/**
 * StatusLight — 상태 표시 dot + 라벨 leaf (Spectrum 2 StatusLight).
 *
 * **ADR-912 진로 1번 StatusLight proof slice (internal leaf catalog 발효, 2026-06-06)**:
 *   StatusLight 은 catalog 미등록 상태에서 spec.render.shapes(StatusLight.spec.ts:362-425)가
 *   Skia 시각 source 였다. recon(2026-06-06): label 은 factory `children: []` + props.children
 *   (자식 Element 아님). render.shapes 는 dot circle + label text 를 직접 그린다.
 *
 *   **Skia**: `skiaPrimitive: "status_light"` escape(skiaPrimitives.ts, **replace** 모드)가 dot
 *   circle + label text 자체 생성. buildCatalogShapes box+text 는 circle 미지원 + StatusLight 은
 *   box 컨테이너 아님(dot+text leaf) → base box 무의미. rule fill base 는 dot 색(variant status)
 *   이라 base box 로 칠하면 box 전체가 status 색 → DOM(dot 만 색) 과 비대칭 → replace 로 base box
 *   미생성. 기존 `dot` primitive(`props.isDot` gate, Checkbox/Radio 전용 + text 미렌더)와 별개.
 *
 *   **DOM**: source.renderer="statuslight" → INTERNAL_RENDERERS["statuslight"](StatusLight.tsx
 *   React 컴포넌트). variant/size/children 이 props 라 generic fallback 으로는 안 그려진다(자식 0)
 *   → INTERNAL_RENDERERS 어댑터 필수(IllustratedMessage 선례 동형).
 *
 * D1: composition `<div>` (dot span + label span, internal source, INTERNAL_RENDERERS 어댑터).
 * D2: variant(5종 neutral/informative/positive/notice/negative) + size(sm/md/lg/xl) + children(label).
 * D3: dot 색은 variant status 색(theme rule fill base 와 동일 CSS var). Skia escape ↔ DOM 인라인
 *     style 시각 대칭.
 */
export const statusLightBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "statuslight",
  },
  props: {
    accepts: {
      children: {
        kind: "string",
        label: "Label",
        section: "content",
      },
      // kind:"variant"/"size" 는 options 미보유 — 값 집합은 theme rule 동적 제공.
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "neutral",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
    // variant/size 는 dot 색·크기 계산의 semantic input → data-attr 가 아니라 React prop 으로
    // 통과(StatusLight.tsx 가 props.variant/props.size 로 runtime rule 색 계산). data-* 도 함께
    // emit 되어 CSS/debug marker 보존. (ADR-912 StatusLight slice — generated CSS 컨테이너 칠 불가
    // outlier, root-cause = toRacProps generic data-attr 라우팅이 internal leaf 의 semantic prop 차단)
    propPassthrough: ["variant", "size"],
  },
  skiaPrimitive: "status_light",
};
