import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Element } from "../../../../types/builder/unified.types";
import type { ElementBounds } from "../elementRegistry";
import {
  computeDropPlaceholderBounds,
  computeInsertionLinePosition,
  computeReorderFromDropTarget,
  computeSiblingOffsets,
  resolveDropTarget,
} from "./dropTargetResolver";

const mockBounds = vi.hoisted(() => new Map<string, ElementBounds>());

vi.mock("../skia/renderCommands", () => ({
  getSceneBounds: (id: string) => mockBounds.get(id),
}));

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Box",
    page_id: "page-1",
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    ...overrides,
  } as Element;
}

describe("resolveDropTarget cross-page body targets", () => {
  beforeEach(() => {
    mockBounds.clear();
  });

  it("treats another page body as a valid drop container", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
    });
    const source = makeElement("source-card", {
      parent_id: page1Body.id,
      order_num: 0,
    });

    mockBounds.set(page1Body.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(source.id, { x: 40, y: 40, width: 160, height: 120 });
    mockBounds.set(page2Body.id, { x: 900, y: 0, width: 800, height: 600 });

    const result = resolveDropTarget(
      { x: 940, y: 80 },
      source.id,
      {
        childrenMap: new Map([[page1Body.id, [source]]]),
        elementsMap: new Map([
          [page1Body.id, page1Body],
          [page2Body.id, page2Body],
          [source.id, source],
        ]),
      },
      () => [page2Body.id],
    );

    expect(result).toMatchObject({
      containerId: page2Body.id,
      insertionIndex: 0,
      isAdjacentInsertion: false,
      isReparent: true,
      originalParentId: page1Body.id,
    });
  });

  it("places end insertion line after the full gap after the last child, not halfway down the page", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
      props: {
        style: {
          gap: 16,
          padding: 24,
        },
      },
    });
    const source = makeElement("source-button", {
      type: "Button",
      parent_id: page1Body.id,
      order_num: 0,
    });
    const cardInstance = {
      ...makeElement("card-instance", {
        type: "ref",
        page_id: "page-2",
        parent_id: page2Body.id,
        order_num: 0,
      }),
      ref: "card-origin",
    } as Element;

    mockBounds.set(page1Body.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(source.id, { x: 40, y: 40, width: 120, height: 40 });
    mockBounds.set(page2Body.id, { x: 900, y: 0, width: 800, height: 1000 });
    mockBounds.set(cardInstance.id, { x: 924, y: 24, width: 360, height: 305 });

    const store = {
      childrenMap: new Map([
        [page1Body.id, [source]],
        [page2Body.id, [cardInstance]],
      ]),
      elementsMap: new Map([
        [page1Body.id, page1Body],
        [page2Body.id, page2Body],
        [source.id, source],
        [cardInstance.id, cardInstance],
      ]),
    };

    const result = resolveDropTarget(
      { x: 950, y: 360 },
      source.id,
      store,
      () => [cardInstance.id, page2Body.id],
    );

    expect(result).toMatchObject({
      containerId: page2Body.id,
      insertionIndex: 1,
      isReparent: true,
    });
    expect(
      result ? computeInsertionLinePosition(result, source.id, store) : null,
    ).toBe(345);
  });

  it("places middle insertion line after the full gap from the previous child", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
      props: {
        style: {
          gap: 16,
        },
      },
    });
    const source = makeElement("source-button", {
      type: "Button",
      parent_id: page1Body.id,
      order_num: 0,
    });
    const firstCard = makeElement("first-card", {
      type: "Card",
      page_id: "page-2",
      parent_id: page2Body.id,
      order_num: 0,
    });
    const secondCard = makeElement("second-card", {
      type: "Card",
      page_id: "page-2",
      parent_id: page2Body.id,
      order_num: 1,
    });

    mockBounds.set(page1Body.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(source.id, { x: 40, y: 40, width: 120, height: 40 });
    mockBounds.set(page2Body.id, { x: 900, y: 0, width: 800, height: 1000 });
    mockBounds.set(firstCard.id, { x: 924, y: 24, width: 360, height: 100 });
    mockBounds.set(secondCard.id, { x: 924, y: 140, width: 360, height: 100 });

    const store = {
      childrenMap: new Map([
        [page1Body.id, [source]],
        [page2Body.id, [firstCard, secondCard]],
      ]),
      elementsMap: new Map([
        [page1Body.id, page1Body],
        [page2Body.id, page2Body],
        [source.id, source],
        [firstCard.id, firstCard],
        [secondCard.id, secondCard],
      ]),
    };

    const result = resolveDropTarget(
      { x: 950, y: 130 },
      source.id,
      store,
      () => [page2Body.id],
    );

    expect(result).toMatchObject({
      containerId: page2Body.id,
      insertionIndex: 1,
      isReparent: true,
    });
    expect(
      result ? computeInsertionLinePosition(result, source.id, store) : null,
    ).toBe(140);
  });

  it("places empty-container insertion line at content start padding", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
      props: {
        style: {
          paddingTop: 32,
        },
      },
    });
    const source = makeElement("source-button", {
      type: "Button",
      parent_id: page1Body.id,
      order_num: 0,
    });

    mockBounds.set(page1Body.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(source.id, { x: 40, y: 40, width: 120, height: 40 });
    mockBounds.set(page2Body.id, { x: 900, y: 0, width: 800, height: 1000 });

    const store = {
      childrenMap: new Map([[page1Body.id, [source]]]),
      elementsMap: new Map([
        [page1Body.id, page1Body],
        [page2Body.id, page2Body],
        [source.id, source],
      ]),
    };

    const result = resolveDropTarget(
      { x: 950, y: 120 },
      source.id,
      store,
      () => [page2Body.id],
    );

    expect(result).toMatchObject({
      containerId: page2Body.id,
      insertionIndex: 0,
      isReparent: true,
    });
    expect(
      result ? computeInsertionLinePosition(result, source.id, store) : null,
    ).toBe(32);
  });

  it("rejects ordinary instance descendants but keeps explicit slot hosts droppable", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
    });
    const source = makeElement("source-button", {
      type: "Button",
      parent_id: page1Body.id,
      order_num: 0,
    });
    const instance = {
      ...makeElement("card-instance", {
        type: "ref",
        page_id: "page-2",
        parent_id: page2Body.id,
        order_num: 0,
      }),
      ref: "card-origin",
    } as Element;
    const ordinaryDescendant = makeElement("card-instance/content", {
      type: "CardContent",
      page_id: "page-2",
      parent_id: instance.id,
      order_num: 0,
    });
    const slotDescendant = makeElement("card-instance/slot", {
      type: "CardContent",
      page_id: "page-2",
      parent_id: instance.id,
      order_num: 1,
      slot: [],
    });

    mockBounds.set(page1Body.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(source.id, { x: 40, y: 40, width: 120, height: 40 });
    mockBounds.set(page2Body.id, { x: 900, y: 0, width: 800, height: 1000 });
    mockBounds.set(instance.id, { x: 920, y: 20, width: 360, height: 360 });
    mockBounds.set(ordinaryDescendant.id, {
      x: 936,
      y: 80,
      width: 328,
      height: 120,
    });
    mockBounds.set(slotDescendant.id, {
      x: 936,
      y: 220,
      width: 328,
      height: 120,
    });

    const store = {
      childrenMap: new Map([
        [page1Body.id, [source]],
        [page2Body.id, [instance]],
        [instance.id, [ordinaryDescendant, slotDescendant]],
      ]),
      elementsMap: new Map([
        [page1Body.id, page1Body],
        [page2Body.id, page2Body],
        [source.id, source],
        [instance.id, instance],
        [ordinaryDescendant.id, ordinaryDescendant],
        [slotDescendant.id, slotDescendant],
      ]),
    };

    const ordinaryResult = resolveDropTarget(
      { x: 950, y: 120 },
      source.id,
      store,
      () => [ordinaryDescendant.id, instance.id, page2Body.id],
    );
    expect(ordinaryResult).toMatchObject({
      containerId: page2Body.id,
      isReparent: true,
    });

    const slotResult = resolveDropTarget(
      { x: 950, y: 260 },
      source.id,
      store,
      () => [slotDescendant.id, instance.id, page2Body.id],
    );
    expect(slotResult).toMatchObject({
      containerId: slotDescendant.id,
      isReparent: true,
    });
  });

  it("keeps same-parent body hits on the reorder path", () => {
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
    });
    const source = makeElement("source-card", {
      parent_id: pageBody.id,
      order_num: 0,
    });
    const sibling = makeElement("sibling-card", {
      parent_id: pageBody.id,
      order_num: 1,
    });

    mockBounds.set(pageBody.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(source.id, { x: 40, y: 40, width: 160, height: 120 });
    mockBounds.set(sibling.id, { x: 40, y: 200, width: 160, height: 120 });

    const result = resolveDropTarget(
      { x: 80, y: 260 },
      source.id,
      {
        childrenMap: new Map([[pageBody.id, [source, sibling]]]),
        elementsMap: new Map([
          [pageBody.id, pageBody],
          [source.id, source],
          [sibling.id, sibling],
        ]),
      },
      () => [pageBody.id],
    );

    expect(result).toMatchObject({
      containerId: pageBody.id,
      isReparent: false,
    });
  });

  it("keeps current group reorder ahead of ancestor body reparent while the pointer is inside the group", () => {
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
    });
    const group = makeElement("group", {
      type: "Frame",
      parent_id: pageBody.id,
      order_num: 0,
    });
    const source = makeElement("source-card", {
      parent_id: group.id,
      order_num: 0,
    });
    const sibling = makeElement("sibling-card", {
      parent_id: group.id,
      order_num: 1,
    });

    mockBounds.set(pageBody.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(group.id, { x: 40, y: 40, width: 360, height: 360 });
    mockBounds.set(source.id, { x: 64, y: 64, width: 160, height: 120 });
    mockBounds.set(sibling.id, { x: 64, y: 220, width: 160, height: 120 });

    const result = resolveDropTarget(
      { x: 80, y: 80 },
      source.id,
      {
        childrenMap: new Map([
          [pageBody.id, [group]],
          [group.id, [source, sibling]],
        ]),
        elementsMap: new Map([
          [pageBody.id, pageBody],
          [group.id, group],
          [source.id, source],
          [sibling.id, sibling],
        ]),
      },
      () => [source.id, group.id, pageBody.id],
    );

    expect(result).toMatchObject({
      containerId: group.id,
      insertionIndex: 0,
      isAdjacentInsertion: true,
      isReparent: false,
    });
  });

  it("includes column gap when same-parent reorder closes the old slot", () => {
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
      props: {
        style: {
          gap: 16,
        },
      },
    });
    const first = makeElement("first-card", {
      parent_id: pageBody.id,
      order_num: 0,
    });
    const source = makeElement("source-button", {
      type: "Button",
      parent_id: pageBody.id,
      order_num: 1,
    });
    const last = makeElement("last-card", {
      parent_id: pageBody.id,
      order_num: 2,
    });

    mockBounds.set(pageBody.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(first.id, { x: 40, y: 0, width: 160, height: 100 });
    mockBounds.set(source.id, { x: 40, y: 116, width: 120, height: 40 });
    mockBounds.set(last.id, { x: 40, y: 172, width: 160, height: 100 });

    const store = {
      childrenMap: new Map([[pageBody.id, [first, source, last]]]),
      elementsMap: new Map([
        [pageBody.id, pageBody],
        [first.id, first],
        [source.id, source],
        [last.id, last],
      ]),
    };

    const result = resolveDropTarget(
      { x: 80, y: 300 },
      source.id,
      store,
      () => [pageBody.id],
    );

    expect(result).toMatchObject({
      containerId: pageBody.id,
      insertionIndex: 2,
      isHorizontal: false,
      isReparent: false,
    });
    expect(
      result ? computeSiblingOffsets(result, source.id, store) : null,
    ).toEqual(new Map([[last.id, { dx: 0, dy: -56 }]]));
    expect(
      result ? computeInsertionLinePosition(result, source.id, store) : null,
    ).toBe(232);
  });

  it("includes row gap when same-parent reorder closes the old slot", () => {
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
      props: {
        style: {
          flexDirection: "row",
          gap: 16,
        },
      },
    });
    const first = makeElement("first-card", {
      parent_id: pageBody.id,
      order_num: 0,
    });
    const source = makeElement("source-button", {
      type: "Button",
      parent_id: pageBody.id,
      order_num: 1,
    });
    const last = makeElement("last-card", {
      parent_id: pageBody.id,
      order_num: 2,
    });

    mockBounds.set(pageBody.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(first.id, { x: 0, y: 40, width: 100, height: 160 });
    mockBounds.set(source.id, { x: 116, y: 40, width: 40, height: 120 });
    mockBounds.set(last.id, { x: 172, y: 40, width: 100, height: 160 });

    const store = {
      childrenMap: new Map([[pageBody.id, [first, source, last]]]),
      elementsMap: new Map([
        [pageBody.id, pageBody],
        [first.id, first],
        [source.id, source],
        [last.id, last],
      ]),
    };

    const result = resolveDropTarget(
      { x: 300, y: 80 },
      source.id,
      store,
      () => [pageBody.id],
    );

    expect(result).toMatchObject({
      containerId: pageBody.id,
      insertionIndex: 2,
      isHorizontal: true,
      isReparent: false,
    });
    expect(
      result ? computeSiblingOffsets(result, source.id, store) : null,
    ).toEqual(new Map([[last.id, { dx: -56, dy: 0 }]]));
    expect(
      result ? computeInsertionLinePosition(result, source.id, store) : null,
    ).toBe(232);
  });

  it("uses justify-content: space-between when projecting same-parent reorder feedback", () => {
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
      props: {
        style: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
      },
    });
    const first = makeElement("first-card", {
      parent_id: pageBody.id,
      order_num: 0,
    });
    const source = makeElement("source-button", {
      type: "Button",
      parent_id: pageBody.id,
      order_num: 1,
    });
    const third = makeElement("third-card", {
      parent_id: pageBody.id,
      order_num: 2,
    });
    const last = makeElement("last-card", {
      parent_id: pageBody.id,
      order_num: 3,
    });

    mockBounds.set(pageBody.id, { x: 0, y: 0, width: 500, height: 200 });
    mockBounds.set(first.id, { x: 0, y: 80, width: 50, height: 40 });
    mockBounds.set(source.id, { x: 150, y: 70, width: 50, height: 60 });
    mockBounds.set(third.id, { x: 300, y: 80, width: 50, height: 40 });
    mockBounds.set(last.id, { x: 450, y: 80, width: 50, height: 40 });

    const store = {
      childrenMap: new Map([[pageBody.id, [first, source, third, last]]]),
      elementsMap: new Map([
        [pageBody.id, pageBody],
        [first.id, first],
        [source.id, source],
        [third.id, third],
        [last.id, last],
      ]),
    };

    const result = resolveDropTarget(
      { x: 330, y: 100 },
      source.id,
      store,
      () => [pageBody.id],
    );

    expect(result).toMatchObject({
      containerId: pageBody.id,
      insertionIndex: 2,
      isHorizontal: true,
      isReparent: false,
    });
    expect(
      result ? computeSiblingOffsets(result, source.id, store) : null,
    ).toEqual(new Map([[third.id, { dx: -150, dy: 0 }]]));
    expect(
      result ? computeInsertionLinePosition(result, source.id, store) : null,
    ).toBe(300);
    expect(
      result ? computeDropPlaceholderBounds(result, source.id, store) : null,
    ).toEqual({ x: 300, y: 70, width: 50, height: 60 });
  });

  it("uses justify-content and align-items for empty flex reparent placeholder", () => {
    const sourceBody = makeElement("source-body", {
      type: "body",
      page_id: "page-1",
    });
    const targetBody = makeElement("target-body", {
      type: "body",
      page_id: "page-2",
      props: {
        style: {
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        },
      },
    });
    const source = makeElement("source-button", {
      type: "Button",
      parent_id: sourceBody.id,
      order_num: 0,
    });

    mockBounds.set(sourceBody.id, { x: 0, y: 0, width: 300, height: 200 });
    mockBounds.set(targetBody.id, { x: 100, y: 20, width: 500, height: 200 });
    mockBounds.set(source.id, { x: 20, y: 20, width: 50, height: 40 });

    const store = {
      childrenMap: new Map([[sourceBody.id, [source]]]),
      elementsMap: new Map([
        [sourceBody.id, sourceBody],
        [targetBody.id, targetBody],
        [source.id, source],
      ]),
    };

    const result = resolveDropTarget(
      { x: 350, y: 100 },
      source.id,
      store,
      () => [targetBody.id],
    );

    expect(result).toMatchObject({
      containerId: targetBody.id,
      insertionIndex: 0,
      isHorizontal: true,
      isReparent: true,
    });
    expect(
      result ? computeInsertionLinePosition(result, source.id, store) : null,
    ).toBe(325);
    expect(
      result ? computeDropPlaceholderBounds(result, source.id, store) : null,
    ).toEqual({ x: 325, y: 100, width: 50, height: 40 });
  });

  it("keeps same-parent insertion while the cursor is inside the opened placeholder slot", () => {
    const pageBody = makeElement("page-body", {
      type: "body",
      page_id: "page-1",
      props: {
        style: {
          gap: 16,
        },
      },
    });
    const first = makeElement("first-card", {
      parent_id: pageBody.id,
      order_num: 0,
    });
    const middle = makeElement("middle-button", {
      type: "Button",
      parent_id: pageBody.id,
      order_num: 1,
    });
    const source = makeElement("source-card", {
      parent_id: pageBody.id,
      order_num: 2,
    });

    mockBounds.set(pageBody.id, { x: 0, y: 0, width: 800, height: 600 });
    mockBounds.set(first.id, { x: 40, y: 0, width: 160, height: 100 });
    mockBounds.set(middle.id, { x: 40, y: 116, width: 120, height: 40 });
    mockBounds.set(source.id, { x: 40, y: 172, width: 160, height: 100 });

    const store = {
      childrenMap: new Map([[pageBody.id, [first, middle, source]]]),
      elementsMap: new Map([
        [pageBody.id, pageBody],
        [first.id, first],
        [middle.id, middle],
        [source.id, source],
      ]),
    };

    const result = resolveDropTarget(
      { x: 80, y: 180 },
      source.id,
      store,
      () => [pageBody.id],
    );

    expect(result).toMatchObject({
      containerId: pageBody.id,
      insertionIndex: 1,
      isAdjacentInsertion: false,
      isReparent: false,
    });
    expect(
      result ? computeDropPlaceholderBounds(result, source.id, store) : null,
    ).toEqual({ x: 40, y: 116, width: 160, height: 100 });
    expect(
      result ? computeReorderFromDropTarget(result, source.id, store) : null,
    ).toEqual([{ id: first.id }, { id: source.id }, { id: middle.id }]);
  });

  it("uses childrenMap source order even when input metadata order differs", () => {
    const body = makeElement("body", { type: "body" });
    const first = makeElement("first", { parent_id: body.id, order_num: 2 });
    const middle = makeElement("middle", { parent_id: body.id, order_num: 0 });
    const source = makeElement("source", { parent_id: body.id, order_num: 1 });
    const store = {
      childrenMap: new Map([[body.id, [first, middle, source]]]),
      elementsMap: new Map([
        [body.id, body],
        [first.id, first],
        [middle.id, middle],
        [source.id, source],
      ]),
    };

    const updates = computeReorderFromDropTarget(
      {
        containerId: body.id,
        insertionIndex: 1,
        isAdjacentInsertion: false,
        isHorizontal: false,
        containerBounds: { x: 0, y: 0, width: 300, height: 300 },
        siblingBounds: [],
        isReparent: false,
      },
      source.id,
      store,
    );

    expect(updates).toEqual([
      { id: first.id },
      { id: source.id },
      { id: middle.id },
    ]);
  });
});
