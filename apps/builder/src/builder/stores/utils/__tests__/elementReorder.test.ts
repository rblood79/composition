import { describe, expect, it } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import { withFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import { computeReorderUpdates } from "../elementReorder";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    props: {},
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    ...overrides,
  } as Element;
}

describe("computeReorderUpdates", () => {
  it("excludes page-frame projection elements from page reorder updates", () => {
    const pageBody = makeElement("page-body", { type: "body" });
    const projectedFrameBody = withFrameElementMirrorId(
      makeElement("page-1::page-frame::frame-body", {
        type: "body",
        page_id: "page-1",
        order_num: 0,
      }),
      "frame-1",
    );
    const pageCard = makeElement("page-card", {
      parent_id: "page-body",
      order_num: 0,
    });

    expect(
      computeReorderUpdates([pageBody, projectedFrameBody, pageCard], "page-1"),
    ).toEqual([]);
  });

  it("still reorders persistent frame elements by layout scope", () => {
    const frameBody = withFrameElementMirrorId(
      makeElement("frame-body", {
        type: "body",
        page_id: null,
        order_num: 1,
      }),
      "frame-1",
    );
    const frameSlot = withFrameElementMirrorId(
      makeElement("frame-slot", {
        type: "Slot",
        page_id: null,
        parent_id: "frame-body",
        order_num: 0,
      }),
      "frame-1",
    );

    expect(computeReorderUpdates([frameBody, frameSlot], "frame-1")).toEqual([
      { id: "frame-body", order_num: 0 },
    ]);
  });

  it("does not use mutable label text as a tie-breaker when repairing duplicate collection order", () => {
    const listbox = makeElement("listbox", {
      type: "ListBox",
      order_num: 0,
    });
    const firstItem = makeElement("item-b", {
      type: "ListBoxItem",
      parent_id: "listbox",
      order_num: 0,
      props: { children: "Beta" },
    });
    const secondItem = makeElement("item-a", {
      type: "ListBoxItem",
      parent_id: "listbox",
      order_num: 0,
      props: { children: "Alpha" },
    });

    const beforeTextChange = computeReorderUpdates(
      [listbox, firstItem, secondItem],
      "page-1",
    );
    const afterTextChange = computeReorderUpdates(
      [
        listbox,
        { ...firstItem, props: { children: "Aardvark" } },
        { ...secondItem, props: { children: "Zulu" } },
      ],
      "page-1",
    );

    expect(beforeTextChange).toEqual([{ id: "item-a", order_num: 1 }]);
    expect(afterTextChange).toEqual(beforeTextChange);
  });
});
