import type { CanonicalMoveTarget } from "../../../../adapters/canonical/canonicalMutations";
import type { CanvasInteractionNode } from "./interactionNode";

type ProjectionLike =
  | {
      kind: "page-frame-element";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string | null;
      canonicalParentId: string | null;
      slotName?: string;
      descendantPath?: string;
    }
  | {
      kind: "page-slot-fill";
      pageId: string;
      sourceElementId: string;
      renderElementId: string;
      renderParentId: string;
      canonicalParentId: string | null;
      slotName: string;
      descendantPath: string;
    };

type ProjectedInteractionNode = CanvasInteractionNode & {
  projection?: ProjectionLike;
};

function hasProjectedId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.includes("::page-frame::");
}

function readProjection(
  node: CanvasInteractionNode | undefined,
): ProjectionLike | null {
  return ((node as ProjectedInteractionNode | undefined)?.projection ??
    null) as ProjectionLike | null;
}

export function resolveCanonicalMoveTarget(input: {
  renderTargetId: string;
  insertionIndex: number;
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
}): CanonicalMoveTarget | null {
  const targetNode = input.elementsMap.get(input.renderTargetId);
  const projection = readProjection(targetNode);

  if (projection?.kind === "page-frame-element") {
    if (!projection.descendantPath) return null;
    return {
      kind: "ref-descendants",
      refNodeId: projection.pageId,
      descendantPath: projection.descendantPath,
      insertionIndex: input.insertionIndex,
    };
  }

  if (projection?.kind === "page-slot-fill") {
    return {
      kind: "node-children",
      parentId: projection.sourceElementId,
      insertionIndex: input.insertionIndex,
    };
  }

  if (hasProjectedId(input.renderTargetId)) return null;

  return {
    kind: "node-children",
    parentId: input.renderTargetId,
    insertionIndex: input.insertionIndex,
  };
}
