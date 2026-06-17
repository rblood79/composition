import type { PrimitiveBinding } from "../types";

/**
 * TagList — TagGroup projection 의 chip 컨테이너 shell (시각 없음).
 *
 * **ADR-912 collection sub-part cutover (2026-06-15, TabList 동형)**: TagList 는 catalog 미등록
 *   상태에서 `TagList.spec`(render.shapes:()=>[] shell + containerStyles display:flex/row/wrap)이
 *   Skia 진입 게이트(buildSpecNodeData `if(!spec) return null`)를 통과시키는 유일 근거였다.
 *   catalog 등록으로 rule(`COMPONENT_RULES_TABLE.TagList`: variants default transparent + sizes.md
 *   {height/fontSize/borderRadius}) + buildCatalogShapes generic(transparent box shell)으로 이전.
 *   chip 시각은 이미 catalog cutover 된 Tag(`appendTagRowProjection` → Tag SceneNode, buildCatalogShapes
 *   box+text + remove X SelectIcon)가 단독 담당 → TagList 자체는 escape 불요(divider/indicator 없음).
 *
 * **Skia = transparent box shell (chip 은 rowsGroup 자식 projection)**: TagList SceneNode 는 자식
 *   chip projection 의 owner 다. `appendTagRowProjection` 이 TagList 아래 `rowsGroup`(type:"Rows",
 *   style display:flex/flexWrap:wrap/width:100%, 코드 직접 생성) → chip(Tag) 노드 배열을 전개한다.
 *   chip wrap 은 rowsGroup 의 flexWrap:wrap(Taffy 배치)이 전담 — TagList.spec.containerStyles 는
 *   Skia 에서 dead. buildSpecNodeData 가 `isCatalogCutover("TagList")` → transparent box shell.
 *
 * **DOM = 부모 TagGroup self-compose**: renderTagGroup(useResolvedCollectionItems / items[] SSOT)이
 *   RAC `<TagGroup>` > `.tag-list-wrapper`(수동 CSS, display:flex/flex-wrap) > `<TagList
 *   className="react-aria-TagList">`(display:contents) 합성. TagList 의 wrap 은 수동 TagGroup.css 의
 *   .tag-list-wrapper 가 담당(display:contents passthrough). catalog 등록 후에도 DOM 변화 0
 *   (사용자 결정 2026-06-15: starter 구조는 catalog/spec 정의만, DOM .tag-list-wrapper 불변 —
 *   surface 최소). 발효 가치는 Skia 대칭(spec 의존 끊기 = spec 물리 삭제 안전) 한정.
 *
 * D1: composition — DOM 은 RAC `<TagGroup>`/`<TagList>` 가 self-compose + ARIA(role=grid/row).
 *     RAC D1/ARIA 권위 보존.
 * D2: size 편집 surface(컨테이너는 projection owner 라 편집 surface 최소).
 * D3: 시각(없음 — chip 컨테이너 shell)은 transparent box. layout(flex/row/wrap)은 factory
 *     props.style SSOT(ADR-907 Layer B / [[feedback-container-layout-via-factory-props-style]]) +
 *     Taffy resolveContainerStylesFallback 이전. Skia transparent generic ↔ DOM RAC self-compose 대칭.
 *
 * source.renderer "taglist" 은 DOM 에서 호출되지 않는다(부모 TagGroup self-compose) — primitiveEntry 의
 * getPrimitiveBinding 타입 계약 충족용. canonical TagList element 는 존재하나(factory 생성, 빈 children)
 * 자식 chip 은 items[] projection 이라 DOM 재귀 자식 없음 → DELEGATING 등록 불요.
 */
export const tagListBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "taglist",
  },
  props: {
    accepts: {
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
