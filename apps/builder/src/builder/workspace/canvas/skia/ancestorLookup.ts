import type { CanvasSceneNode } from "../scene/canvasSceneNode";

/**
 * 주어진 element에서 위로 올라가며 특정 type를 가진 조상을 찾는다.
 * implicitStyles(1-depth)와 buildSpecNodeData(3-depth)의 중복 패턴 통합.
 */
export function findAncestorByTag(
  element: CanvasSceneNode,
  type: string,
  elementsMap: Map<string, CanvasSceneNode>,
  maxDepth = 3,
): CanvasSceneNode | undefined {
  let currentId: string | null | undefined = element.parent_id;
  for (let depth = 0; depth < maxDepth && currentId; depth++) {
    const ancestor = elementsMap.get(currentId);
    if (!ancestor) break;
    if (ancestor.type === type) return ancestor;
    currentId = ancestor.parent_id;
  }
  return undefined;
}
