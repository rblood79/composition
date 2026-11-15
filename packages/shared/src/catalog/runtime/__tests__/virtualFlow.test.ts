import { describe, expect, it } from "vitest";
import { catalogVirtualFlow } from "../virtualFlow";

/**
 * ADR-310 Phase 8 — a virtual list's `ListLayout` direction is its drawn flow (the S2 lists have no
 * `orientation`): one line of stretched items, or refused.
 */
describe("ADR-310 Phase 8 — catalogVirtualFlow", () => {
  it("a block list · a flex column · a one-column grid are vertical; a flex row horizontal", () => {
    expect(catalogVirtualFlow({ display: "block" })).toEqual({ orientation: "vertical" });
    expect(catalogVirtualFlow({ display: "contents" })).toEqual({ orientation: "vertical" });
    expect(
      catalogVirtualFlow({ display: "flex", flexDirection: "column" }),
    ).toEqual({ orientation: "vertical" });
    // (GridList `stack` — one `minmax(0, 1fr)` column.)
    expect(
      catalogVirtualFlow({ display: "grid", gridTemplateColumns: ["minmax(0, 1fr)"] }),
    ).toEqual({ orientation: "vertical" });
    expect(catalogVirtualFlow({ display: "flex", flexDirection: "row" })).toEqual({
      orientation: "horizontal",
    });
    // (CSS's default flex direction is a row.)
    expect(catalogVirtualFlow({ display: "flex" })).toEqual({ orientation: "horizontal" });
  });

  it("a wrapping · reversed flex, items off the stretch, a many-column grid are refused", () => {
    for (const style of [
      { display: "flex", flexDirection: "row", flexWrap: "wrap" },
      { display: "flex", flexDirection: "column-reverse" },
      { display: "flex", flexDirection: "column", alignItems: "center" },
      { display: "grid", gridTemplateColumns: ["1fr", "1fr"] },
      { display: "grid", gridTemplateColumns: ["1fr"], gridAutoFlow: "column" },
      { display: "grid", gridTemplateColumns: ["1fr"], justifyItems: "start" },
      { display: "inline" },
    ])
      expect(catalogVirtualFlow(style)).toEqual({ refused: "flow" });
  });
});
