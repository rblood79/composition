import { describe, expect, it } from "vitest";
import { calculateGridCellBounds, parseGridTemplate } from "./GridLayout.utils";

describe("calculateGridCellBounds", () => {
  it("includes the leading column and row gaps in auto-placement offsets", () => {
    const columnTracks = parseGridTemplate("100px 1fr", 300, 20);
    const rowTracks = parseGridTemplate("50px 1fr", 200, 10);

    const bounds = calculateGridCellBounds(
      undefined,
      columnTracks,
      rowTracks,
      20,
      10,
      new Map(),
      3,
    );

    expect(bounds).toMatchObject({
      x: 120,
      y: 60,
      width: 180,
      height: 140,
      column: 2,
      row: 2,
      columnSpan: 1,
      rowSpan: 1,
    });
  });
});
