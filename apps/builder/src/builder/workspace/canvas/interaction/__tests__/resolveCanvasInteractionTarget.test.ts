// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { CanvasInteractionNode } from "../interactionNode";
import { resolveCanvasInteractionTarget } from "../resolveCanvasInteractionTarget";

function makeNode(
  id: string,
  overrides: Partial<CanvasInteractionNode> = {},
): CanvasInteractionNode {
  return {
    id,
    type: "Box",
    props: {},
    parent_id: null,
    page_id: "page-1",
    deleted: false,
    ...overrides,
  };
}

describe("resolveCanvasInteractionTarget", () => {
  it("maps projected page slot fill hits back to the canonical element id", () => {
    const slot = makeNode("page-1::page-frame::slot-content", {
      type: "Slot",
      projection: {
        kind: "page-frame-element",
        pageId: "page-1",
        sourceElementId: "slot-content",
        renderElementId: "page-1::page-frame::slot-content",
        renderParentId: "page-1-body",
        canonicalParentId: "frame-body",
        slotName: "content",
        descendantPath: "frame-body/slot-content",
      },
    });
    const fill = makeNode("page-card", {
      parent_id: slot.id,
      projection: {
        kind: "page-slot-fill",
        pageId: "page-1",
        sourceElementId: "page-card",
        renderElementId: "page-card",
        renderParentId: slot.id,
        canonicalParentId: "page-body",
        slotName: "content",
        descendantPath: "frame-body/slot-content",
      },
    });

    expect(
      resolveCanvasInteractionTarget({
        candidateIds: [slot.id, fill.id],
        elementsMap: new Map([
          [slot.id, slot],
          [fill.id, fill],
        ]),
        childrenMap: new Map([[slot.id, [fill]]]),
      }),
    ).toEqual({
      kind: "select",
      elementId: "page-card",
      pageId: "page-1",
    });
  });

  it("returns a slot guard target for projected Slot chrome", () => {
    const slot = makeNode("page-1::page-frame::slot-header", {
      type: "Slot",
      projection: {
        kind: "page-frame-element",
        pageId: "page-1",
        sourceElementId: "slot-header",
        renderElementId: "page-1::page-frame::slot-header",
        renderParentId: "page-1-body",
        canonicalParentId: "frame-body",
        slotName: "header",
        descendantPath: "frame-body/slot-header",
      },
    });

    expect(
      resolveCanvasInteractionTarget({
        candidateIds: [slot.id],
        elementsMap: new Map([[slot.id, slot]]),
        childrenMap: new Map(),
      }),
    ).toEqual({
      kind: "slot-guard",
      renderSlotId: slot.id,
      pageId: "page-1",
      slotName: "header",
      descendantPath: "frame-body/slot-header",
    });
  });

  it("does not return synthetic render IDs as selectable element IDs", () => {
    const projected = makeNode("page-1::page-frame::plain", {
      projection: {
        kind: "page-frame-element",
        pageId: "page-1",
        sourceElementId: "plain",
        renderElementId: "page-1::page-frame::plain",
        renderParentId: "page-1-body",
        canonicalParentId: "frame-body",
      },
    });

    expect(
      resolveCanvasInteractionTarget({
        candidateIds: [projected.id],
        elementsMap: new Map([[projected.id, projected]]),
        childrenMap: new Map(),
      }),
    ).toEqual({ kind: "none" });
  });

  // 버그 수정: listbox 행/그룹 projection 클릭 → ListBox 컴포넌트 선택.
  //   template anchor 는 suppressedAnchorId 로 scene/interaction map 에서 제외(canonical ref,
  //   비-scene)되어 선택 대상이 될 수 없다 → 과거 templateAnchorId 반환은 no-op(선택 실패)였다.
  //   행 layout 편집은 origin ListBoxItem(Components page) 편집 → projection 행 style 전파 경로 사용.
  it("selects the ListBox component when a listbox-row projection is clicked", () => {
    const row = makeNode("projection:listbox-row:listbox-1:row-1", {
      type: "ListBoxItem",
      projection: {
        kind: "listbox-row",
        listBoxId: "listbox-1",
        itemKey: "row-1",
        rowIndex: 0,
        templateAnchorId: "anchor-1",
        templateOriginId: "origin-1",
      },
    });

    expect(
      resolveCanvasInteractionTarget({
        candidateIds: [row.id],
        elementsMap: new Map([[row.id, row]]),
        childrenMap: new Map(),
      }),
    ).toEqual({ kind: "select", elementId: "listbox-1", pageId: "page-1" });
  });

  it("selects the ListBox component when a listbox-rows group projection is clicked", () => {
    const group = makeNode("projection:listbox-rows:listbox-1", {
      type: "Rows",
      projection: {
        kind: "listbox-rows",
        listBoxId: "listbox-1",
        templateAnchorId: "anchor-1",
        templateOriginId: "origin-1",
      },
    });

    expect(
      resolveCanvasInteractionTarget({
        candidateIds: [group.id],
        elementsMap: new Map([[group.id, group]]),
        childrenMap: new Map(),
      }),
    ).toEqual({ kind: "select", elementId: "listbox-1", pageId: "page-1" });
  });

  it("selects the ListBox when no template anchor exists", () => {
    const row = makeNode("projection:listbox-row:listbox-1:row-1", {
      type: "ListBoxItem",
      projection: {
        kind: "listbox-row",
        listBoxId: "listbox-1",
        itemKey: "row-1",
        rowIndex: 0,
        templateAnchorId: null,
        templateOriginId: null,
      },
    });

    expect(
      resolveCanvasInteractionTarget({
        candidateIds: [row.id],
        elementsMap: new Map([[row.id, row]]),
        childrenMap: new Map(),
      }),
    ).toEqual({ kind: "select", elementId: "listbox-1", pageId: "page-1" });
  });
});
