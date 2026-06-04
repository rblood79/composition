import type { PrimitiveBinding } from "../types";

/**
 * Section — HTML `<section>` 시맨틱 컨테이너 leaf.
 *
 * **ADR-912 container shell 3 catalog 등록 (Body/Section/Nav, 2026-06-04)**:
 *   Section 은 catalog 미등록 상태에서 spec.render.shapes(Section.spec.ts:147-216) 가 Skia 시각
 *   source 였다. catalog 등록으로 시각을 rule(`COMPONENT_RULES_TABLE.Section`, 6 variant fill +
 *   outlined border) + buildCatalogShapes generic box 로 이전. Section 은 SHELL_ONLY_CONTAINER_TAGS
 *   멤버(buildSpecNodeData:148) → _hasChildren=true 항상 주입 → buildCatalogShapes box(bg+border)
 *   만 반환 → spec.render.shapes 의 "자식 있으면 bg+border 만"(Section.spec.ts:200) 과 시각 대칭.
 *
 * **alpha:0 default variant (실측 2026-06-04, 사용자 결정 "시각 대칭 기준 그대로")**:
 *   default variant 는 fill.alpha:0(투명). buildCatalogShapes hasVisibleBg 게이트(L141)는 alpha:0
 *   이면 box 미생성(borderColor 도 없으면). spec.render.shapes 는 alpha:0 box 를 push 하고 fillAlpha:0
 *   적용 → shape 개수는 다르나 **시각 결과 동일**(둘 다 투명). D3 원칙(시각 결과 동일성)으로 parity
 *   성립 — buildCatalogShapes 미수정(transparent-fill leaf 회귀 회피).
 *
 * **DOM parity = 변화 0**: INTERNAL_RENDERERS 미등록 → generic fallback 경로 유지. isSpecOrCatalogBacked
 *   true → `react-aria-Section` + data-size/data-variant 주입 보존 → generated CSS(Section.css) 매칭
 *   불변. resolveGenericHtmlTag Section→section. generated CSS diff 0.
 *
 * D1: composition `<section>` (internal source, generic DOM via KNOWN_HTML Section→section,
 *     role="region" 은 spec react() 가 부여하던 것 — rule/generated CSS 영역 외 D1 metadata).
 * D2: variant(6종) + size(sm/md/lg) 편집 surface (data-variant/data-size 라우팅).
 * D3: 시각(variant 별 배경/테두리/패딩)은 theme rule(COMPONENT_RULES_TABLE.Section).
 */
export const sectionBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "section",
  },
  props: {
    accepts: {
      // kind:"variant"/"size" 는 options 를 두지 않는다(types.ts:139-142) — variant/size
      //   값 집합은 theme rule(COMPONENT_RULES_TABLE.Section.variants/sizes)이 동적 제공.
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
