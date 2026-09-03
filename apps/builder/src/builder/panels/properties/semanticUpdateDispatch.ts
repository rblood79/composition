/**
 * Properties 패널의 semantic 쓰기 — ADR-048 propagation 을 포함한 **store 호출 한 벌**.
 *
 * React 밖의 순수 함수다. 패널 (`PropertiesPanel.handleSemanticUpdate`) 은 선택 요소·ref 해소·
 * 자식 지도만 마련해 이 함수에 넘기고, "규칙이 걸리면 자식 patch 를 만들어 `mergeStyle` 을 실은
 * 채 `updateSelectedPropertiesWithChildren` 에, 아니면 `updateSelectedProperties` 에" 라는
 * 데이터 흐름은 전부 여기 있다.
 *
 * Why (round 5 fe4m1): 이 흐름이 패널 콜백 안에 인라인으로 있으면 어떤 테스트도 그 콜백을 실행하지
 * 못한다 — helper 를 호출만 하고 반환값을 버리는 변형도 단위 테스트를 전부 통과했다. 함수로
 * 뽑아 `adr923PropagationTransport.test.ts` 가 **이 함수 자체**를 실제 inspector slice 위에서
 * 돌리고, 패널이 이 함수를 거치는지는 AST 게이트가 잠근다.
 */
import type { BatchPropsUpdate } from "../../stores/utils/elementUpdate";
import {
  buildPropagationUpdates,
  toBatchPropsUpdates,
} from "../../utils/propagationEngine";
import { getPropagationRules } from "../../utils/propagationRegistry";

export interface PropagationElementLike {
  id: string;
  type: string;
  props: Record<string, unknown>;
}

/** store 가 제공하는 두 쓰기 액션 — `useStore.getState()` 가 구조적으로 만족한다. */
export interface SemanticUpdateActions {
  updateSelectedProperties: (properties: Record<string, unknown>) => void;
  updateSelectedPropertiesWithChildren: (
    properties: Record<string, unknown>,
    childUpdates: BatchPropsUpdate[],
  ) => void;
}

export interface SemanticUpdateDispatchArgs {
  changedProps: Record<string, unknown>;
  /** propagation 의 parent — ref 인스턴스면 해소된 origin 트리의 노드. */
  propagationElement: PropagationElementLike;
  childrenMap: Map<string, PropagationElementLike[]>;
  elementsMap: Map<string, PropagationElementLike>;
  actions: SemanticUpdateActions;
}

export type SemanticUpdateDispatchResult = "with-children" | "plain";

export function dispatchSemanticUpdateWithPropagation({
  changedProps,
  propagationElement,
  childrenMap,
  elementsMap,
  actions,
}: SemanticUpdateDispatchArgs): SemanticUpdateDispatchResult {
  // ADR-048: propagation 규칙 중 변경된 prop 과 매칭되는 것이 있으면 자식도 같은 batch 로 쓴다.
  const rules = getPropagationRules(propagationElement.type);
  if (
    rules &&
    rules.some(
      (r) => typeof r.parentProp === "string" && r.parentProp in changedProps,
    )
  ) {
    const childUpdates = buildPropagationUpdates(
      propagationElement,
      changedProps,
      rules,
      childrenMap,
      elementsMap,
    );
    if (childUpdates.length > 0) {
      // 매핑은 `toBatchPropsUpdates` 단일 지점 — `mergeStyle` 이 여기서 빠지면 자식 style 이
      //   통째 교체된다 (r2 feh2 / round 3 fe2m1). 이 함수가 곧 게이트 대상이다.
      actions.updateSelectedPropertiesWithChildren(
        changedProps,
        toBatchPropsUpdates(childUpdates),
      );
      return "with-children";
    }
  }

  actions.updateSelectedProperties(changedProps);
  return "plain";
}
