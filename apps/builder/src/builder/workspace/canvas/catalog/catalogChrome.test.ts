import { describe, expect, it, vi } from "vitest";
import { catalogSlotBand, SLOT_BAND_MAX } from "./catalogChrome";
import { createCatalogPageChrome } from "./catalogChromeSpatial";

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
const everywhere = { x: -1000, y: -1000, width: 3000, height: 3000 };
const occludersOf = (identity: string, roots: string[], lookup = parentOf) =>
  createCatalogPageChrome(roots, lookup, boundsOf).occludersOf(
    identity,
    everywhere,
  );

describe("page occluders (createCatalogPageChrome)", () => {
  it("이미 그려진 Page root이면 부모를 조회하지 않는다", () => {
    const lookup = vi.fn(parentOf);
    expect(occludersOf("home", ["home", "second", "third"], lookup)).toEqual([
      boxes.get("second"),
      boxes.get("third"),
    ]);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("gives the pages painted after a record's own page", () => {
    expect(occludersOf("row", ["home", "second", "third"])).toEqual([
      boxes.get("second"),
      boxes.get("third"),
    ]);
  });

  it("gives nothing for a record on the top page, a page body itself on top, or an undrawn page", () => {
    expect(occludersOf("row", ["second", "third", "home"])).toEqual([]);
    expect(occludersOf("home", ["second", "home"])).toEqual([]);
    expect(occludersOf("row", ["second", "third"])).toEqual([]);
  });
});

describe("catalogSlotBand", () => {
  it("keeps a slot's own height and never exceeds SLOT_BAND_MAX scene px for an empty one", () => {
    expect(catalogSlotBand(30, 0.25)).toBe(30);
    expect(catalogSlotBand(0, 0.25)).toBe(SLOT_BAND_MAX);
    expect(catalogSlotBand(0, 2)).toBe(SLOT_BAND_MAX / 2);
  });
});
