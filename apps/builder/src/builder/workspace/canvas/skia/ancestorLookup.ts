/**
 * 주어진 element에서 위로 올라가며 특정 type를 가진 조상을 찾는다.
 * implicitStyles(1-depth)와 buildSpecNodeData(3-depth)의 중복 패턴 통합.
 *
 * ADR-912 영역 B (A): `parent_id`/`type` 만 읽는 구조이므로 CanvasSceneNode(skia 경로) 와
 *   CanvasLayoutNode(layout engine 경로) 양쪽을 generic 으로 수용한다. 반환은 입력 노드 타입을
 *   그대로 따라가 caller 가 자신의 노드 타입으로 받는다(이전 CanvasSceneNode 고정 시 layout
 *   경로 caller 의 TS2345 CanvasLayoutNode→CanvasSceneNode 불일치를 generic 으로 근본 해소).
 */
interface AncestorLookupNode {
  type: string;
  parent_id?: string | null;
}

export function findAncestorByTag<N extends AncestorLookupNode>(
  element: N,
  type: string,
  elementsMap: Map<string, N>,
  maxDepth = 3,
): N | undefined {
  let currentId: string | null | undefined = element.parent_id;
  for (let depth = 0; depth < maxDepth && currentId; depth++) {
    const ancestor = elementsMap.get(currentId);
    if (!ancestor) break;
    if (ancestor.type === type) return ancestor;
    currentId = ancestor.parent_id;
  }
  return undefined;
}
