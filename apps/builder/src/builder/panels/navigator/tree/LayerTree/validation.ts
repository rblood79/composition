import type { Key } from "react-stately";
import { getFrameElementMirrorId } from "../../../../../adapters/canonical/frameMirror";
import { isRenderProjectionId } from "../../../../projection/renderProjectionIds";
import type { LayerTreeNode } from "./types";
import { isBodyType, type CompositionDocument } from "@composition/shared";
import {
  createEffectiveTypeResolver,
  resolveMoveTarget,
  type MoveTargetNode,
} from "../../../../domain/resolveMoveTarget";

type TreeDataLike = {
  getItem: (key: Key | string) => { value: LayerTreeNode } | null | undefined;
};

/** 중첩 preflight 입력 — store 노드 맵 (조상 사슬) 과 ref 원본 해석용 문서. */
export interface LayerDropNestingContext {
  nodes: ReadonlyMap<string, MoveTargetNode>;
  doc?: CompositionDocument | null;
}

export function isValidDrop(
  draggedId: string,
  targetId: string,
  dropPosition: "before" | "after" | "on",
  tree: TreeDataLike,
  nesting?: LayerDropNestingContext,
): { valid: boolean; reason?: string } {
  const draggedNode = tree.getItem(draggedId)?.value;
  const targetNode = tree.getItem(targetId)?.value;

  if (!draggedNode || !targetNode) {
    return { valid: false, reason: "invalid-node" };
  }

  if (draggedId === targetId) {
    return { valid: false, reason: "self-drop" };
  }

  if (isRenderProjectionId(draggedId) || isRenderProjectionId(targetId)) {
    return { valid: false, reason: "render-projection" };
  }

  if (isDescendant(draggedId, targetId, tree)) {
    return { valid: false, reason: "descendant-drop" };
  }

  if (draggedNode.virtualChildType || targetNode.virtualChildType) {
    return { valid: false, reason: "virtual-child" };
  }

  if (draggedNode.isSyntheticRefChild || targetNode.isSyntheticRefChild) {
    return { valid: false, reason: "synthetic-ref-child" };
  }

  if (isBodyType(draggedNode.type)) {
    return { valid: false, reason: "body-immutable" };
  }

  if (targetNode.depth === 0 && dropPosition !== "on") {
    return { valid: false, reason: "root-level-denied" };
  }

  const draggedElement = draggedNode.element;
  const targetElement = targetNode.element;
  if (
    draggedElement.page_id !== targetElement.page_id ||
    getFrameElementMirrorId(draggedElement) !==
      getFrameElementMirrorId(targetElement)
  ) {
    return { valid: false, reason: "context-mismatch" };
  }

  // 중첩 preflight (ADR-236 Phase 3, E7) — 전에는 store 가 드롭 뒤에 조용히 거부했다. 판정은 팔레트 ·
  //   붙여넣기와 같은 `resolveMoveTarget` 이고, Layers 는 사용자가 고른 자리를 떠나지 않으므로
  //   `reject` (가까운 조상으로 옮기지 않는다).
  if (nesting) {
    const parentId = dropPosition === "on" ? targetId : targetNode.parentId;
    const dragged = nesting.nodes.get(draggedId);
    if (parentId && dragged) {
      const typeOf = createEffectiveTypeResolver(nesting.nodes, nesting.doc);
      const target = resolveMoveTarget({
        targetParentId: parentId,
        insertionIndex: Number.MAX_SAFE_INTEGER,
        movingTypes: [typeOf(dragged)],
        nodes: nesting.nodes,
        policy: "reject",
        doc: nesting.doc,
      });
      if (!target.ok) return { valid: false, reason: "nesting" };
    }
  }

  return { valid: true };
}

function isDescendant(
  ancestorId: string,
  descendantId: string,
  tree: TreeDataLike,
): boolean {
  let current = tree.getItem(descendantId);
  const visited = new Set<string>();
  while (current && !visited.has(current.value.id)) {
    visited.add(current.value.id);
    if (current.value.parentId === ancestorId) return true;
    current = current.value.parentId
      ? tree.getItem(current.value.parentId)
      : null;
  }
  return false;
}
