import { describe, expect, it } from "vitest";
import { catalogUnionRect } from "./catalogViewport";

/** ADR-248 Phase 4e-5 zoom to selection: the fitted rect is the union of the selected boxes. */
describe("catalogUnionRect", () => {
  it("joins the boxes; missing or empty boxes fit nothing", () => {
    expect(
      catalogUnionRect([
        { x: 10, y: 20, width: 30, height: 40 },
        undefined,
        { x: 100, y: 5, width: 10, height: 10 },
      ]),
    ).toEqual({ x: 10, y: 5, width: 100, height: 55 });
    expect(catalogUnionRect([])).toBeUndefined();
    expect(catalogUnionRect([undefined])).toBeUndefined();
    expect(
      catalogUnionRect([{ x: 1, y: 1, width: 0, height: 5 }]),
    ).toBeUndefined();
  });
});
