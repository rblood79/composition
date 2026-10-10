/**
 * ADR-257 Phase 1 — the column track function against an independent oracle: the installed RAC
 * `calculateColumnSizes` (react-stately — what `ResizableTableContainer` gives each Column) for the
 * same table width and Column props, and the real Rust engine laying out one row with the tracks
 * (cells padded 8px — padding must not move a column, ADR-257 Context 5).
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGridTemplate } from "../../../../../../packages/shared/src/catalog/runtime/gridStyleAdapter";
import {
  catalogColumnSizeFits,
  catalogColumnTrack,
  catalogTableColumnTracks,
  type CatalogColumnInput,
} from "../../../../../../packages/shared/src/catalog/runtime/tableTracks";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

type RacColumn = {
  key: string;
  width?: unknown;
  defaultWidth?: unknown;
  minWidth?: unknown;
  maxWidth?: unknown;
};
type CalculateColumnSizes = (
  availableWidth: number,
  columns: RacColumn[],
  changed: Map<string, unknown>,
  getDefaultWidth: (index: number) => unknown,
  getDefaultMinWidth: (index: number) => unknown,
) => number[];

/** RAC's own column sizing (`TableColumnLayout` defaults: width `1fr`, min width 75). */
async function racSizes(
  tableWidth: number,
  columns: readonly CatalogColumnInput[],
): Promise<number[]> {
  const require = createRequire(import.meta.url);
  const entry = require.resolve("react-stately");
  const utils = join(
    dirname(dirname(entry)),
    "private",
    "table",
    "TableUtils.mjs",
  );
  const { calculateColumnSizes } = (await import(
    pathToFileURL(utils).href
  )) as { calculateColumnSizes: CalculateColumnSizes };
  return calculateColumnSizes(
    tableWidth,
    columns.map((column, index) => ({
      key: String(index),
      // (S2 TableView's selection column: `width` · `minWidth` 40 — `TableView.tsx` TableHeader.)
      ...(column.selection ? { width: 40, minWidth: 40 } : {}),
      ...column.props,
    })),
    new Map(),
    () => "1fr",
    () => 75,
  );
}

/** The engine's column widths for one row grid at `tableWidth` (cells padded 0 8px). */
async function engineSizes(
  tableWidth: number,
  columns: readonly CatalogColumnInput[],
): Promise<number[]> {
  const engine = await nodeLayoutEngine();
  const cells = columns.map(() => ({
    style: { height: "20px", paddingLeft: "8px", paddingRight: "8px" },
    children: [],
  }));
  const handles = engine.buildTreeBatch(
    JSON.stringify([
      ...cells,
      {
        style: {
          display: "grid",
          width: `${tableWidth}px`,
          gridTemplateColumns: parseGridTemplate(
            catalogTableColumnTracks(columns),
          ),
        },
        children: cells.map((_, index) => index),
      },
    ]),
  );
  const row = handles.at(-1)!;
  engine.computeLayout(row, tableWidth, 400);
  const layouts = engine.getLayoutsBatch(handles.slice(0, -1));
  return handles
    .slice(0, -1)
    .map((handle) => (layouts.get(handle) as { width: number }).width);
}

const col = (
  props: Record<string, unknown>,
  selection?: boolean,
): CatalogColumnInput => ({ props, ...(selection ? { selection } : {}) });

describe("ADR-257 column tracks — RAC calculateColumnSizes oracle", () => {
  const cases: [string, number, CatalogColumnInput[]][] = [
    ["default 1fr × 3", 300, [col({}), col({}), col({})]],
    ["1fr : 2fr", 300, [col({ width: "1fr" }), col({ width: "2fr" })]],
    [
      "1fr with a 75% floor + 1fr (225 · 75)",
      300,
      [col({ width: "1fr", minWidth: "75%" }), col({ width: "1fr" })],
    ],
    [
      "120px + 1fr + 2fr — the 75px default floor freezes the 1fr",
      300,
      [col({ width: 120 }), col({ width: "1fr" }), col({ width: "2fr" })],
    ],
    [
      "five default columns overflow at the 75px floor",
      300,
      [col({}), col({}), col({}), col({}), col({})],
    ],
    ["25% + 1fr + 1fr", 400, [col({ width: "25%" }), col({}), col({})]],
    [
      "a 40px width under the default 75 floor",
      300,
      [col({ width: 40 }), col({})],
    ],
    [
      "the selection column (40 · 40) + two data columns",
      300,
      [col({}, true), col({}), col({})],
    ],
    [
      "px width over a px max",
      400,
      [col({ width: 200, maxWidth: 150 }), col({})],
    ],
    [
      "% width under a % floor",
      500,
      [col({ width: "10%", minWidth: "20%" }), col({})],
    ],
    [
      "1fr with a 200px floor + 1fr",
      300,
      [col({ width: "1fr", minWidth: 200 }), col({})],
    ],
    ["defaultWidth when no width", 300, [col({ defaultWidth: 100 }), col({})]],
  ];
  for (const [name, width, columns] of cases)
    it(name, async () => {
      const expected = await racSizes(width, columns);
      const actual = await engineSizes(width, columns);
      expect(actual.length).toBe(expected.length);
      // (RAC rounds to whole px — cascade rounding; the grid keeps the fraction: ≤ 1 px.)
      actual.forEach((value, index) =>
        expect(Math.abs(value - expected[index]!)).toBeLessThanOrEqual(1),
      );
    });
});

describe("ADR-257 column tracks — the track and its stored-not-applied bounds", () => {
  it("the defaults: 1fr over a 75px floor; the selection column 40px", () => {
    expect(catalogColumnTrack(col({})).track).toBe("minmax(75px, 1fr)");
    expect(catalogColumnTrack(col({}, true)).track).toBe("40px");
    // (An authored width on the selection column is the author's — RAC's default floor again.)
    expect(catalogColumnTrack(col({ width: 60 }, true)).track).toBe("75px");
  });
  it("Nfr + maxWidth: the max is stored, not applied (사용자 결정 3 (a))", () => {
    expect(catalogColumnTrack(col({ width: "1fr", maxWidth: 120 }))).toEqual({
      track: "minmax(75px, 1fr)",
      ignored: ["maxWidth"],
    });
  });
  it("a px width with a % bound / a % width with a px max", () => {
    expect(catalogColumnTrack(col({ width: 120, minWidth: "50%" }))).toEqual({
      track: "120px",
      ignored: ["minWidth"],
    });
    expect(catalogColumnTrack(col({ width: "30%", maxWidth: 80 }))).toEqual({
      track: "minmax(75px, 30%)",
      ignored: ["maxWidth"],
    });
  });
  it("the stored value types: ColumnSize · ColumnStaticSize (no numeric strings, no fr bounds)", () => {
    expect(catalogColumnSizeFits(120, false)).toBe(true);
    expect(catalogColumnSizeFits("2fr", false)).toBe(true);
    expect(catalogColumnSizeFits("25%", false)).toBe(true);
    expect(catalogColumnSizeFits("120", false)).toBe(false);
    expect(catalogColumnSizeFits("2fr", true)).toBe(false);
    expect(catalogColumnSizeFits("25%", true)).toBe(true);
    expect(catalogColumnSizeFits(-1, true)).toBe(false);
    expect(catalogColumnSizeFits("1.5fr", false)).toBe(false);
  });
});
