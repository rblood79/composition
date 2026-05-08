import { describe, expect, it } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import { buildChildrenMapFromElements } from "./useCanvasDragDropHelpers";

function makeElement(overrides: Partial<Element>): Element {
  return {
    id: "element",
    type: "Box",
    page_id: "page-1",
    parent_id: "body",
    props: {},
    ...overrides,
  } as Element;
}

describe("buildChildrenMapFromElements", () => {
  it("derives children from the supplied canonical element order", () => {
    const first = makeElement({ id: "first", parent_id: "body" });
    const second = makeElement({ id: "second", parent_id: "body" });
    const nested = makeElement({ id: "nested", parent_id: "first" });

    const map = buildChildrenMapFromElements([first, second, nested]);

    expect(map.get("body")).toEqual([first, second]);
    expect(map.get("first")).toEqual([nested]);
  });

  it("ignores deleted elements and root nodes", () => {
    const deleted = makeElement({
      id: "deleted",
      deleted: true,
      parent_id: "body",
    });
    const root = makeElement({ id: "body", parent_id: null, type: "body" });

    const map = buildChildrenMapFromElements([deleted, root]);

    expect(map.has("body")).toBe(false);
  });
});
