import type { Key } from "react-stately";
import type { PageTreeNode } from "./types";

type TreeDataLike = {
  getItem: (key: Key | string) => { value: PageTreeNode } | null | undefined;
};

export function isValidPageDrop(
  draggedId: string,
  targetId: string,
  dropPosition: "before" | "after" | "on",
  tree: TreeDataLike,
): { valid: boolean; reason?: string } {
  const draggedNode = tree.getItem(draggedId)?.value;
  const targetNode = tree.getItem(targetId)?.value;

  // 1. 노드 존재 확인
  if (!draggedNode || !targetNode) {
    return { valid: false, reason: "invalid-node" };
  }

  // 2. 자기 자신 drop 금지
  if (draggedId === targetId) {
    return { valid: false, reason: "self-drop" };
  }

  // 3. 자손으로 drop 금지
  if (isDescendant(draggedId, targetId, tree)) {
    return { valid: false, reason: "descendant-drop" };
  }

  // 4. Home(root) 페이지 드래그 금지
  if (draggedNode.isRoot) {
    return { valid: false, reason: "home-immutable" };
  }

  // 5. System page는 위치/부모 변경 대상이 아니다.
  if (draggedNode.isSystemPage || targetNode.isSystemPage) {
    return { valid: false, reason: "system-page-immutable" };
  }

  // 6. Home 페이지 앞(before)에 배치 금지 (Home은 항상 첫 번째)
  //    단, Home 뒤(after)나 Home 안(on)에는 드롭 허용
  if (targetNode.isRoot && dropPosition === "before") {
    return { valid: false, reason: "before-home-denied" };
  }

  return { valid: true };
}

function isDescendant(
  ancestorId: string,
  descendantId: string,
  tree: TreeDataLike,
): boolean {
  let current = tree.getItem(descendantId);
  while (current) {
    if (current.value.parentId === ancestorId) return true;
    current = current.value.parentId
      ? tree.getItem(current.value.parentId)
      : null;
  }
  return false;
}
