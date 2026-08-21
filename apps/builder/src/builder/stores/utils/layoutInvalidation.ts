export { LAYOUT_AFFECTING_PROP_KEYS } from "../../presentation/invalidation/editorMutationEffectRegistry";

export interface LayoutInvalidationNode {
  readonly id: string;
}

export function collectDirtyElementSubtree(
  elementId: string,
  childrenMap: ReadonlyMap<string, readonly LayoutInvalidationNode[]>,
  dirtyIds: Set<string>,
): Set<string> {
  dirtyIds.add(elementId);

  const queue = [elementId];
  while (queue.length > 0) {
    const parentId = queue.pop()!;
    const children = childrenMap.get(parentId) ?? [];
    for (const child of children) {
      dirtyIds.add(child.id);
      queue.push(child.id);
    }
  }

  return dirtyIds;
}
