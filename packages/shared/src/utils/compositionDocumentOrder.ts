import type {
  CanonicalNode,
  CompositionDocument,
  DescendantChildrenMode,
  DescendantOverride,
  RefNode,
} from "../types/composition-document.types";

export type CanonicalParentId = string | null;

export type CanonicalDocumentOrderResult = {
  document: CompositionDocument;
  changed: boolean;
};

export type CanonicalRemoveResult = CanonicalDocumentOrderResult & {
  removed: CanonicalNode | null;
};

function isRootParent(parentId: CanonicalParentId): parentId is null | "root" {
  return parentId === null || parentId === "root";
}

function clampIndex(index: number | undefined, length: number): number {
  if (typeof index !== "number" || !Number.isFinite(index)) return length;
  return Math.max(0, Math.min(index, length));
}

function isDescendantChildrenMode(
  override: DescendantOverride | undefined,
): override is DescendantChildrenMode {
  return (
    Boolean(override) &&
    typeof override === "object" &&
    !("type" in override) &&
    "children" in override &&
    Array.isArray((override as { children?: unknown }).children)
  );
}

function cloneRefWithDescendants(
  refNode: RefNode,
  descendants: RefNode["descendants"],
): RefNode {
  if (descendants && Object.keys(descendants).length > 0) {
    return { ...refNode, descendants };
  }

  const { descendants: _descendants, ...rest } = refNode;
  return rest as RefNode;
}

function nodeContainsId(node: CanonicalNode, nodeId: string): boolean {
  if (node.id === nodeId) return true;

  for (const child of node.children ?? []) {
    if (nodeContainsId(child, nodeId)) return true;
  }

  if (node.type !== "ref") return false;
  const descendants = (node as RefNode).descendants ?? {};
  for (const override of Object.values(descendants)) {
    if (!isDescendantChildrenMode(override)) continue;
    for (const child of override.children) {
      if (nodeContainsId(child, nodeId)) return true;
    }
  }

  return false;
}

function findNodeInChildren(
  children: readonly CanonicalNode[],
  nodeId: string,
): CanonicalNode | null {
  for (const child of children) {
    if (child.id === nodeId) return child;

    const nested = findNodeInChildren(child.children ?? [], nodeId);
    if (nested) return nested;

    if (child.type !== "ref") continue;
    const descendants = (child as RefNode).descendants ?? {};
    for (const override of Object.values(descendants)) {
      if (!isDescendantChildrenMode(override)) continue;
      const descendantChild = findNodeInChildren(override.children, nodeId);
      if (descendantChild) return descendantChild;
    }
  }

  return null;
}

function findChildrenByParentId(
  children: readonly CanonicalNode[],
  parentId: string,
): readonly CanonicalNode[] | null {
  for (const child of children) {
    if (child.id === parentId) return child.children ?? [];

    const nested = findChildrenByParentId(child.children ?? [], parentId);
    if (nested) return nested;

    if (child.type !== "ref") continue;
    const descendants = (child as RefNode).descendants ?? {};
    for (const override of Object.values(descendants)) {
      if (!isDescendantChildrenMode(override)) continue;
      const descendantChildren = findChildrenByParentId(
        override.children,
        parentId,
      );
      if (descendantChildren) return descendantChildren;
    }
  }

  return null;
}

function insertIntoChildren(
  children: readonly CanonicalNode[],
  parentId: CanonicalParentId,
  child: CanonicalNode,
  index: number | undefined,
): { children: CanonicalNode[]; changed: boolean } {
  if (isRootParent(parentId)) {
    const nextChildren = [...children];
    nextChildren.splice(clampIndex(index, nextChildren.length), 0, child);
    return { children: nextChildren, changed: true };
  }

  let changed = false;
  const nextChildren = children.map((node) => {
    let nextNode = node;

    if (node.id === parentId) {
      const currentChildren = node.children ?? [];
      const childIndex = clampIndex(index, currentChildren.length);
      const inserted = [...currentChildren];
      inserted.splice(childIndex, 0, child);
      changed = true;
      return { ...node, children: inserted };
    }

    if (node.children && node.children.length > 0) {
      const childResult = insertIntoChildren(
        node.children,
        parentId,
        child,
        index,
      );
      if (childResult.changed) {
        changed = true;
        nextNode = { ...nextNode, children: childResult.children };
      }
    }

    if (nextNode.type !== "ref") return nextNode;

    const refNode = nextNode as RefNode;
    const descendants = refNode.descendants ?? {};
    let descendantsChanged = false;
    const nextDescendants: RefNode["descendants"] = {};

    for (const [descendantPath, override] of Object.entries(descendants)) {
      if (!isDescendantChildrenMode(override)) {
        nextDescendants[descendantPath] = override;
        continue;
      }

      const descendantResult = insertIntoChildren(
        override.children,
        parentId,
        child,
        index,
      );
      if (descendantResult.changed) {
        descendantsChanged = true;
        nextDescendants[descendantPath] = {
          children: descendantResult.children,
        };
        continue;
      }

      nextDescendants[descendantPath] = override;
    }

    if (!descendantsChanged) return nextNode;
    changed = true;
    return cloneRefWithDescendants(refNode, nextDescendants);
  });

  return { children: nextChildren, changed };
}

function removeFromChildren(
  children: readonly CanonicalNode[],
  childId: string,
): { children: CanonicalNode[]; removed: CanonicalNode | null } {
  let removed: CanonicalNode | null = null;
  const nextChildren: CanonicalNode[] = [];

  for (const node of children) {
    if (node.id === childId) {
      removed = node;
      continue;
    }

    let nextNode = node;

    if (node.children && node.children.length > 0) {
      const childResult = removeFromChildren(node.children, childId);
      if (childResult.removed) {
        removed = childResult.removed;
        nextNode = { ...nextNode, children: childResult.children };
      }
    }

    if (nextNode.type === "ref") {
      const refNode = nextNode as RefNode;
      const descendants = refNode.descendants ?? {};
      let descendantsChanged = false;
      const nextDescendants: RefNode["descendants"] = {};

      for (const [descendantPath, override] of Object.entries(descendants)) {
        if (!isDescendantChildrenMode(override)) {
          nextDescendants[descendantPath] = override;
          continue;
        }

        const descendantResult = removeFromChildren(override.children, childId);
        if (descendantResult.removed) {
          removed = descendantResult.removed;
          descendantsChanged = true;
          nextDescendants[descendantPath] = {
            children: descendantResult.children,
          };
          continue;
        }

        nextDescendants[descendantPath] = override;
      }

      if (descendantsChanged) {
        nextNode = cloneRefWithDescendants(refNode, nextDescendants);
      }
    }

    nextChildren.push(nextNode);
  }

  return { children: nextChildren, removed };
}

function appendToDescendantChildren(
  children: readonly CanonicalNode[],
  refPath: string,
  descendantPath: string,
  child: CanonicalNode,
): { children: CanonicalNode[]; changed: boolean } {
  let changed = false;
  const nextChildren = children.map((node) => {
    let nextNode = node;

    if (node.children && node.children.length > 0) {
      const childResult = appendToDescendantChildren(
        node.children,
        refPath,
        descendantPath,
        child,
      );
      if (childResult.changed) {
        changed = true;
        nextNode = { ...nextNode, children: childResult.children };
      }
    }

    if (nextNode.type !== "ref") return nextNode;

    const refNode = nextNode as RefNode;
    const descendants = refNode.descendants ?? {};

    if (refNode.id === refPath) {
      const currentOverride = descendants[descendantPath];
      if (currentOverride && !isDescendantChildrenMode(currentOverride)) {
        return nextNode;
      }

      const currentChildren = currentOverride?.children ?? [];
      changed = true;
      return cloneRefWithDescendants(refNode, {
        ...descendants,
        [descendantPath]: { children: [...currentChildren, child] },
      });
    }

    let descendantsChanged = false;
    const nextDescendants: RefNode["descendants"] = {};

    for (const [path, override] of Object.entries(descendants)) {
      if (!isDescendantChildrenMode(override)) {
        nextDescendants[path] = override;
        continue;
      }

      const descendantResult = appendToDescendantChildren(
        override.children,
        refPath,
        descendantPath,
        child,
      );
      if (descendantResult.changed) {
        descendantsChanged = true;
        nextDescendants[path] = {
          children: descendantResult.children,
        };
        continue;
      }

      nextDescendants[path] = override;
    }

    if (!descendantsChanged) return nextNode;
    changed = true;
    return cloneRefWithDescendants(refNode, nextDescendants);
  });

  return { children: nextChildren, changed };
}

function insertIntoDescendantChildren(
  children: readonly CanonicalNode[],
  refPath: string,
  descendantPath: string,
  child: CanonicalNode,
  index: number,
): { children: CanonicalNode[]; changed: boolean } {
  let changed = false;
  const nextChildren = children.map((node) => {
    let nextNode = node;

    if (node.children && node.children.length > 0) {
      const childResult = insertIntoDescendantChildren(
        node.children,
        refPath,
        descendantPath,
        child,
        index,
      );
      if (childResult.changed) {
        changed = true;
        nextNode = { ...nextNode, children: childResult.children };
      }
    }

    if (nextNode.type !== "ref") return nextNode;

    const refNode = nextNode as RefNode;
    const descendants = refNode.descendants ?? {};

    if (refNode.id === refPath) {
      const currentOverride = descendants[descendantPath];
      // mode B (노드 교체) 만 거부 — mode A patch (영역 host 의 style 등) 는 보존하고 children 을 얹는다
      //   (ADR-240 Phase 2: 스타일만 준 영역에 drop 하면 조용히 무시되던 자리).
      if (currentOverride && "type" in currentOverride) {
        return nextNode;
      }

      const currentChildren = isDescendantChildrenMode(currentOverride)
        ? currentOverride.children
        : [];
      const inserted = [...currentChildren];
      inserted.splice(clampIndex(index, inserted.length), 0, child);
      changed = true;
      return cloneRefWithDescendants(refNode, {
        ...descendants,
        [descendantPath]: {
          ...(currentOverride ?? {}),
          children: inserted,
        } as DescendantOverride,
      });
    }

    let descendantsChanged = false;
    const nextDescendants: RefNode["descendants"] = {};

    for (const [path, override] of Object.entries(descendants)) {
      if (!isDescendantChildrenMode(override)) {
        nextDescendants[path] = override;
        continue;
      }

      const descendantResult = insertIntoDescendantChildren(
        override.children,
        refPath,
        descendantPath,
        child,
        index,
      );
      if (descendantResult.changed) {
        descendantsChanged = true;
        nextDescendants[path] = {
          children: descendantResult.children,
        };
        continue;
      }

      nextDescendants[path] = override;
    }

    if (!descendantsChanged) return nextNode;
    changed = true;
    return cloneRefWithDescendants(refNode, nextDescendants);
  });

  return { children: nextChildren, changed };
}

function moveWithinDescendantChildren(
  children: readonly CanonicalNode[],
  refPath: string,
  descendantPath: string,
  childId: string,
  index: number,
): { children: CanonicalNode[]; changed: boolean } {
  let changed = false;
  const nextChildren = children.map((node) => {
    let nextNode = node;

    if (node.children && node.children.length > 0) {
      const childResult = moveWithinDescendantChildren(
        node.children,
        refPath,
        descendantPath,
        childId,
        index,
      );
      if (childResult.changed) {
        changed = true;
        nextNode = { ...nextNode, children: childResult.children };
      }
    }

    if (nextNode.type !== "ref") return nextNode;

    const refNode = nextNode as RefNode;
    const descendants = refNode.descendants ?? {};

    if (refNode.id === refPath) {
      const currentOverride = descendants[descendantPath];
      if (!isDescendantChildrenMode(currentOverride)) return nextNode;

      const currentChildren = currentOverride.children;
      const currentIndex = currentChildren.findIndex(
        (child) => child.id === childId,
      );
      if (currentIndex === -1) return nextNode;

      const movingChild = currentChildren[currentIndex];
      const withoutMoving = currentChildren.filter(
        (child) => child.id !== childId,
      );
      const targetIndex = clampIndex(index, withoutMoving.length);
      const reordered = [...withoutMoving];
      reordered.splice(targetIndex, 0, movingChild);

      if (currentChildren.every((child, i) => child.id === reordered[i]?.id)) {
        return nextNode;
      }

      changed = true;
      return cloneRefWithDescendants(refNode, {
        ...descendants,
        [descendantPath]: { children: reordered },
      });
    }

    let descendantsChanged = false;
    const nextDescendants: RefNode["descendants"] = {};

    for (const [path, override] of Object.entries(descendants)) {
      if (!isDescendantChildrenMode(override)) {
        nextDescendants[path] = override;
        continue;
      }

      const descendantResult = moveWithinDescendantChildren(
        override.children,
        refPath,
        descendantPath,
        childId,
        index,
      );
      if (descendantResult.changed) {
        descendantsChanged = true;
        nextDescendants[path] = {
          children: descendantResult.children,
        };
        continue;
      }

      nextDescendants[path] = override;
    }

    if (!descendantsChanged) return nextNode;
    changed = true;
    return cloneRefWithDescendants(refNode, nextDescendants);
  });

  return { children: nextChildren, changed };
}

export function getCanonicalChildren(
  document: CompositionDocument,
  parentId: CanonicalParentId,
): readonly CanonicalNode[] | null {
  if (isRootParent(parentId)) return document.children;
  return findChildrenByParentId(document.children, parentId);
}

export function insertCanonicalChild(
  document: CompositionDocument,
  parentId: CanonicalParentId,
  child: CanonicalNode,
  index?: number,
): CanonicalDocumentOrderResult {
  if (findNodeInChildren(document.children, child.id)) {
    return { document, changed: false };
  }

  const result = insertIntoChildren(document.children, parentId, child, index);
  return result.changed
    ? { document: { ...document, children: result.children }, changed: true }
    : { document, changed: false };
}

export function removeCanonicalChild(
  document: CompositionDocument,
  childId: string,
): CanonicalRemoveResult {
  const result = removeFromChildren(document.children, childId);
  return result.removed
    ? {
        document: { ...document, children: result.children },
        changed: true,
        removed: result.removed,
      }
    : { document, changed: false, removed: null };
}

export function moveCanonicalChild(
  document: CompositionDocument,
  childId: string,
  targetParentId: CanonicalParentId,
  index: number,
): CanonicalDocumentOrderResult {
  const movingNode = findNodeInChildren(document.children, childId);
  if (!movingNode || nodeContainsId(movingNode, targetParentId ?? "")) {
    return { document, changed: false };
  }
  const sourceParent = findParentNode(document.children, childId, null);

  const removed = removeCanonicalChild(document, childId);
  if (!removed.removed) return { document, changed: false };

  const inserted = insertCanonicalChild(
    removed.document,
    targetParentId,
    removed.removed,
    index,
  );
  if (!inserted.changed) return { document, changed: false };
  // ADR-241 Phase 3 — TableView 열 순서 변경 (같은 TableHeader 안) 은 모든 정적 행의 셀 순서를 같이 바꾼다. Layer drop ·
  //   키보드 · Canvas drag · undo/redo 재생이 모두 이 함수를 지나므로 되돌리기까지 대칭이다.
  if (
    sourceParent &&
    String(sourceParent.type) === "TableHeader" &&
    sourceParent.id === targetParentId
  ) {
    const fromIndex = (sourceParent.children ?? []).findIndex(
      (child) => child.id === childId,
    );
    const toIndex = (
      findChildrenByParentId(inserted.document.children, sourceParent.id) ?? []
    ).findIndex((child) => child.id === childId);
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      return {
        ...inserted,
        document: alignTableViewCellsToColumnMove(
          inserted.document,
          sourceParent.id,
          fromIndex,
          toIndex,
        ),
      };
    }
  }
  return inserted;
}

/** 문서 트리 (ref descendants 안쪽 제외) 에서 부모 — 최상위면 null, 없으면 undefined. */
function findParentNode(
  children: readonly CanonicalNode[],
  childId: string,
  parent: CanonicalNode | null,
): CanonicalNode | null | undefined {
  for (const child of children) {
    if (child.id === childId) return parent;
    const hit = findParentNode(child.children ?? [], childId, child);
    if (hit !== undefined) return hit;
  }
  return undefined;
}

function replaceNodeById(
  children: readonly CanonicalNode[],
  nodeId: string,
  replace: (node: CanonicalNode) => CanonicalNode,
): { children: CanonicalNode[]; changed: boolean } {
  let changed = false;
  const next = children.map((child) => {
    if (child.id === nodeId) {
      changed = true;
      return replace(child);
    }
    if (!child.children) return child;
    const inner = replaceNodeById(child.children, nodeId, replace);
    if (!inner.changed) return child;
    changed = true;
    return { ...child, children: inner.children };
  });
  return { children: changed ? next : (children as CanonicalNode[]), changed };
}

/**
 * ADR-241 Phase 3 — TableView 의 열 하나가 `fromIndex` → `toIndex` 로 옮겨졌을 때 모든 정적 행 (TableBody 자식) 의 셀을 같은
 * 자리로 옮긴다. 행 하나라도 셀 수 ≠ 열 수면 (동기화 대상 아님, 리뷰 r1 m2) 또는 TableView 가 아니면 그대로.
 */
export function alignTableViewCellsToColumnMove(
  document: CompositionDocument,
  headerId: string,
  fromIndex: number,
  toIndex: number,
): CompositionDocument {
  const tableView = findParentNode(document.children, headerId, null);
  if (!tableView || String(tableView.type) !== "TableView") return document;
  const header = (tableView.children ?? []).find(
    (child) => child.id === headerId,
  );
  const body = (tableView.children ?? []).find(
    (child) => String(child.type) === "TableBody",
  );
  const columnCount = header?.children?.length ?? 0;
  const rows = body?.children ?? [];
  if (
    !body ||
    rows.length === 0 ||
    !rows.every((row) => (row.children?.length ?? 0) === columnCount)
  ) {
    return document;
  }
  const nextRows = rows.map((row) => {
    const cells = [...(row.children ?? [])];
    const [moved] = cells.splice(fromIndex, 1);
    if (!moved) return row;
    cells.splice(toIndex, 0, moved);
    return { ...row, children: cells };
  });
  const result = replaceNodeById(document.children, body.id, (node) => ({
    ...node,
    children: nextRows,
  }));
  return result.changed ? { ...document, children: result.children } : document;
}

export function appendDescendantChild(
  document: CompositionDocument,
  refPath: string,
  descendantPath: string,
  child: CanonicalNode,
): CanonicalDocumentOrderResult {
  if (findNodeInChildren(document.children, child.id)) {
    return { document, changed: false };
  }

  const result = appendToDescendantChildren(
    document.children,
    refPath,
    descendantPath,
    child,
  );
  return result.changed
    ? { document: { ...document, children: result.children }, changed: true }
    : { document, changed: false };
}

export function moveDescendantChild(
  document: CompositionDocument,
  refPath: string,
  descendantPath: string,
  childId: string,
  index: number,
): CanonicalDocumentOrderResult {
  const result = moveWithinDescendantChildren(
    document.children,
    refPath,
    descendantPath,
    childId,
    index,
  );
  return result.changed
    ? { document: { ...document, children: result.children }, changed: true }
    : { document, changed: false };
}

export function moveCanonicalChildToDescendants(
  document: CompositionDocument,
  childId: string,
  refPath: string,
  descendantPath: string,
  index: number,
): CanonicalDocumentOrderResult {
  const movingNode = findNodeInChildren(document.children, childId);
  if (!movingNode || nodeContainsId(movingNode, refPath)) {
    return { document, changed: false };
  }

  const removed = removeCanonicalChild(document, childId);
  if (!removed.removed) return { document, changed: false };

  const inserted = insertIntoDescendantChildren(
    removed.document.children,
    refPath,
    descendantPath,
    removed.removed,
    index,
  );
  return inserted.changed
    ? {
        document: { ...removed.document, children: inserted.children },
        changed: true,
      }
    : { document, changed: false };
}
