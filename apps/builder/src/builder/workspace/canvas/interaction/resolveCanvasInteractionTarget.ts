import type { CanvasInteractionNode } from "./interactionNode";
import { resolveTopmostHitElementId } from "./selectionModel";

export type CanvasInteractionTarget =
  | {
      kind: "select";
      elementId: string;
      pageId: string | null;
    }
  | {
      kind: "slot-guard";
      renderSlotId: string;
      pageId: string;
      slotName: string;
      descendantPath: string;
    }
  | { kind: "none" };

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

function hasProjectedId(id: string): boolean {
  return id.includes("::page-frame::");
}

function isProjectedNode(
  node: CanvasInteractionNode | undefined,
): node is ProjectedInteractionNode {
  const projection = (node as ProjectedInteractionNode | undefined)?.projection;
  return Boolean(projection);
}

function readPageId(node: CanvasInteractionNode): string | null {
  return node.page_id ?? node.pageId ?? null;
}

export function resolveCanvasInteractionTarget(input: {
  candidateIds: readonly string[];
  elementsMap: ReadonlyMap<string, CanvasInteractionNode>;
  childrenMap?: ReadonlyMap<string, readonly CanvasInteractionNode[]> | null;
}): CanvasInteractionTarget {
  const hitId = resolveTopmostHitElementId(
    [...input.candidateIds],
    input.elementsMap,
    input.childrenMap,
  );
  if (!hitId) return { kind: "none" };

  const hitNode = input.elementsMap.get(hitId);
  if (!hitNode) return { kind: "none" };

  if (isProjectedNode(hitNode)) {
    const projection = hitNode.projection;
    if (!projection) return { kind: "none" };
    if (projection.kind === "page-slot-fill") {
      return {
        kind: "select",
        elementId: projection.sourceElementId,
        pageId: projection.pageId,
      };
    }

    if (
      hitNode.type === "Slot" &&
      projection.slotName &&
      projection.descendantPath
    ) {
      return {
        kind: "slot-guard",
        renderSlotId: hitNode.id,
        pageId: projection.pageId,
        slotName: projection.slotName,
        descendantPath: projection.descendantPath,
      };
    }
  }

  if (hasProjectedId(hitNode.id)) return { kind: "none" };

  return {
    kind: "select",
    elementId: hitNode.id,
    pageId: readPageId(hitNode),
  };
}
