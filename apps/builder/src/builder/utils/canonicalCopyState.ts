/**
 * ADR-214 Phase 1 (HC2 · R9) — 복사 범위의 `state` 는 canonical 문서에서 읽는다.
 *
 * 복사·복제는 read model (`useStore.elementsMap` 의 legacy Element · 컨텍스트 메뉴의 scene
 * node map) 을 입력으로 받는데, scene node map 은 `state` 를 싣지 않고 legacy Element 는
 * mirror 일 뿐이다. 복제 정본은 canonical 노드다 — 복사 시점에 canonical 노드의 `state` 로
 * 덮어쓰고 (read model 값은 버린다), 붙여넣기의 id 재발급 pass (`pasteMultipleElements` →
 * `remapClonedState`) 가 새 id 를 발급한다. canonical 에 노드가 없으면 state 도 없다 —
 * legacy Element 값을 대신 쓰는 fallback 은 두지 않는다.
 *
 * 노드 조회는 shared 가시성 인덱스 (`findCanonicalNodeById` — page ref 의 descendants
 * 자식 포함, first-wins) 를 재사용한다 — 문서 순회를 여기서 다시 쓰지 않는다.
 */
import type { CompositionDocument } from "@composition/shared";
import { findCanonicalNodeById, isVariableDefList } from "@composition/shared";
import type { CopiedElementsData } from "./multiElementCopy";

/**
 * 복사 데이터의 각 요소에 canonical 노드의 `state` 를 싣는다 (없으면 필드 제거).
 * 문서가 없으면 state 없이 돌려준다.
 */
export function attachCanonicalStateToCopy(
  copied: CopiedElementsData,
  doc: CompositionDocument | null,
): CopiedElementsData {
  if (copied.elements.length === 0) return copied;
  const elements = copied.elements.map((element) => {
    const node = doc ? findCanonicalNodeById(doc, element.id) : undefined;
    const state = node?.state;
    const { state: _dropReadModelState, ...rest } =
      element as typeof element & {
        state?: unknown;
      };
    if (isVariableDefList(state) && state.length > 0) {
      return { ...rest, state: state.map((def) => ({ ...def })) };
    }
    return rest;
  });
  return { ...copied, elements };
}
