/**
 * 형제 순서 재배치 타깃 해석 (순수 함수)
 *
 * composition 은 flow 자식의 x/y 를 레이아웃 엔진이 소유하므로, 자식에게
 * "이동" 이 뜻할 수 있는 것은 canonical `children[]` 안의 **순서**뿐이다
 * (순서 SSOT = canonical children[], ADR-118). 키보드 화살표 재배치가 첫
 * 호출자이며, 인덱스 계산과 경계 판정만 담당한다 — mutation/history/persist 는
 * 호출자(store action)의 책임.
 */

import type {
  CanonicalNode,
  CanonicalParentId,
  CompositionDocument,
} from "@composition/shared";

/** -1 = 이전 형제 쪽으로, +1 = 다음 형제 쪽으로 */
export type SiblingReorderDirection = -1 | 1;

/**
 * `"front"` = 형제 배열의 **마지막**, `"back"` = **첫 번째**.
 *
 * children[] 순서가 곧 그리기 순서라 뒤에 있을수록 위에 그려진다 (Skia
 * `visitElement` 도 DOM stacking 도 같은 순서). 그래서 "맨 앞으로(front)" 가
 * 배열의 끝이다 — 배열 인덱스 직관과 반대라 혼동하기 쉬운 지점.
 */
export type SiblingEdge = "front" | "back";

export interface SiblingReorderTarget {
  /**
   * 문서 최상위면 `null`.
   *
   * mutation 층(`isRootParent`)은 `null` 과 문자열 `"root"` 를 **같은 문서 루트**로
   * 취급한다 — `"root"` 는 예약 sentinel 이라 그 id 를 가진 컨테이너의 자식으로는
   * 삽입되지 않는다 (store 의 `parent_id || "root"` 관례와 같은 값).
   */
  parentId: CanonicalParentId;
  /**
   * `moveCanonicalChild` 의 **post-removal** 인덱스.
   *
   * 해당 함수는 `remove → insert` 순서로 동작하므로 같은 부모 안에서는
   * 제거로 뒷 형제가 한 칸 당겨진다. 따라서 현재 i 에서 이전 = `i - 1`,
   * 다음 = `i + 1` 이 그대로 목표 인덱스가 된다 (다음의 경우 당겨진 형제
   * 뒤에 꽂히는 값).
   */
  insertionIndex: number;
}

interface PlainTreeLocation {
  parentId: CanonicalParentId;
  index: number;
  siblings: readonly CanonicalNode[];
}

/**
 * **일반 트리(plain tree) 한정** 위치 탐색.
 *
 * ref override(`descendants`) 안의 노드는 의도적으로 찾지 않는다 —
 * `buildCanonicalMoveEvents` 가 "ref override 내부 노드는 재적용이 불안전"
 * 하다고 명시하고 있어(undo 가 트리를 훼손), 재배치 대상에서 제외한다.
 * 제외된 노드는 상위에서 no-op 으로 떨어진다.
 */
function locateInPlainTree(
  nodes: readonly CanonicalNode[],
  elementId: string,
  parentId: CanonicalParentId,
): PlainTreeLocation | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === elementId) {
      return { parentId, index, siblings: nodes };
    }
    const found = locateInPlainTree(node.children ?? [], elementId, node.id);
    if (found) return found;
  }
  return null;
}

/**
 * 같은 부모 안에서 한 칸 이동할 목표를 해석한다.
 *
 * @returns 이동 불가(첫 형제의 이전 / 마지막 형제의 다음 / 일반 트리 밖)면 null
 */
export function resolveSiblingReorderTarget(
  document: CompositionDocument,
  elementId: string,
  direction: SiblingReorderDirection,
): SiblingReorderTarget | null {
  const location = locateInPlainTree(document.children, elementId, null);
  if (!location) return null;

  const insertionIndex = location.index + direction;
  // post-removal 배열 길이는 `siblings.length - 1` 이라 유효 삽입 인덱스는
  // 0..(length - 1). 첫 형제의 이전(-1)과 마지막 형제의 다음(length)이
  // 이 한 번의 검사로 함께 걸러진다.
  //
  // **경계 검사를 생략하면 안 된다**: mutation 쪽 `clampIndex` 는 범위를 벗어난
  // 인덱스를 거부하지 않고 **clamp** 한다. 즉 마지막 형제의 "다음" 은 조용히
  // 제자리 append 가 되어 순서는 그대로인데 `changed: true` 가 되고, 호출자가
  // 그것으로 history entry 를 남기면 아무것도 바꾸지 않는 undo 단계가 쌓인다.
  if (insertionIndex < 0 || insertionIndex > location.siblings.length - 1) {
    return null;
  }

  return { parentId: location.parentId, insertionIndex };
}

/**
 * 같은 부모 안에서 형제 배열의 끝(맨 앞/맨 뒤)으로 보낼 목표를 해석한다.
 *
 * `resolveSiblingReorderTarget` 과 같은 위치 탐색을 쓰되 목표 인덱스만 다르다
 * (한 칸 vs 끝까지). post-removal 기준이라 `"front"` 의 목표는
 * `siblings.length - 1` — 제거로 배열이 한 칸 줄어든 뒤의 마지막 자리다.
 *
 * @returns 이미 그 끝에 있거나(형제 1개 포함) 일반 트리 밖이면 null (no-op)
 */
export function resolveSiblingEdgeTarget(
  document: CompositionDocument,
  elementId: string,
  edge: SiblingEdge,
): SiblingReorderTarget | null {
  const location = locateInPlainTree(document.children, elementId, null);
  if (!location) return null;

  const lastIndex = location.siblings.length - 1;
  const currentIsAtEdge =
    edge === "front" ? location.index === lastIndex : location.index === 0;
  // 이미 끝이면 no-op — `clampIndex` 가 제자리 이동을 changed:true 로 돌려주어
  // 아무것도 바꾸지 않는 undo 단계가 쌓이는 것을 막는다 (위 함수와 같은 이유).
  if (currentIsAtEdge) return null;

  return {
    parentId: location.parentId,
    insertionIndex: edge === "front" ? lastIndex : 0,
  };
}
