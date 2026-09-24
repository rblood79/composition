import type { PageProjectionMetadata } from "../canvasProjection";
import type { CanonicalMoveTarget } from "../../../../adapters/canonical/canonicalMutations";
import type { CanvasInteractionNode } from "./interactionNode";
import { isSyntheticDescendantId } from "../../../stores/canonical/syntheticDescendantLookup";
import { getActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import { resolveSlotRegionTarget } from "../../../components/slotRegionInsert";

type ProjectionLike = PageProjectionMetadata;

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

  // ADR-240 Phase 2 (F20) — instance 안 이름 영역 = 그 instance 의 mode C (`descendants[영역 경로].children`).
  if (isSyntheticDescendantId(input.renderTargetId)) {
    const document = getActiveCanonicalDocument();
    const region = document
      ? resolveSlotRegionTarget(document, input.renderTargetId)
      : null;
    if (!region) return null;
    return {
      kind: "ref-descendants",
      refNodeId: region.instanceId,
      descendantPath: region.regionPath,
      insertionIndex: input.insertionIndex,
    };
  }

  return {
    kind: "node-children",
    parentId: input.renderTargetId,
    insertionIndex: input.insertionIndex,
  };
}
