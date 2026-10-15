import { describe, expect, it } from "vitest";
import { gridTemplateOf, gridTrackCount, gridTrackTemplate } from "./gridTracks";

describe("grid track templates (Columns · Rows)", () => {
  it("a count writes tracks that share the grid size (minmax(0, 1fr)) — not 1fr, which grows to a big item", () => {
    expect(gridTemplateOf("3")).toBe("repeat(3, minmax(0, 1fr))");
    expect(gridTrackTemplate(2)).toBe("repeat(2, minmax(0, 1fr))");
    expect(gridTemplateOf("")).toBe("");
    expect(gridTemplateOf("200px 1fr")).toBe("200px 1fr");
  });

  it("reads the count of even templates; a plain 1fr one (grows to its items) stays text", () => {
    expect(gridTrackCount("repeat(3, minmax(0, 1fr))")).toBe("3");
    expect(gridTrackCount("minmax(0, 1fr) minmax(0, 1fr)")).toBe("2");
    expect(gridTrackCount("repeat(2, 1fr)")).toBeNull();
    expect(gridTrackCount("1fr 1fr 1fr")).toBeNull();
    expect(gridTrackCount("")).toBe("");
    expect(gridTrackCount("200px 1fr")).toBeNull();
    expect(gridTrackCount("repeat(2, 200px)")).toBeNull();
  });
});
