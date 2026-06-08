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
  // ADR-912 영역 B (A): tag-row(chip)/tab-row/breadcrumb-row 도 1단 row family 동형
  //   (owner=collection 컴포넌트 select redirect).
  | {
      kind:
        | "listbox-row"
        | "gridlist-row"
        | "table-row"
        | "tag-row"
        | "tab-row"
        | "breadcrumb-row";
      listBoxId: string;
      templateAnchorId?: string | null;
      templateOriginId?: string | null;
      itemKey?: string;
      rowIndex?: number;
    }
  | {
      kind:
        | "listbox-rows"
        | "gridlist-rows"
        | "table-rows"
        | "tag-rows"
        | "tab-rows"
        | "breadcrumb-rows";
      listBoxId: string;
      templateAnchorId?: string | null;
      templateOriginId?: string | null;
    }
  // ADR-912 단계 4 C1 (Table 2D): cell 은 columnId 차원 추가. 단일클릭은 owner Table 선택
  //   (row/rows 동형), columnId 는 write-target(resolveCollectionWriteTarget) 라우팅 전용.
  | {
      kind: "table-cell";
      listBoxId: string;
      itemKey?: string;
      rowIndex?: number;
      columnId?: string;
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
    // collection row/rows projection 클릭 → collection 컴포넌트 선택. listbox/gridlist 동형
    //   (discriminated narrowing 보존 위해 kind 직접 비교 — helper 는 boolean 이라 narrow 못 함).
    //   신규 family 추가 시 본 OR + ProjectionLike union 동시 갱신.
    if (
      projection.kind === "listbox-row" ||
      projection.kind === "listbox-rows" ||
      projection.kind === "gridlist-row" ||
      projection.kind === "gridlist-rows" ||
      projection.kind === "table-row" ||
      projection.kind === "table-rows" ||
      projection.kind === "table-cell" ||
      // ADR-912 영역 B (A): TagGroup chip(tag-row)/컨테이너(tag-rows) 클릭 → owner select
      //   redirect. listBoxId = TagList scene node id (TagGroup 의 중간 컨테이너 — chip 좌표계).
      //   chip 1노드 = self-render seam 제거 + Taffy flexWrap parity + selection 보존이 본 slice
      //   증명 대상. X 독립 hit/remove mutation 은 후속(layout overlay + interaction kind 계약).
      projection.kind === "tag-row" ||
      projection.kind === "tag-rows" ||
      // ADR-912 영역 B (A): Tab(tab-row/tab-rows) 클릭 → owner Tabs select redirect.
      //   listBoxId = TabList scene node id. (Tab slice 4-6 dc9617da0 에서 이 분기 추가가
      //   누락되어 tab projection id 가 selection 으로 유입될 수 있던 갭을 Breadcrumb slice 와
      //   함께 동형 보강 — 같은 owner-redirect 진입점.)
      projection.kind === "tab-row" ||
      projection.kind === "tab-rows" ||
      // ADR-912 영역 B (A): Breadcrumbs crumb(breadcrumb-row/breadcrumb-rows) 클릭 → owner
      //   Breadcrumbs select redirect. listBoxId = Breadcrumbs scene node id (중간 컨테이너
      //   없는 직접). crumb 1노드 = spec render.shapes seam 유지 + selection 보존이 증명 대상.
      projection.kind === "breadcrumb-row" ||
      projection.kind === "breadcrumb-rows"
    ) {
      return {
        kind: "select",
        elementId: projection.listBoxId,
        pageId: readPageId(hitNode),
      };
    }

    // slot-guard 는 page-frame-element projection 한정(page-slot-fill 은 위에서 이미 return).
    //   명시 kind narrowing — collection row/rows kind 추가로 union 이 커져도 slotName/descendantPath
    //   접근이 page-frame-element 로 정확히 좁혀지게 한다.
    if (
      projection.kind === "page-frame-element" &&
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
