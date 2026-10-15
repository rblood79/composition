import { describe, expect, it } from "vitest";
import { gridCells, lengthPx } from "./canvasGridCells";

const content = { x: 40, y: 40, width: 330, height: 400 };

describe("gridCells — the cells a grid drag outlines (Figma)", () => {
  it("1fr 1fr 1fr with gap 30: columns from the template, rows from the items, one more row for an append", () => {
    const items = [
      { x: 40, y: 40, width: 90, height: 50 },
      { x: 160, y: 40, width: 90, height: 50 },
      { x: 280, y: 40, width: 90, height: 50 },
      { x: 40, y: 110, width: 90, height: 60 },
    ];
    const cells = gridCells({
      content,
      columns: "repeat(3, 1fr)",
      columnGap: 30,
      rowGap: 20,
      items,
      count: 4,
      fallbackHeight: 40,
    });
    expect(cells).toHaveLength(6);
    // Row 2's empty cells take its items' row; the second column is the template's.
    expect(cells[4]).toEqual({ x: 160, y: 110, width: 90, height: 60 });
    expect(cells[5]).toEqual({ x: 280, y: 110, width: 90, height: 60 });
  });

  it("a full grid: the append goes to a new row below, the previous row's height", () => {
    const items = [
      { x: 40, y: 40, width: 150, height: 50 },
      { x: 220, y: 40, width: 150, height: 50 },
    ];
    const cells = gridCells({
      content,
      columns: "1fr 1fr",
      columnGap: 30,
      rowGap: 20,
      items,
      count: 2,
      fallbackHeight: 40,
    });
    expect(cells[2]).toEqual({ x: 40, y: 110, width: 150, height: 50 });
  });

  it("fixed-width items in 1fr columns: the cells are the tracks, not the items; an auto column takes its item", () => {
    const cells = gridCells({
      content: { x: 0, y: 0, width: 360, height: 200 },
      columns: "1fr 1fr",
      columnGap: 0,
      rowGap: 0,
      items: [{ x: 0, y: 0, width: 100, height: 60 }],
      count: 1,
      fallbackHeight: 40,
    });
    // The item's own column too: the track, not the 100 wide item.
    expect(cells[0]).toEqual({ x: 0, y: 0, width: 180, height: 60 });
    expect(cells[1]).toEqual({ x: 180, y: 0, width: 180, height: 60 });
    const auto = gridCells({
      content: { x: 0, y: 0, width: 360, height: 200 },
      columns: "auto 1fr",
      columnGap: 0,
      rowGap: 0,
      items: [{ x: 0, y: 0, width: 100, height: 60 }],
      count: 1,
      fallbackHeight: 40,
    });
    expect(auto[0]).toEqual({ x: 0, y: 0, width: 100, height: 60 });
  });

  it("px · fr columns without items; an unreadable template falls back to the items' columns", () => {
    const cells = gridCells({
      content,
      columns: "100px 1fr",
      columnGap: 30,
      rowGap: 0,
      items: [],
      count: 0,
      fallbackHeight: 40,
    });
    expect(cells).toEqual([
      { x: 40, y: 40, width: 100, height: 40 },
      { x: 170, y: 40, width: 200, height: 40 },
    ]);
    const fallback = gridCells({
      content,
      columns: "repeat(auto-fill, minmax(100px, 1fr))",
      columnGap: 10,
      rowGap: 10,
      items: [
        { x: 40, y: 40, width: 100, height: 30 },
        { x: 150, y: 40, width: 100, height: 30 },
      ],
      count: 2,
      fallbackHeight: 40,
    });
    expect(fallback[2]).toEqual({ x: 40, y: 80, width: 100, height: 30 });
  });

  it("lengthPx reads numbers and px strings only", () => {
    expect([
      lengthPx(12),
      lengthPx("12px"),
      lengthPx("8"),
      lengthPx("10%"),
      lengthPx("normal"),
    ]).toEqual([12, 12, 8, undefined, undefined]);
  });
});
