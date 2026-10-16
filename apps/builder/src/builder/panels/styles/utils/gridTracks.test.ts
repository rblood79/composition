import { describe, expect, it } from "vitest";
import {
  gridTemplateOf,
  gridTrackList,
  gridTrackListResized,
  gridTrackListTemplate,
  gridTrackOfValue,
  gridTrackTemplate,
  gridTrackValue,
} from "./gridTracks";

describe("grid track templates (Columns · Rows)", () => {
  it("a count writes tracks that share the grid size (minmax(0, 1fr)) — not 1fr, which grows to a big item", () => {
    expect(gridTemplateOf("3")).toBe("repeat(3, minmax(0, 1fr))");
    expect(gridTrackTemplate(2)).toBe("repeat(2, minmax(0, 1fr))");
    expect(gridTemplateOf("")).toBe("");
    expect(gridTemplateOf("200px 1fr")).toBe("200px 1fr");
  });
});

describe("grid track list (Figma — each column · row Fixed / Fill / Hug)", () => {
  it("reads Fixed · Fill (weight) · Hug tracks, repeat expanded; other templates stay text", () => {
    expect(gridTrackList("repeat(2, minmax(0, 1fr))")).toEqual([
      { kind: "fill", weight: 1 },
      { kind: "fill", weight: 1 },
    ]);
    expect(gridTrackList("120px minmax(0, 2fr) auto 1fr")).toEqual([
      { kind: "fixed", px: 120 },
      { kind: "fill", weight: 2 },
      { kind: "hug" },
      { kind: "fill", weight: 1 },
    ]);
    expect(gridTrackList("")).toEqual([]);
    expect(gridTrackList("50% 1fr")).toBeNull();
    expect(gridTrackList("repeat(auto-fill, minmax(100px, 1fr))")).toBeNull();
    expect(gridTrackList("minmax(100px, 1fr)")).toBeNull();
  });

  it("writes a list back — even Fill tracks as repeat, others token by token", () => {
    expect(
      gridTrackListTemplate([
        { kind: "fill", weight: 1 },
        { kind: "fill", weight: 1 },
        { kind: "fill", weight: 1 },
      ]),
    ).toBe("repeat(3, minmax(0, 1fr))");
    expect(
      gridTrackListTemplate([
        { kind: "fixed", px: 120 },
        { kind: "fill", weight: 2 },
        { kind: "hug" },
      ]),
    ).toBe("120px minmax(0, 2fr) auto");
    expect(gridTrackListTemplate([])).toBe("");
  });

  it("a field value ↔ a track (px · fr weight · fit-content = Hug); a count edit keeps the sized tracks", () => {
    expect(gridTrackValue({ kind: "fixed", px: 120 })).toBe("120px");
    expect(gridTrackValue({ kind: "fill", weight: 2 })).toBe("2fr");
    expect(gridTrackValue({ kind: "hug" })).toBe("fit-content");
    expect(gridTrackOfValue("80px")).toEqual({ kind: "fixed", px: 80 });
    expect(gridTrackOfValue("3fr")).toEqual({ kind: "fill", weight: 3 });
    expect(gridTrackOfValue("fit-content")).toEqual({ kind: "hug" });
    expect(gridTrackOfValue("0px")).toBeNull();
    expect(gridTrackOfValue("50%")).toBeNull();
    expect(
      gridTrackListResized([{ kind: "fixed", px: 120 }, { kind: "hug" }], 3),
    ).toEqual([
      { kind: "fixed", px: 120 },
      { kind: "hug" },
      { kind: "fill", weight: 1 },
    ]);
    expect(
      gridTrackListResized([{ kind: "fixed", px: 120 }, { kind: "hug" }], 1),
    ).toEqual([{ kind: "fixed", px: 120 }]);
  });
});
