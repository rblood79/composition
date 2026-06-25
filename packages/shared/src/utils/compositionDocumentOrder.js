function isRootParent(parentId) {
    return parentId === null || parentId === "root";
}
function clampIndex(index, length) {
    if (typeof index !== "number" || !Number.isFinite(index))
        return length;
    return Math.max(0, Math.min(index, length));
}
function isDescendantChildrenMode(override) {
    return (Boolean(override) &&
        typeof override === "object" &&
        !("type" in override) &&
        "children" in override &&
        Array.isArray(override.children));
}
function cloneRefWithDescendants(refNode, descendants) {
    if (descendants && Object.keys(descendants).length > 0) {
        return { ...refNode, descendants };
    }
    const { descendants: _descendants, ...rest } = refNode;
    return rest;
}
function nodeContainsId(node, nodeId) {
    if (node.id === nodeId)
        return true;
    for (const child of node.children ?? []) {
        if (nodeContainsId(child, nodeId))
            return true;
    }
    if (node.type !== "ref")
        return false;
    const descendants = node.descendants ?? {};
    for (const override of Object.values(descendants)) {
        if (!isDescendantChildrenMode(override))
            continue;
        for (const child of override.children) {
            if (nodeContainsId(child, nodeId))
                return true;
        }
    }
    return false;
}
function findNodeInChildren(children, nodeId) {
    for (const child of children) {
        if (child.id === nodeId)
            return child;
        const nested = findNodeInChildren(child.children ?? [], nodeId);
        if (nested)
            return nested;
        if (child.type !== "ref")
            continue;
        const descendants = child.descendants ?? {};
        for (const override of Object.values(descendants)) {
            if (!isDescendantChildrenMode(override))
                continue;
            const descendantChild = findNodeInChildren(override.children, nodeId);
            if (descendantChild)
                return descendantChild;
        }
    }
    return null;
}
function findChildrenByParentId(children, parentId) {
    for (const child of children) {
        if (child.id === parentId)
            return child.children ?? [];
        const nested = findChildrenByParentId(child.children ?? [], parentId);
        if (nested)
            return nested;
        if (child.type !== "ref")
            continue;
        const descendants = child.descendants ?? {};
        for (const override of Object.values(descendants)) {
            if (!isDescendantChildrenMode(override))
                continue;
            const descendantChildren = findChildrenByParentId(override.children, parentId);
            if (descendantChildren)
                return descendantChildren;
        }
    }
    return null;
}
function insertIntoChildren(children, parentId, child, index) {
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
            const childResult = insertIntoChildren(node.children, parentId, child, index);
            if (childResult.changed) {
                changed = true;
                nextNode = { ...nextNode, children: childResult.children };
            }
        }
        if (nextNode.type !== "ref")
            return nextNode;
        const refNode = nextNode;
        const descendants = refNode.descendants ?? {};
        let descendantsChanged = false;
        const nextDescendants = {};
        for (const [descendantPath, override] of Object.entries(descendants)) {
            if (!isDescendantChildrenMode(override)) {
                nextDescendants[descendantPath] = override;
                continue;
            }
            const descendantResult = insertIntoChildren(override.children, parentId, child, index);
            if (descendantResult.changed) {
                descendantsChanged = true;
                nextDescendants[descendantPath] = {
                    children: descendantResult.children,
                };
                continue;
            }
            nextDescendants[descendantPath] = override;
        }
        if (!descendantsChanged)
            return nextNode;
        changed = true;
        return cloneRefWithDescendants(refNode, nextDescendants);
    });
    return { children: nextChildren, changed };
}
function removeFromChildren(children, childId) {
    let removed = null;
    const nextChildren = [];
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
            const refNode = nextNode;
            const descendants = refNode.descendants ?? {};
            let descendantsChanged = false;
            const nextDescendants = {};
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
function appendToDescendantChildren(children, refPath, descendantPath, child) {
    let changed = false;
    const nextChildren = children.map((node) => {
        let nextNode = node;
        if (node.children && node.children.length > 0) {
            const childResult = appendToDescendantChildren(node.children, refPath, descendantPath, child);
            if (childResult.changed) {
                changed = true;
                nextNode = { ...nextNode, children: childResult.children };
            }
        }
        if (nextNode.type !== "ref")
            return nextNode;
        const refNode = nextNode;
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
        const nextDescendants = {};
        for (const [path, override] of Object.entries(descendants)) {
            if (!isDescendantChildrenMode(override)) {
                nextDescendants[path] = override;
                continue;
            }
            const descendantResult = appendToDescendantChildren(override.children, refPath, descendantPath, child);
            if (descendantResult.changed) {
                descendantsChanged = true;
                nextDescendants[path] = {
                    children: descendantResult.children,
                };
                continue;
            }
            nextDescendants[path] = override;
        }
        if (!descendantsChanged)
            return nextNode;
        changed = true;
        return cloneRefWithDescendants(refNode, nextDescendants);
    });
    return { children: nextChildren, changed };
}
function insertIntoDescendantChildren(children, refPath, descendantPath, child, index) {
    let changed = false;
    const nextChildren = children.map((node) => {
        let nextNode = node;
        if (node.children && node.children.length > 0) {
            const childResult = insertIntoDescendantChildren(node.children, refPath, descendantPath, child, index);
            if (childResult.changed) {
                changed = true;
                nextNode = { ...nextNode, children: childResult.children };
            }
        }
        if (nextNode.type !== "ref")
            return nextNode;
        const refNode = nextNode;
        const descendants = refNode.descendants ?? {};
        if (refNode.id === refPath) {
            const currentOverride = descendants[descendantPath];
            if (currentOverride && !isDescendantChildrenMode(currentOverride)) {
                return nextNode;
            }
            const currentChildren = currentOverride?.children ?? [];
            const inserted = [...currentChildren];
            inserted.splice(clampIndex(index, inserted.length), 0, child);
            changed = true;
            return cloneRefWithDescendants(refNode, {
                ...descendants,
                [descendantPath]: { children: inserted },
            });
        }
        let descendantsChanged = false;
        const nextDescendants = {};
        for (const [path, override] of Object.entries(descendants)) {
            if (!isDescendantChildrenMode(override)) {
                nextDescendants[path] = override;
                continue;
            }
            const descendantResult = insertIntoDescendantChildren(override.children, refPath, descendantPath, child, index);
            if (descendantResult.changed) {
                descendantsChanged = true;
                nextDescendants[path] = {
                    children: descendantResult.children,
                };
                continue;
            }
            nextDescendants[path] = override;
        }
        if (!descendantsChanged)
            return nextNode;
        changed = true;
        return cloneRefWithDescendants(refNode, nextDescendants);
    });
    return { children: nextChildren, changed };
}
function moveWithinDescendantChildren(children, refPath, descendantPath, childId, index) {
    let changed = false;
    const nextChildren = children.map((node) => {
        let nextNode = node;
        if (node.children && node.children.length > 0) {
            const childResult = moveWithinDescendantChildren(node.children, refPath, descendantPath, childId, index);
            if (childResult.changed) {
                changed = true;
                nextNode = { ...nextNode, children: childResult.children };
            }
        }
        if (nextNode.type !== "ref")
            return nextNode;
        const refNode = nextNode;
        const descendants = refNode.descendants ?? {};
        if (refNode.id === refPath) {
            const currentOverride = descendants[descendantPath];
            if (!isDescendantChildrenMode(currentOverride))
                return nextNode;
            const currentChildren = currentOverride.children;
            const currentIndex = currentChildren.findIndex((child) => child.id === childId);
            if (currentIndex === -1)
                return nextNode;
            const movingChild = currentChildren[currentIndex];
            const withoutMoving = currentChildren.filter((child) => child.id !== childId);
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
        const nextDescendants = {};
        for (const [path, override] of Object.entries(descendants)) {
            if (!isDescendantChildrenMode(override)) {
                nextDescendants[path] = override;
                continue;
            }
            const descendantResult = moveWithinDescendantChildren(override.children, refPath, descendantPath, childId, index);
            if (descendantResult.changed) {
                descendantsChanged = true;
                nextDescendants[path] = {
                    children: descendantResult.children,
                };
                continue;
            }
            nextDescendants[path] = override;
        }
        if (!descendantsChanged)
            return nextNode;
        changed = true;
        return cloneRefWithDescendants(refNode, nextDescendants);
    });
    return { children: nextChildren, changed };
}
export function getCanonicalChildren(document, parentId) {
    if (isRootParent(parentId))
        return document.children;
    return findChildrenByParentId(document.children, parentId);
}
export function insertCanonicalChild(document, parentId, child, index) {
    if (findNodeInChildren(document.children, child.id)) {
        return { document, changed: false };
    }
    const result = insertIntoChildren(document.children, parentId, child, index);
    return result.changed
        ? { document: { ...document, children: result.children }, changed: true }
        : { document, changed: false };
}
export function removeCanonicalChild(document, childId) {
    const result = removeFromChildren(document.children, childId);
    return result.removed
        ? {
            document: { ...document, children: result.children },
            changed: true,
            removed: result.removed,
        }
        : { document, changed: false, removed: null };
}
export function moveCanonicalChild(document, childId, targetParentId, index) {
    const movingNode = findNodeInChildren(document.children, childId);
    if (!movingNode || nodeContainsId(movingNode, targetParentId ?? "")) {
        return { document, changed: false };
    }
    const removed = removeCanonicalChild(document, childId);
    if (!removed.removed)
        return { document, changed: false };
    const inserted = insertCanonicalChild(removed.document, targetParentId, removed.removed, index);
    return inserted.changed ? inserted : { document, changed: false };
}
export function appendDescendantChild(document, refPath, descendantPath, child) {
    if (findNodeInChildren(document.children, child.id)) {
        return { document, changed: false };
    }
    const result = appendToDescendantChildren(document.children, refPath, descendantPath, child);
    return result.changed
        ? { document: { ...document, children: result.children }, changed: true }
        : { document, changed: false };
}
export function moveDescendantChild(document, refPath, descendantPath, childId, index) {
    const result = moveWithinDescendantChildren(document.children, refPath, descendantPath, childId, index);
    return result.changed
        ? { document: { ...document, children: result.children }, changed: true }
        : { document, changed: false };
}
export function moveCanonicalChildToDescendants(document, childId, refPath, descendantPath, index) {
    const movingNode = findNodeInChildren(document.children, childId);
    if (!movingNode || nodeContainsId(movingNode, refPath)) {
        return { document, changed: false };
    }
    const removed = removeCanonicalChild(document, childId);
    if (!removed.removed)
        return { document, changed: false };
    const inserted = insertIntoDescendantChildren(removed.document.children, refPath, descendantPath, removed.removed, index);
    return inserted.changed
        ? {
            document: { ...removed.document, children: inserted.children },
            changed: true,
        }
        : { document, changed: false };
}
//# sourceMappingURL=compositionDocumentOrder.js.map