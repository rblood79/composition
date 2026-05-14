import type { CanonicalNode, RefNode } from "@composition/shared";

export type RefDescendantChildTransform = (
  child: CanonicalNode,
  descendantPath: string,
) => CanonicalNode;

function collectRefDescendantChildren(
  refNode: RefNode,
  transformDescendantChild?: RefDescendantChildTransform,
): CanonicalNode[] {
  const children: CanonicalNode[] = [];
  const descendants = refNode.descendants ?? {};

  for (const [descendantPath, override] of Object.entries(descendants)) {
    if (
      override &&
      typeof override === "object" &&
      "children" in override &&
      Array.isArray(override.children)
    ) {
      children.push(
        ...override.children.map((child) =>
          transformDescendantChild
            ? transformDescendantChild(child, descendantPath)
            : child,
        ),
      );
      continue;
    }

    if (
      override &&
      typeof override === "object" &&
      "type" in override &&
      typeof override.type === "string"
    ) {
      const child = override as CanonicalNode;
      children.push(
        transformDescendantChild
          ? transformDescendantChild(child, descendantPath)
          : child,
      );
    }
  }

  return children;
}

export function getPageOwnedChildrenFromFrameRef(
  refNode: RefNode,
  transformDescendantChild?: RefDescendantChildTransform,
): CanonicalNode[] {
  const children: CanonicalNode[] = [];
  const seenIds = new Set<string>();

  for (const child of refNode.children ?? []) {
    children.push(child);
    seenIds.add(child.id);
  }

  for (const child of collectRefDescendantChildren(
    refNode,
    transformDescendantChild,
  )) {
    if (seenIds.has(child.id)) continue;
    children.push(child);
    seenIds.add(child.id);
  }

  return children;
}
