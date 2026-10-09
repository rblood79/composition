import type { PrimitiveBinding } from "../types";

/**
 * TagList — TagGroup 안의 chip 컨테이너 shell (시각 없음).
 *
 * **노드 트리**: TagGroup origin template 의 `Tags` slot 이다 (`reusableOriginLibrary.ts` —
 *   `TagGroup > Label + TagList > Tag… + Description + FieldError`).
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.TagList`: variants default transparent + sizes
 *   {height/minHeight/gap}) 의 transparent 상자 — chip 시각은 Tag 노드가 담당한다. 엔진 자식은
 *   Tag 노드와 Show all 상자다 (`compositionRoot.ts` `tagListEngineChildren` · `settleTagRows`).
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
