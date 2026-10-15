import { describe, expect, it } from "vitest";
import { gridCells, gridLayout, gridPlacement, lengthPx } from "./canvasGridCells";

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
      content: { ...content, height: 130 },
      columns: "repeat(3, 1fr)",
      columnGap: 30,
      rowGap: 20,
      items,
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
      content: { ...content, height: 50 },
      columns: "1fr 1fr",
      columnGap: 30,
      rowGap: 20,
      items,
      fallbackHeight: 40,
    });
    expect(cells[2]).toEqual({ x: 40, y: 110, width: 150, height: 50 });
  });

  it("fixed-width items in 1fr columns: the cells are the tracks, not the items; an auto column takes its item", () => {
    const cells = gridCells({
      content: { x: 0, y: 0, width: 360, height: 60 },
      columns: "1fr 1fr",
      columnGap: 0,
      rowGap: 0,
      items: [{ x: 0, y: 0, width: 100, height: 60 }],
      fallbackHeight: 40,
    });
    // The item's own column too: the track, not the 100 wide item.
    expect(cells[0]).toEqual({ x: 0, y: 0, width: 180, height: 60 });
    expect(cells[1]).toEqual({ x: 180, y: 0, width: 180, height: 60 });
    const auto = gridCells({
      content: { x: 0, y: 0, width: 360, height: 60 },
      columns: "auto 1fr",
      columnGap: 0,
      rowGap: 0,
      items: [{ x: 0, y: 0, width: 100, height: 60 }],
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
      fallbackHeight: 40,
    });
    // An empty grid's one auto row stretches over the content (400 tall), as CSS.
    expect(cells).toEqual([
      { x: 40, y: 40, width: 100, height: 400 },
      { x: 170, y: 40, width: 200, height: 400 },
    ]);
    const fallback = gridCells({
      content: { ...content, height: 30 },
      columns: "repeat(auto-fill, minmax(100px, 1fr))",
      columnGap: 10,
      rowGap: 10,
      items: [
        { x: 40, y: 40, width: 100, height: 30 },
        { x: 150, y: 40, width: 100, height: 30 },
      ],
      fallbackHeight: 40,
    });
    expect(fallback[2]).toEqual({ x: 40, y: 80, width: 100, height: 30 });
  });

  it("a taller grid stretches its auto rows: a short item's row reaches the next row, the last the content end", () => {
    const cells = gridCells({
      content: { x: 0, y: 0, width: 360, height: 200 },
      columns: "repeat(3, 1fr)",
      columnGap: 0,
      rowGap: 10,
      items: [
        { x: 0, y: 0, width: 60, height: 40 },
        { x: 120, y: 0, width: 60, height: 40 },
        { x: 240, y: 0, width: 60, height: 40 },
        { x: 0, y: 105, width: 60, height: 40 },
      ],
      fallbackHeight: 40,
      appendRow: false,
    });
    expect(cells[0]).toEqual({ x: 0, y: 0, width: 120, height: 95 });
    expect(cells[4]).toEqual({ x: 120, y: 105, width: 120, height: 95 });
  });

  it("as it is (selection): no append row; the row template's tracks show without items", () => {
    const base = {
      content: { x: 0, y: 0, width: 300, height: 300 },
      columns: "1fr 1fr",
      columnGap: 0,
      rowGap: 0,
      items: [
        { x: 0, y: 0, width: 150, height: 50 },
        { x: 150, y: 0, width: 150, height: 50 },
      ],
      fallbackHeight: 40,
      appendRow: false,
    };
    expect(gridCells(base)).toHaveLength(2);
    expect(gridCells({ ...base, rows: "repeat(3, 1fr)" })).toHaveLength(6);
  });

  it("user report (2026-10-15): an empty grid's 3 × 3 template spreads over the box — not piled at the top", () => {
    const cells = gridCells({
      content: { x: 0, y: 0, width: 300, height: 300 },
      columns: "repeat(3, 1fr)",
      rows: "repeat(3, 1fr)",
      columnGap: 0,
      rowGap: 0,
      items: [],
      fallbackHeight: 0,
      appendRow: false,
    });
    expect(cells.map((cell) => [cell.x, cell.y, cell.width, cell.height])).toEqual([
      [0, 0, 100, 100], [100, 0, 100, 100], [200, 0, 100, 100],
      [0, 100, 100, 100], [100, 100, 100, 100], [200, 100, 100, 100],
      [0, 200, 100, 100], [100, 200, 100, 100], [200, 200, 100, 100],
    ]);
    // Auto rows (no row template) with 2 items in 2 columns and a 3rd row: equal shares.
    const auto = gridCells({
      content: { x: 0, y: 0, width: 200, height: 300 },
      columns: "1fr 1fr",
      columnGap: 0,
      rowGap: 0,
      items: [
        { x: 0, y: 0, width: 100, height: 40 },
        { x: 100, y: 0, width: 100, height: 40 },
        { x: 0, y: 150, width: 100, height: 40 },
      ],
      fallbackHeight: 0,
      appendRow: false,
    });
    expect(auto.map((cell) => cell.height)).toEqual([150, 150, 150, 150]);
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

describe("gridPlacement — CSS grid placement of pinned, auto and spanning items", () => {
  const at = (cells: { row: number; column: number }[]) =>
    cells.map(({ row, column }) => `${row}:${column}`);

  it("pinned items first; auto items fill around them in order (sparse)", () => {
    const { cells } = gridPlacement(
      [undefined, { column: "3", row: "3" }, undefined, { column: "1", row: "1" }],
      3,
    );
    // The first auto item skips the pinned first cell; the pinned one stays in the corner.
    expect(at(cells)).toEqual(["0:1", "2:2", "0:2", "0:0"]);
  });

  it("a span takes its cells; an auto span wraps to a row where it fits", () => {
    const { cells } = gridPlacement(
      [undefined, undefined, { columnEnd: "span 2" }, { rowEnd: "span 2" }],
      3,
    );
    expect(cells[2]).toEqual({ row: 1, column: 0, rowSpan: 1, columnSpan: 2 });
    // Sparse: the cursor never goes back — the empty first-row cell stays empty (CSS).
    expect(cells[3]).toEqual({ row: 1, column: 2, rowSpan: 2, columnSpan: 1 });
  });

  it("a row-locked item takes that row's first free column", () => {
    const { cells } = gridPlacement([{ row: "2" }, { row: "2" }], 3);
    expect(at(cells)).toEqual(["1:0", "1:1"]);
  });
});

describe("gridLayout — occupancy", () => {
  it("a spanning item is in each of its cells; the cells past it stay empty", () => {
    const layout = gridLayout({
      content: { x: 0, y: 0, width: 300, height: 200 },
      columns: "repeat(3, 1fr)",
      columnGap: 0,
      rowGap: 0,
      items: [
        { x: 0, y: 0, width: 200, height: 100 },
        { x: 0, y: 100, width: 100, height: 100 },
      ],
      lines: [{ columnEnd: "span 2" }, { column: "1", row: "2" }],
      fallbackHeight: 40,
      rows: "repeat(2, 1fr)",
      appendRow: false,
    });
    expect(layout.occupant).toEqual([0, 0, -1, 1, -1, -1]);
    expect(layout.cells[4]).toEqual({ x: 100, y: 100, width: 100, height: 100 });
  });
});
