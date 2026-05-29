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
    }
  // ADR-147 (layout edit): ListBox row/rows projection 은 비영속 render-space 노드다.
  // 클릭 시 canonical template anchor(없으면 ListBox)로 redirect 하여
  // 사용자가 행 layout 을 편집하면 모든 행에 반영되도록 한다. projected ID 는 selection 에 진입하지 않는다(§9).
  // (discriminated narrowing 을 위해 kind 별 멤버 분리.)
  | {
      kind: "listbox-row";
      listBoxId: string;
      templateAnchorId?: string | null;
      templateOriginId?: string | null;
      itemKey?: string;
      rowIndex?: number;
    }
  | {
      kind: "listbox-rows";
      listBoxId: string;
      templateAnchorId?: string | null;
      templateOriginId?: string | null;
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

    // ADR-147 (layout edit): listbox 행/그룹 projection → canonical template anchor 선택.
    if (
      projection.kind === "listbox-row" ||
      projection.kind === "listbox-rows"
    ) {
      return {
        kind: "select",
        elementId: projection.templateAnchorId ?? projection.listBoxId,
        pageId: readPageId(hitNode),
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
