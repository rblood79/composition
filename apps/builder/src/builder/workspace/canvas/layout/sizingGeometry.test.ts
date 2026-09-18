import { describe, it, expect } from "vitest";
import { publishSizingGeometry, readSizingGeometry } from "./sizingGeometry";
describe("ADR-224 geometry freshness", () => {
  it("rejects stale revisions, layout versions, viewport or tier", () => {
    const expected = {
      projectId: "p",
      documentVersion: 1,
      layoutVersion: 2,
      activeBreakpoint: "desktop" as const,
      viewport: { width: 900, height: 600 },
    };
    publishSizingGeometry({
      ...expected,
      breakpoint: "desktop",
      rootKey: "page",
      layout: new Map([
        ["a", { elementId: "a", x: 1, y: 2, width: 100, height: 50 }],
      ]),
    });
    expect(readSizingGeometry("a", "desktop", expected)?.width).toBe(100);
    expect(readSizingGeometry("a", "tablet", expected)).toBeNull();
    for (const stale of [
      { documentVersion: 2 },
      { layoutVersion: 3 },
      { projectId: "other" },
      { viewport: { width: 500, height: 600 } },
    ]) {
      expect(
        readSizingGeometry("a", "desktop", { ...expected, ...stale }),
      ).toBeNull();
    }
  });
});
