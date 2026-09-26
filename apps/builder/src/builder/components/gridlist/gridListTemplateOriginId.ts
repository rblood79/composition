import type { CanonicalNode, RefNode } from "@composition/shared";

import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "../templateItemOriginIds";

/**
 * GridList 행 template origin id 해석 (resolveListBoxTemplateOriginId 대칭, anchor-less).
 *
 * GridList 는 in-instance anchor 인프라가 없다(factory children:[]). 우선순위:
 *   1. ref instance → master(component-gridlist) 의 slot[0].
 *   2. origin GridList 자신(Components 페이지) → 자신의 slot[0].
 *   3. 안전망: 표준 default item origin 상수(component-gridlist-item-default).
 *
 * **Why (ADR-161 Phase 3)**: 컨테이너 origin(component-gridlist)의 slot 을 실제 소비해
 *   ref-composite 를 완성한다. 현행은 slot[0] == 리터럴이라 시각 결과 불변이나, 컨테이너
 *   origin 이 authoritative 가 되어 ListBox(resolveListBoxTemplateOriginId)와 대칭 —
 *   preview(App.tsx component-gridlist master 해석)와 동일 SSOT 를 동일 방식으로 읽는다.
 *
 * ADR-162 Phase 5 — Canvas scene · 가상화 stride · Properties 「카드 필드」 절이 이 함수 하나를 부른다
 * (패널이 scene 모듈을 싣지 않도록 의존 0 모듈로 분리).
 */
export function resolveGridListTemplateOriginId(
  sourceNode: CanonicalNode,
  getDocumentNodesById: () => ReadonlyMap<string, CanonicalNode>,
): string {
  const slot =
    sourceNode.type === "ref"
      ? getDocumentNodesById().get((sourceNode as RefNode).ref)?.slot
      : sourceNode.slot;
  if (Array.isArray(slot) && typeof slot[0] === "string") return slot[0];
  return GRIDLIST_ITEM_DEFAULT_ORIGIN_ID;
}
