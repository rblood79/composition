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
    ).toEqual([
      { id: source.id, order_num: 1 },
      { id: middle.id, order_num: 2 },
    ]);
  });
});
