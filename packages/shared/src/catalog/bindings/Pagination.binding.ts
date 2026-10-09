import type { PrimitiveBinding } from "../types";

/**
 * Pagination — 페이지네이션 컨테이너 (이전/페이지 N개/다음 Button 묶음). composition 자체 추상.
 * Pagination origin template (`reusableOriginLibrary.ts` `component-pagination`) 이 자식 Button×5
 * (←/1/2/3/→) 를 노드로 둔다.
 *
 * **Canvas**: rule `COMPONENT_RULES_TABLE.Pagination`(variant default/accent + sizes sm/md/lg) 의 box
 *   shell — 페이지 버튼은 자식 Button 노드가 그린다. container layout(`flexDirection:row` /
 *   `alignItems:center`)은 template 노드의 layout.
 *
 * **staticSelectors**: 자식 Button 대상 descendant CSS(.pagination-controls / .pagination-info /
 *   .pagination-ellipsis / .react-aria-Button[data-current] 활성 페이지 강조 등)는 rule 의
 *   `composition.staticSelectors` 가 generated CSS 로 낸다.
 *
 * **DOM = delegatedDom `pagination` (delegating 등록)**: `<nav aria-label="Pagination">` 안에 자식
 *   노드를 그대로 담는다. `react-aria-Pagination` className + `data-size`/`data-variant` 는 `chrome`
 *   이 붙인다 (2026-09-18 — 그전엔 붙인 적이 없어 생성 CSS 전량이 preview 에 dead 였다, CHANGELOG).
 *
 * D1: composition `<nav>` (internal source, delegatedDom `pagination`). aria-label="Pagination" 은
 *     delegatedDom 이 부여.
 * D2: variant/size(appearance) surface.
 * D3: 시각(variant fill + radius)은 theme rule(COMPONENT_RULES_TABLE.Pagination).
 *     Canvas box shell ↔ DOM `react-aria-Pagination[data-size]` 시각 대칭.
 */
export const paginationBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    // 2026-06-27: "div" → "pagination". 자식 노드를 <nav> 안에 담는 delegating 컨테이너다
    //   (delegatedDom `pagination` — ButtonGroup/AvatarGroup/CardView 동형). 고유 renderer id +
    //   renderFacetDeclaration delegating-internal 등록으로 위임을 받는다.
    renderer: "pagination",
  },
  props: {
    accepts: {
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};
