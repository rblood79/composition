import { describe, expect, it } from "vitest";
import { ElementUtils } from "./elementUtils";
import type { Element } from "../../types/core/store.types";

function element(
  id: string,
  parent_id: string | null,
  overrides: Partial<Element> = {},
): Element {
  return {
    id,
    type: "div",
    page_id: "page-1",
    parent_id,
    props: {},
    order_num: 0,
    created_at: "2026-05-15T00:00:00.000Z",
    updated_at: "2026-05-15T00:00:00.000Z",
    ...overrides,
  } as Element;
}

describe("ElementUtils hierarchy helpers", () => {
  it("returns descendants in depth-first order without repeated tree scans", () => {
    const elements = [
      element("root", null),
      element("a", "root"),
      element("b", "root"),
      element("a-1", "a"),
      element("b-1", "b"),
    ];

    expect(
      ElementUtils.getDescendants(elements, "root").map((el) => el.id),
    ).toEqual(["a", "a-1", "b", "b-1"]);
  });

  it("checks ancestry and element paths through an indexed lookup", () => {
    const elements = [
      element("root", null),
      element("section", "root"),
      element("button", "section"),
    ];

    expect(ElementUtils.isAncestor(elements, "root", "button")).toBe(true);
    expect(ElementUtils.isAncestor(elements, "button", "root")).toBe(false);
    expect(
      ElementUtils.getElementPath(elements, "button").map((el) => el.id),
    ).toEqual(["root", "section", "button"]);
  });

  it("migrates orphan elements with a single replacement map", () => {
    const elements = [
      element("body", null, { type: "body" }),
      element("orphan", null),
      element("nested", "body"),
    ];

    const result = ElementUtils.migrateOrphanElementsToBody(elements, "page-1");

    expect(result.updatedElements.map((el) => el.id)).toEqual(["orphan"]);
    expect(result.elements.find((el) => el.id === "orphan")?.parent_id).toBe(
      "body",
    );
  });
});
