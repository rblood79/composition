import type { CanvasSceneNode } from "./canvasSceneNode";

export interface PageDirtyState {
  affectedLayoutNodeIds: Set<string>;
  dirtyAncestorIds: Set<string>;
  dirtyIds: Set<string>;
  dirtyRootIds: Set<string>;
  hasDirty: boolean;
  layoutScopeSignature: string;
  signature: string;
}

interface BuildPageDirtyStateInput {
  bodyElement: CanvasSceneNode | null;
  dirtyElementIds: Set<string>;
  elementsMap: Map<string, CanvasSceneNode>;
  pageChildrenMap?: Map<string | null, CanvasSceneNode[]>;
}

export function buildPageDirtyState({
  bodyElement,
  dirtyElementIds,
  elementsMap,
  pageChildrenMap,
}: BuildPageDirtyStateInput): PageDirtyState {
  if (!bodyElement || dirtyElementIds.size === 0) {
    return {
      affectedLayoutNodeIds: new Set<string>(),
      dirtyAncestorIds: new Set<string>(),
      dirtyIds: new Set<string>(),
      dirtyRootIds: new Set<string>(),
      hasDirty: false,
      layoutScopeSignature: "",
      signature: "",
    };
  }

  const affectedLayoutNodeIds = new Set<string>();
  const dirtyIds = new Set<string>();
  const dirtyAncestorIds = new Set<string>();
  const dirtyRootIds = new Set<string>();
  const pageId = bodyElement.page_id;

  for (const dirtyId of dirtyElementIds) {
    const element = elementsMap.get(dirtyId);
    if (!element || element.page_id !== pageId) {
      continue;
    }

    dirtyIds.add(dirtyId);
    affectedLayoutNodeIds.add(dirtyId);

    let currentParentId = element.parent_id ?? null;
    while (currentParentId) {
      dirtyAncestorIds.add(currentParentId);
      affectedLayoutNodeIds.add(currentParentId);
      if (currentParentId === bodyElement.id) {
        break;
      }
      currentParentId = elementsMap.get(currentParentId)?.parent_id ?? null;
    }
  }

  for (const dirtyId of dirtyIds) {
    let currentId = dirtyId;
    let currentElement = elementsMap.get(currentId);

    while (
      currentElement?.parent_id &&
      dirtyIds.has(currentElement.parent_id)
    ) {
      currentId = currentElement.parent_id;
      currentElement = elementsMap.get(currentId);
    }

    dirtyRootIds.add(currentId);
  }

  if (pageChildrenMap) {
    const visitSubtree = (elementId: string): void => {
      affectedLayoutNodeIds.add(elementId);
      const children = pageChildrenMap.get(elementId) ?? [];
      for (const child of children) {
        visitSubtree(child.id);
      }
    };

    for (const dirtyRootId of dirtyRootIds) {
      visitSubtree(dirtyRootId);
    }
  }

  affectedLayoutNodeIds.add(bodyElement.id);
  const signature = [...dirtyRootIds].sort().join("|");
  const layoutScopeSignature = [...affectedLayoutNodeIds].sort().join("|");

  return {
    affectedLayoutNodeIds,
    dirtyAncestorIds,
    dirtyIds,
    dirtyRootIds,
    hasDirty: dirtyIds.size > 0,
    layoutScopeSignature,
    signature,
  };
}
