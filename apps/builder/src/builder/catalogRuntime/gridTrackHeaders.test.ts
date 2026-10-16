import { describe, expect, it } from "vitest";
import {
  gridCellBox,
  gridEmptyCellAt,
  gridHoverTracks,
  gridTrackFill,
  gridTrackHeaders,
  gridTrackInsertion,
  gridTrackLine,
  gridTrackResizedTo,
  gridTrackSelection,
} from "./gridTrackHeaders";
import {
  gridLinesAfterTrackMove,
  gridTrackOrderAfterMove,
} from "./gridTrackEdit";

const box = { x: 0, y: 0, width: 300, height: 100 };
const geometry = {
  columns: [
    { start: 0, size: 100, definite: true },
    { start: 110, size: 80, definite: true },
    { start: 200, size: 100, definite: true },
  ],
  rows: [{ start: 0, size: 100, definite: true }],
  columnGap: 10,
  rowGap: 0,
  frame: box,
  content: box,
  occupied: [false, false, false],
};

describe("grid track headers on the Canvas (Figma — P24)", () => {
  it("a header per listed track, at the drawn track; an implicit track or an unreadable template has none", () => {
    const headers = gridTrackHeaders(
      {
        gridTemplateColumns: "100px 80px minmax(0, 1fr)",
        gridTemplateRows: "",
      },
      geometry,
    );
    expect(
      headers.columns.map((h) => [h.index, h.start, h.size, h.track.kind]),
    ).toEqual([
      [0, 0, 100, "fixed"],
      [1, 110, 80, "fixed"],
      [2, 200, 100, "fill"],
    ]);
    expect(headers.rows).toEqual([]);
    expect(
      gridTrackHeaders(
        { gridTemplateColumns: "repeat(auto-fill, 100px)" },
        geometry,
      ).columns,
    ).toEqual([]);
  });

  it("selection: plain picks one, ⌘ toggles, ⇧ extends from the anchor", () => {
    expect(gridTrackSelection([0], 0, 2, {})).toEqual([2]);
    expect(gridTrackSelection([0], 0, 2, { toggle: true })).toEqual([0, 2]);
    expect(gridTrackSelection([0, 2], 0, 2, { toggle: true })).toEqual([0]);
    expect(gridTrackSelection([3], 3, 1, { range: true })).toEqual([1, 2, 3]);
  });

  it("a dragged track goes before the first track whose middle the pointer has not passed; the line sits in the gap", () => {
    const { columns } = gridTrackHeaders(
      { gridTemplateColumns: "100px 80px 100px" },
      geometry,
    );
    expect(gridTrackInsertion(columns, 10)).toBe(0);
    expect(gridTrackInsertion(columns, 120)).toBe(1);
    expect(gridTrackInsertion(columns, 290)).toBe(3);
    expect(gridTrackLine(columns, 0, 10)).toBe(0);
    expect(gridTrackLine(columns, 1, 10)).toBe(105);
    expect(gridTrackLine(columns, 3, 10)).toBe(300);
  });

  it("a dragged boundary makes the track before it Fixed", () => {
    const { columns } = gridTrackHeaders(
      { gridTemplateColumns: "minmax(0, 1fr) auto 1fr" },
      geometry,
    );
    expect(gridTrackResizedTo(columns, 1, 140.4)).toEqual([
      { kind: "fill", weight: 1 },
      { kind: "fixed", px: 140 },
      { kind: "fill", weight: 1 },
    ]);
  });

  it("moving tracks: the order, and a pinned item follows its start track", () => {
    // Column 3 before column 1 → [2, 0, 1]; columns 1 · 2 to the end → [2, 0, 1].
    expect(gridTrackOrderAfterMove(3, [2], 0)).toEqual([2, 0, 1]);
    expect(gridTrackOrderAfterMove(3, [0, 1], 3)).toEqual([2, 0, 1]);
    expect(gridTrackOrderAfterMove(3, [1], 1)).toEqual([0, 1, 2]);
    const order = [2, 0, 1];
    expect(gridLinesAfterTrackMove({ start: "3" }, order)).toEqual({
      start: 1,
    });
    expect(gridLinesAfterTrackMove({ start: "1" }, order)).toEqual({
      start: 2,
    });
    expect(gridLinesAfterTrackMove({}, order)).toBeUndefined();
    expect(gridLinesAfterTrackMove({ start: "2" }, [0, 1, 2])).toBeUndefined();
  });
});

describe("track delete removes what is only in it (Figma — P25)", () => {
  it("pinned or auto-placed: an item whose every track on the axis goes is deleted; a span across a kept track stays", async () => {
    const { gridItemsInRemovedTracks } = await import("./gridTrackEdit");
    // 3 columns: a pinned at (2, 1), c at (2–3, 2); b auto → (1, 1), d auto → (3, 1).
    const lines = [
      { column: "2", row: "1" },
      undefined,
      { column: "2", columnEnd: "span 2", row: "2" },
      undefined,
    ];
    expect(gridItemsInRemovedTracks(lines, 3, { column: [1] })).toEqual([0]);
    expect(gridItemsInRemovedTracks(lines, 3, { column: [1, 2] })).toEqual([
      0, 2, 3,
    ]);
    expect(gridItemsInRemovedTracks(lines, 3, { row: [1] })).toEqual([2]);
    expect(gridItemsInRemovedTracks(lines, 3, { column: [0] })).toEqual([1]);
    expect(gridItemsInRemovedTracks(lines, 3, { column: [2] })).toEqual([3]);
  });
});

describe("grid track · cell selection on the Canvas (Figma — P31)", () => {
  // 2 × 2: items take (0,0) and (1,1).
  const cells = {
    columns: [
      { start: 0, size: 100, definite: true },
      { start: 110, size: 100, definite: true },
    ],
    rows: [
      { start: 0, size: 50, definite: true },
      { start: 60, size: 50, definite: true },
    ],
    columnGap: 10,
    rowGap: 10,
    frame: { x: 0, y: 0, width: 210, height: 110 },
    occupied: [true, false, false, true],
  };

  it("a header shows for the track under the pointer — over the grid or its strip, none far away", () => {
    expect(gridHoverTracks(cells, { x: 150, y: 80 }, 24)).toEqual({
      column: 1,
      row: 1,
    });
    // The column strip above the grid: the column only.
    expect(gridHoverTracks(cells, { x: 20, y: -15 }, 24)).toEqual({
      column: 0,
    });
    // A gap goes to the nearer track.
    expect(gridHoverTracks(cells, { x: 104, y: 20 }, 24).column).toBe(0);
    expect(gridHoverTracks(cells, { x: 106, y: 20 }, 24).column).toBe(1);
    expect(gridHoverTracks(cells, { x: 20, y: -40 }, 24)).toEqual({});
    expect(gridHoverTracks(cells, { x: 400, y: 400 }, 24)).toEqual({});
  });

  it("an empty cell under the pointer — none on an item's cell, in a gap or outside", () => {
    expect(gridEmptyCellAt(cells, { x: 150, y: 20 })).toEqual({
      column: 1,
      row: 0,
    });
    expect(gridEmptyCellAt(cells, { x: 20, y: 20 })).toBeUndefined();
    expect(gridEmptyCellAt(cells, { x: 105, y: 20 })).toBeUndefined();
    expect(gridEmptyCellAt(cells, { x: 20, y: 200 })).toBeUndefined();
    expect(gridCellBox(cells, 0, 1)).toEqual({
      x: 0,
      y: 60,
      width: 100,
      height: 50,
    });
  });

  it("a selected track fills its cells no item takes", () => {
    expect(gridTrackFill(cells, "column", [0])).toEqual([
      { x: 0, y: 60, width: 100, height: 50 },
    ]);
    expect(gridTrackFill(cells, "row", [0, 1])).toEqual([
      { x: 110, y: 0, width: 100, height: 50 },
      { x: 0, y: 60, width: 100, height: 50 },
    ]);
  });
});
