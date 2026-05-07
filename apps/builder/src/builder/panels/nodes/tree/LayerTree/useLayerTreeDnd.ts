import type { Key } from "react-stately";
import type { LayerTreeNode } from "./types";

type TreeDataLike = {
  items: LayerTreeNode[];
  getItem: (key: Key | string) => { value: LayerTreeNode } | null | undefined;
};

export function calculateMoveUpdates({
  tree,
  movedKeys,
  targetKey,
  dropPosition,
}: {
  tree: TreeDataLike;
  movedKeys: Set<Key>;
  targetKey: Key;
  dropPosition: "before" | "after" | "on";
}): Array<{ id: string; parentId: string | null; insertionIndex: number }> {
  const movedIds = [...movedKeys].map((key) => String(key));
  const targetNode = tree.getItem(targetKey)?.value;
  if (!targetNode) return [];

  const newParentId =
    dropPosition === "on" ? targetNode.id : (targetNode.parentId ?? null);

  const oldParentIds = new Set<string | null>();
  movedIds.forEach((id) => {
    const node = tree.getItem(id)?.value;
    oldParentIds.add(node?.parentId ?? null);
  });

  const affectedParents = new Set<string | null>([
    ...oldParentIds,
    newParentId,
  ]);

  const updates: Array<{
    id: string;
    parentId: string | null;
    insertionIndex: number;
  }> = [];

  affectedParents.forEach((parentId) => {
    const siblings = collectSiblings(tree, parentId);
    const filtered = siblings.filter((s) => !movedIds.includes(s.id));

    const finalListIds =
      parentId === newParentId
        ? insertAt(
            filtered.map((s) => s.id),
            movedIds,
            computeInsertIndex(filtered, targetKey, dropPosition),
          )
        : filtered.map((s) => s.id);

    finalListIds.forEach((id, index) => {
      const isMoved = movedIds.includes(id);
      if (isMoved && parentId === newParentId) {
        updates.push({ id, parentId: newParentId, insertionIndex: index });
      }
    });
  });

  return updates;
}

export function collectSiblings(
  tree: TreeDataLike,
  parentId: string | null,
): LayerTreeNode[] {
  return flattenTreeNodes(tree.items).filter(
    (node) => (node.parentId ?? null) === parentId,
  );
}

export function computeInsertIndex(
  siblings: LayerTreeNode[],
  targetKey: Key,
  dropPosition: "before" | "after" | "on",
): number {
  if (dropPosition === "on") {
    return siblings.length;
  }

  const targetId = String(targetKey);
  const targetIndex = siblings.findIndex((node) => node.id === targetId);
  if (targetIndex < 0) {
    return siblings.length;
  }

  return dropPosition === "before" ? targetIndex : targetIndex + 1;
}

export function insertAt(
  list: string[],
  items: string[],
  index: number,
): string[] {
  const clampedIndex = Math.max(0, Math.min(index, list.length));
  const next = list.slice();
  next.splice(clampedIndex, 0, ...items);
  return next;
}

function flattenTreeNodes(items: LayerTreeNode[]): LayerTreeNode[] {
  const result: LayerTreeNode[] = [];
  const stack = [...items];

  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) break;
    result.push(node);
    if (node.children && node.children.length > 0) {
      stack.unshift(...node.children);
    }
  }

  return result;
}
