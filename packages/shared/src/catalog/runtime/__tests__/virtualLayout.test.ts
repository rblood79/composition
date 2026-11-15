import { describe, expect, it } from "vitest";
import { ListLayout, Rect, Size } from "react-stately/useVirtualizerState";
import { catalogVirtualLayout } from "../virtualLayout";

/**
 * ADR-310 Phase 8 (R12) — the options a virtual list gets from the Canvas's values place its rows
 * where the Canvas's flex column does (padding + i × (row + gap)): the oracle is the installed RAC
 * `ListLayout` given those options. Lists a `Layout` cannot place the same way are refused.
 */
function racRows(
  options: Record<string, unknown>,
  count: number,
  size = new Size(300, 600),
) {
  const keys = Array.from({ length: count }, (_, index) => `k${index}`);
  const nodes = keys.map((key, index) => ({
    key,
    type: "item",
    index,
    level: 0,
    hasChildNodes: false,
    childNodes: [],
    rendered: null,
    textValue: key,
    parentKey: null,
    prevKey: keys[index - 1] ?? null,
    nextKey: keys[index + 1] ?? null,
  }));
  const collection = {
    size: count,
    getKeys: () => keys,
    getItem: (key: string) => nodes.find((node) => node.key === key) ?? null,
    getFirstKey: () => keys[0] ?? null,
    getLastKey: () => keys.at(-1) ?? null,
    getKeyBefore: (key: string) => keys[keys.indexOf(key) - 1] ?? null,
    getKeyAfter: (key: string) => keys[keys.indexOf(key) + 1] ?? null,
    getChildren: () => nodes,
    [Symbol.iterator]: () => nodes[Symbol.iterator](),
  };
  const layout = new ListLayout();
  (layout as unknown as { virtualizer: unknown }).virtualizer = {
    size,
    collection,
    visibleRect: new Rect(0, 0, size.width, size.height),
    isPersistedKey: () => false,
  };
  layout.update({
    layoutOptions: options,
    sizeChanged: true,
    layoutOptionsChanged: true,
    itemSizeChanged: true,
  } as never);
  return keys.map((key) => {
    const rect = layout.getLayoutInfo(key)!.rect;
    return { x: rect.x, y: rect.y, height: rect.height };
  });
}

const padding = (value: number) => ({
  top: value,
  right: value,
  bottom: value,
  left: value,
});

describe("ADR-310 Phase 8 — a virtual list's options from the Canvas's values", () => {
  it("fixed rows · gap · padding: RAC ListLayout puts row i where the flex column does", () => {
    const layout = catalogVirtualLayout({
      kind: "list",
      rowGap: 4,
      columnGap: 0,
      padding: padding(8),
      rows: [
        { width: 284, height: 36 },
        { width: 284, height: 36 },
      ],
    });
    expect(layout).toEqual({
      kind: "list",
      options: { orientation: "vertical", rowSize: 36, gap: 4, padding: 8 },
    });
    const rows = racRows(
      (layout as { options: Record<string, unknown> }).options,
      5,
    );
    expect(rows.map((row) => row.y)).toEqual([0, 1, 2, 3, 4].map((i) => 8 + i * (36 + 4)));
    expect(rows.every((row) => row.height === 36 && row.x === 8)).toBe(true);
  });

  it("varying rows: an estimate (the rows measure themselves); a horizontal list reads widths", () => {
    expect(
      catalogVirtualLayout({
        kind: "list",
        rowGap: 0,
        columnGap: 0,
        padding: padding(0),
        rows: [
          { width: 100, height: 30 },
          { width: 100, height: 50 },
        ],
      }),
    ).toMatchObject({ options: { estimatedRowSize: 40 } });
    expect(
      catalogVirtualLayout({
        kind: "list",
        orientation: "horizontal",
        rowGap: 0,
        columnGap: 6,
        padding: padding(2),
        rows: [{ width: 80, height: 30 }],
      }),
    ).toEqual({
      kind: "list",
      options: { orientation: "horizontal", rowSize: 80, gap: 6, padding: 2 },
    });
  });

  it("refuses what a Layout cannot place the same way", () => {
    const base = { rowGap: 0, columnGap: 0, padding: padding(0) };
    // (No laid-out row — the Preview root: a list estimates, RAC measures; a grid needs its cell.)
    expect(catalogVirtualLayout({ kind: "list", ...base, rows: [] })).toMatchObject({
      options: { estimatedRowSize: 40 },
    });
    expect(catalogVirtualLayout({ kind: "grid", ...base, rows: [] })).toEqual({
      refused: "noRows",
    });
    expect(
      catalogVirtualLayout({
        kind: "list",
        ...base,
        padding: { top: 4, right: 8, bottom: 4, left: 8 },
        rows: [{ width: 10, height: 10 }],
      }),
    ).toEqual({ refused: "padding" });
    expect(
      catalogVirtualLayout({
        kind: "grid",
        ...base,
        rows: [
          { width: 100, height: 80 },
          { width: 120, height: 80 },
        ],
      }),
    ).toEqual({ refused: "cellSize" });
  });

  it("a grid's cell and gaps · a Table's row and header heights", () => {
    expect(
      catalogVirtualLayout({
        kind: "grid",
        rowGap: 12,
        columnGap: 16,
        padding: padding(0),
        columns: 3,
        rows: [
          { width: 160, height: 120 },
          { width: 160, height: 120 },
        ],
      }),
    ).toEqual({
      kind: "grid",
      options: {
        minItemSize: { width: 160, height: 120 },
        maxItemSize: { width: 160, height: 120 },
        minSpace: { width: 16, height: 12 },
        maxColumns: 3,
      },
    });
    expect(
      catalogVirtualLayout({
        kind: "table",
        rowGap: 0,
        columnGap: 0,
        padding: padding(0),
        headings: [{ width: 600, height: 40 }],
        rows: [
          { width: 600, height: 48 },
          { width: 600, height: 48 },
        ],
      }),
    ).toEqual({ kind: "table", options: { rowHeight: 48, headingHeight: 40 } });
  });
});
