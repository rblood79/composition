import type { PrimitiveBinding } from "../types";

/**
 * Nav — HTML5 `<nav>` 네비게이션 컨테이너 leaf.
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.Nav`, default/accent fill) 로 bg box 하나를 그린다 —
 *   자식은 각자 그린다. 빈 Nav 도 bg 만.
 *
 * **DOM = delegatedDom `nav` (delegating 등록)**: `<nav>` 안에 자식 노드를 그대로 담는다.
 *   `react-aria-Nav` + data-size/data-variant (`chrome`) 로 generated CSS(Nav.css) 가 매칭된다.
 *   aria-label 은 delegatedDom `nav` 가 직접 부여(`props["aria-label"]`, 기본 "Navigation" — rule/CSS
 *   영역 외 D1). Properties 의 Attributes 절 (metadata `ariaLabel`) 이 쓰면 그 값이 이긴다.
 *
 * D1: composition `<nav>` (internal source, delegatedDom `nav`).
 * D2: variant(default/accent) + size(sm/md/lg) + aria-label 편집 surface.
 * D3: 시각(variant 별 배경/패딩)은 theme rule(COMPONENT_RULES_TABLE.Nav).
 */
export const navBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "nav",
  },
  props: {
    accepts: {
      // 편집 surface 는 Properties 의 Attributes 절 (전 타입 공통 `aria-label` 축, Nav 는 항상
      //   노출) 하나 — 여기서도 필드를 열면 같은 prop 이 Content 와 Attributes 두 곳에 뜬다
      //   (2026-09-15 사용자 지적). accepts 에는 남긴다 (toRacProps 통과 축).
      "aria-label": {
        kind: "string",
        label: "aria-label",
        section: "content",
        editorHidden: true,
      },
      // kind:"variant"/"size" 는 options 미보유(types.ts:139-142) — theme rule 동적 제공.
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
