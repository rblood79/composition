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

    // listbox 행/그룹 projection 클릭 → ListBox 컴포넌트 선택.
    //   template anchor 는 suppressedAnchorId 로 scene/interaction map 에서 제외되는
    //   canonical ref(비-scene) 노드라 선택 대상이 될 수 없다 → templateAnchorId 반환은 no-op
    //   (selection 실패)였다. ListBox 의 padding 영역 클릭은 동작하지만 행 클릭은 선택이 안 되던 버그.
    //   행 layout 편집은 origin ListBoxItem(Components page) 편집 → projection 행 style 전파 경로 사용.
    if (
      projection.kind === "listbox-row" ||
      projection.kind === "listbox-rows"
    ) {
      return {
        kind: "select",
        elementId: projection.listBoxId,
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
