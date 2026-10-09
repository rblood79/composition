import type { PrimitiveBinding } from "../types";

/**
 * Toast — 토스트 알림 컨테이너. composition 자체 추상 (RAC Toast 는 imperative API —
 * useToast/ToastProvider). 기본 origin template 은 이 type 을 쓰지 않는다 (type 등록은
 * `componentCatalog.ts` 에 남아 있다).
 *
 * **ADR-912 R7 G1-c (container shell catalog cutover, 2026-06-15)**: 시각은 rule
 *   (`COMPONENT_RULES_TABLE.Toast`: variant fill + colors.border + sizes) 의 상자다 — 메시지 글자는
 *   자식 노드가 그린다.
 *
 * **좌측 accent bar 제거 (RAC 정본 정렬, 사용자 결정 2026-06-15)**: 옛 spec 의
 *   좌측 accent bar(rect 3px)는 RAC 공식 Toast(react-aria.adobe.com/Toast — flex+center+gap+단색
 *   배경+close 버튼, accent bar 없음) 미준수 자체 변형이었다(feedback-catalog-unrepresentable-is-
 *   nonstandard-variant). cutover 시 Skia/DOM 양쪽에서 제거 → 순수 box-shell. (variant 4종/close
 *   버튼/flex center 등 추가 RAC 정합은 surface 최소화로 별도 이슈 — 본 cutover scope 외.)
 *
 * **DOM (2026-06-27)**: `delegatedDom.tsx` `toast` 가 `<div role="alert">` (data-variant ·
 *   data-position) 안에 자식 노드를 순서대로 그린다 (자식이 없으면 기본 글자). `renderer:"div"` 로
 *   두면 DELEGATING_INTERNAL_RENDERERS 매칭(renderer 기준)을 못 타 자식이 그려지지 않는다 → 고유
 *   renderer id(`"toast"`) + renderFacetDeclaration delegating-internal 등록.
 *
 * D1: composition `<div role="alert">` (internal source, `delegatedDom.tsx` `toast`).
 * D2: variant/size(appearance) surface.
 * D3: 시각(variant fill + border + radius)은 theme rule(COMPONENT_RULES_TABLE.Toast).
 */
export const toastBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 2026-06-27: "div" → "toast". 자식 노드를 <div role="alert"> 안에 직접 그리는 컨테이너다
    //   (ButtonGroup/Pagination 동형). renderer:"div" 는 DELEGATING_INTERNAL_RENDERERS 매칭(renderer
    //   기준)을 못 타 자식이 그려지지 않는다. 고유 renderer id + renderFacetDeclaration delegating-
    //   internal 등록으로 `delegatedDom.tsx` `toast` 를 탄다 (role="alert" 도 거기서 부여).
    renderer: "toast",
  },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "info",
      },
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
