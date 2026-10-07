import type { PrimitiveBinding } from "../types";

/**
 * DisclosureChevron — Disclosure trigger 의 chevron 을 Layers 에 보이는 문서 노드로 둔다 (2026-10-07 사용자
 * 지시, toggle indicator · TreeItemChevron 노드 선례). DOM 대응: trigger `Button[slot="trigger"]` 안의
 * `svg.disclosure-chevron` (shared `Disclosure` — 레퍼런스 `<ChevronRight />` 자리).
 *
 * D1: RAC `Disclosure` 의 DOM · ARIA 변경 0 — chevron record 는 부모 Disclosure 의 DOM 에 흡수된다 (자기 DOM 없음).
 * D2: 사용자가 편집하는 prop 없음. 펼침은 부모 Disclosure (또는 DisclosureGroup) 가 정한다.
 * D3: 아이콘 이름 · 색 · 크기는 부모 DisclosureHeader rule 의 `leadingIcon` · `size.iconSize` 가 정본 — 이
 *     노드의 상자에서 부모 rule 의 `leading_icon` primitive 를 실행한다 (Canvas `canvasBinding`). 상자 크기는
 *     Disclosure rule 의 `.disclosure-chevron` (`var(--icon-size)`, part rule). 자기 rule 없음.
 */
export const disclosureChevronBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "disclosurechevron",
  },
  props: {
    accepts: {},
    toRacProps: "default",
  },
};
