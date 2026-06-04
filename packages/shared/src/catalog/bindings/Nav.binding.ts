import type { PrimitiveBinding } from "../types";

/**
 * Nav — HTML5 `<nav>` 네비게이션 컨테이너 leaf.
 *
 * **ADR-912 container shell 3 catalog 등록 (Body/Section/Nav, 2026-06-04)**:
 *   Nav 는 catalog 미등록 상태에서 spec.render.shapes(Nav.spec.ts:100-130) 가 Skia 시각 source
 *   였다. catalog 등록으로 시각을 rule(`COMPONENT_RULES_TABLE.Nav`, default/accent fill) +
 *   buildCatalogShapes generic box 로 이전. Nav 는 SHELL_ONLY_CONTAINER_TAGS **비멤버**라
 *   _hasChildren 은 자식 있을 때만 주입(buildSpecNodeData:1128-1132). 단 spec.render.shapes 도
 *   자식 무관 bg roundRect 1개만 그리고(Nav.spec.ts:117-127) 자식 placeholder 가 없으므로,
 *   buildCatalogShapes 가 box 만 그려도 시각 대칭(Nav 는 height>0 box → text 분기는 children/
 *   text/label 없으면 미진입). 빈 Nav 도 bg 만 — spec parity.
 *
 * **DOM parity = 변화 0**: INTERNAL_RENDERERS 미등록 → generic fallback 경로 유지. isSpecOrCatalogBacked
 *   true → `react-aria-Nav` + data-size/data-variant 주입 보존 → generated CSS(Nav.css) 매칭 불변.
 *   resolveGenericHtmlTag 에 Nav 키 없음 → type.toLowerCase() = "nav"(올바른 HTML 태그). generated
 *   CSS diff 0. role="navigation"/aria-label 은 spec react() 의 D1 metadata(rule/CSS 영역 외).
 *
 * D1: composition `<nav>` (internal source, generic DOM via lowercase fallback → "nav").
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
      "aria-label": {
        kind: "string",
        label: "aria-label",
        section: "content",
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
        default: "md",
      },
    },
    toRacProps: "default",
  },
};
