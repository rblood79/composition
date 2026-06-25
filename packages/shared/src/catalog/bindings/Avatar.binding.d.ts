import type { PrimitiveBinding } from "../types";
/**
 * Avatar — 사용자 아바타 leaf (circle bg + image | initials placeholder).
 *
 * **ADR-912 진로 1번 Avatar proof slice (internal leaf catalog 발효, 2026-06-06)**:
 *   Avatar 는 catalog 미등록 상태에서 구 spec.render.shapes(Avatar.spec.ts, 2026-06-16 삭제)가 Skia
 *   시각 source 였고, DOM 은 rendererMap.renderAvatar(LayoutRenderers.tsx:1269) inline 함수가 담당.
 *   factory `children: []`(leaf, 자식 Element 아님) + src/alt/initials 는 props.
 *
 *   **Skia escape 필요 (recon "불필요" 정정)**: `skiaPrimitive: "avatar"` escape(skiaPrimitives.ts,
 *   **replace** 모드). buildCatalogShapes 는 roundRect+border+text 만 그린다 — circle 은 roundRect
 *   (borderRadius=full)로 근사 가능하나 **image fill 은 미지원**(buildCatalogShapes 주석 L10/L123:
 *   "원/선/아이콘 등 box+text 로 표현 안 되는 도형은 skiaPrimitive 가 담당, 본 함수 인라인 분기 금지").
 *   Avatar 의 핵심 시각 = circle bg + image(props.src) → escape 필수(StatusLight/IllustratedMessage
 *   동형). circle 이 전체 shape 라 base box 무의미 → **replace**(append 아님). image shape 는
 *   specShapeConverter.ts:1006 가 렌더 지원(구 Avatar.spec 이 쓰던 경로).
 *
 *   **DOM**: source.renderer="avatar" → INTERNAL_RENDERERS["avatar"](Avatar.tsx React 컴포넌트).
 *   src/initials/size 가 props 라 generic box+text fallback 으로는 안 그려진다(자식 0, image)
 *   → INTERNAL_RENDERERS 어댑터 필수(StatusLight 선례 동형).
 *
 *   **propPassthrough: ["size"] (StatusLight 선례 동형, variant 는 제외)**: Avatar 는 INTERNAL_RENDERERS
 *   어댑터(React 컴포넌트)라 size 가 크기·fontSize 계산의 input 이다. catalog 의 size kind 는 기본
 *   data-attr 라우팅(`data-size`)이라 그대로 두면 Avatar.tsx 의 size prop 이 undefined → 항상 default(md)
 *   고정(StatusLight 변경 미반영 비대칭과 동일 root-cause). size 를 propPassthrough 로 통과시켜 React
 *   prop + data-size 둘 다 emit(CSS/debug marker 보존). variant 는 StatusLight 과 달리 단일 "default"
 *   고정이라 accepts 에 없음 → 통과 대상 아님(Avatar.tsx 가 rule "default" variant 만 읽음).
 *
 * D1: composition `<div>` (circle bg + img|initials span, internal source, INTERNAL_RENDERERS 어댑터).
 * D2: src(image URL) + alt + initials(fallback text) + size(xs/sm/md/lg/xl).
 * D3: circle bg 색 = rule fill base({color.neutral-subtle}=var(--bg-muted)) / text 색 = {color.neutral}.
 *     Skia escape ↔ DOM 인라인 style 시각 대칭.
 */
export declare const avatarBinding: PrimitiveBinding;
//# sourceMappingURL=Avatar.binding.d.ts.map