import { describe, expect, it } from "vitest";
import { catalogOccludingPages } from "./catalogChrome";

/**
 * canvas-interaction §8.5 (2026-08-12): page chrome that marks content (slot hatch, row
 * remainders, binding badges, hover outlines) is cut where a page drawn later covers its own page —
 * the ancestor clip (`hitBoundsMap`) does not know about other pages.
 */
const parents = new Map<string, string>([
  ["home", "catalog:root"],
  ["second", "catalog:root"],
  ["third", "catalog:root"],
  ["list", "home"],
  ["row", "list"],
]);
const boxes = new Map([
  ["home", { x: 0, y: 0, width: 100, height: 100 }],
  ["second", { x: 50, y: 20, width: 100, height: 100 }],
  ["third", { x: 200, y: 0, width: 100, height: 100 }],
]);
const parentOf = (id: string) => parents.get(id);
const boundsOf = (id: string) => boxes.get(id);

describe("catalogOccludingPages", () => {
  it("gives the pages painted after a record's own page", () => {
    expect(
      catalogOccludingPages(
        "row",
        parentOf,
        ["home", "second", "third"],
        boundsOf,
      ),
    ).toEqual([boxes.get("second"), boxes.get("third")]);
  });

  it("gives nothing for a record on the top page, a page body itself on top, or an undrawn page", () => {
    expect(
      catalogOccludingPages(
        "row",
        parentOf,
        ["second", "third", "home"],
        boundsOf,
      ),
    ).toEqual([]);
    expect(
      catalogOccludingPages("home", parentOf, ["second", "home"], boundsOf),
    ).toEqual([]);
    expect(
      catalogOccludingPages("row", parentOf, ["second", "third"], boundsOf),
    ).toEqual([]);
  });
});
