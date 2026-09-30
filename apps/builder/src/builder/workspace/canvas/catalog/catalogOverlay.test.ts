import { describe, expect, it } from "vitest";
import type { CatalogSelectionItem } from "../../../catalogRuntime/session";
import { catalogMeasureGuides, catalogSelectionBox } from "./catalogOverlay";

/** ADR-248 Phase 4e: the multi-selection box and Alt-measure of the Canvas overlay. */
const item = (identity: string) =>
  ({ identity }) as unknown as CatalogSelectionItem;
const bounds = new Map([
  ["a", { x: 0, y: 0, width: 10, height: 10 }],
  ["b", { x: 30, y: 20, width: 10, height: 10 }],
  ["c", { x: 60, y: 0, width: 10, height: 10 }],
]);

describe("catalogSelectionBox", () => {
  it("spans every selected box; nothing drawn selects no box", () => {
    expect(
      catalogSelectionBox({ selection: [item("a"), item("b")] }, bounds),
    ).toEqual({ x: 0, y: 0, width: 40, height: 30 });
    expect(catalogSelectionBox({ selection: [item("a")] }, bounds)).toEqual(
      bounds.get("a"),
    );
    expect(catalogSelectionBox({ selection: [item("x")] }, bounds)).toBeNull();
  });
});

describe("catalogMeasureGuides", () => {
  const hover = { identity: "c" } as never;
  it("measures from the selection's box to the hovered record while Alt is held", () => {
    const guides = catalogMeasureGuides(
      { selection: [item("a"), item("b")], hover },
      bounds,
      true,
    );
    expect(guides).toEqual([
      expect.objectContaining({ axis: "x", start: 40, end: 60, value: 20 }),
    ]);
  });
  it("shows nothing without Alt, a selection, or with the hovered record selected", () => {
    const state = { selection: [item("a")], hover };
    expect(catalogMeasureGuides(state, bounds, false)).toEqual([]);
    expect(
      catalogMeasureGuides({ selection: [], hover }, bounds, true),
    ).toEqual([]);
    expect(
      catalogMeasureGuides(
        { selection: [item("a"), item("c")], hover },
        bounds,
        true,
      ),
    ).toEqual([]);
  });
});
