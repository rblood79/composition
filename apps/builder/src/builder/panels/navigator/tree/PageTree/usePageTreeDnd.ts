import type { Key } from "react-stately";
import type { PageTreeNode } from "./types";

type TreeDataLike = {
  items: PageTreeNode[];
  getItem: (key: Key | string) => { value: PageTreeNode } | null | undefined;
};

export function calculatePageMoveUpdates({
  tree,
  movedKeys,
  targetKey,
  dropPosition,
}: {
  tree: TreeDataLike;
  movedKeys: Set<Key>;
  targetKey: Key;
  dropPosition: "before" | "after" | "on";
}): Array<{ id: string; parentId?: string | null }> {
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

  const updates: Array<{ id: string; parentId?: string | null }> = [];

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

    finalListIds.forEach((id) => {
      const isMoved = movedIds.includes(id);
      updates.push({
        id,
        ...(isMoved && parentId === newParentId && { parentId: newParentId }),
      });
    });
  });

  return updates;
}

export function collectSiblings(
  tree: TreeDataLike,
  parentId: string | null,
): PageTreeNode[] {
  return flattenTreeNodes(tree.items).filter(
    (node) => (node.parentId ?? null) === parentId,
  );
}

export function computeInsertIndex(
  siblings: PageTreeNode[],
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

function flattenTreeNodes(items: PageTreeNode[]): PageTreeNode[] {
  const result: PageTreeNode[] = [];
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
