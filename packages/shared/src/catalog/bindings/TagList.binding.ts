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
 * **DOM = TagList 노드 자신 (Codex Round 20 H1, 2026-10-09)**: `delegatedDom` `taglist` 가 chip 상자
 *   `div.tag-list-wrapper` (노드의 marker · style — 수동 TagGroup.css 의 flex-wrap · gap · min-height) 안에
 *   RAC `<TagList className="react-aria-TagList">` (display: contents) 와 Tag 노드를 그린다. 부모 TagGroup 은
 *   RAC `<TagGroup>` 이고 작성 자식을 순서대로 그린다 — TagGroup 의 `maxRows` (측정 거울 · Show all) 와
 *   지운 Tag 는 context 로 받는다.
 *
 * D1: RAC `<TagGroup>`/`<TagList>` 의 DOM · ARIA (role=grid/row) 그대로.
 * D2: size 편집 surface.
 * D3: 시각 (없음 — chip 컨테이너 shell) 은 transparent box. 배치는 catalog TagList rule.
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
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};
