import type { PrimitiveBinding } from "../types";

/**
 * TreeItemChevron — TreeItem 의 펼침 chevron 버튼을 Layers 에 보이는 문서 노드로 둔다 (2026-10-04 사용자
 * 지시 「1안」, toggle indicator 노드 선례). DOM 대응: `Button[slot="chevron"]` (shared `Tree` 의
 * `TreeItemContent` — 자식 항목이 있으면 펼침 아이콘, 없으면 숨은 자리).
 *
 * D1: RAC `TreeItem` 의 DOM · ARIA 변경 0 — chevron record 는 부모 Tree 의 DOM 에 흡수된다 (자기 DOM 없음).
 * D2: 사용자가 편집하는 prop 없음. 펼침 · 자식 유무는 부모 TreeItem 과 Tree 가 정한다.
 * D3: 아이콘 이름 · 색 · 크기는 부모 TreeItem rule 의 `leadingIcon` · `size.iconSize` 가 정본 — 이 노드의
 *     상자에서 부모 rule 의 `leading_icon` primitive 를 실행한다 (Canvas `canvasBinding`). 상자 크기 ·
 *     들여쓰기는 `Tree.css` 버튼 (`presence.ts` `catalogTreeChevronLayout`). 자기 rule 없음.
 */
export const treeItemChevronBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "treeitemchevron",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
