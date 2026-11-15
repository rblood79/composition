/**
 * ADR-310 Phase 8 — a virtual Table's column widths (`catalogTableTrackWidths`, RAC `TableLayout`
 * `columnWidths`) are the px the Canvas's grid gives its tracks: the oracle is the real Rust engine
 * laying out one row on the same track list at the same width (as `adr257ColumnTracks.test.ts`).
 */
import { describe, expect, it } from "vitest";
import { parseGridTemplate } from "../../../../../../packages/shared/src/catalog/runtime/gridStyleAdapter";
import {
  CATALOG_SELECTION_COLUMN_VAR,
  catalogTableColumnDeviceTracks,
  catalogTableColumnTracks,
  type CatalogColumnInput,
} from "../../../../../../packages/shared/src/catalog/runtime/tableTracks";
import {
  catalogDeviceColumnTracks,
  catalogTableTrackWidths,
} from "../../../../../../packages/shared/src/catalog/runtime/tableTrackWidths";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

async function engineWidths(
  width: number,
  tracks: string[],
): Promise<number[]> {
  const engine = await nodeLayoutEngine();
  const cells = tracks.map(() => ({
    style: { height: "20px", paddingLeft: "16px", paddingRight: "16px" },
    children: [],
  }));
  const handles = engine.buildTreeBatch(
    JSON.stringify([
      ...cells,
      {
        style: {
          display: "grid",
          width: `${width}px`,
          gridTemplateColumns: tracks,
        },
        children: cells.map((_, index) => index),
      },
    ]),
  );
  const row = handles.at(-1)!;
  engine.computeLayout(row, width, 400);
  const layouts = engine.getLayoutsBatch(handles.slice(0, -1));
  return handles
    .slice(0, -1)
    .map((handle) => (layouts.get(handle) as { width: number }).width);
}

const col = (
  props: Record<string, unknown>,
  selection?: boolean,
): CatalogColumnInput => ({ props, ...(selection ? { selection } : {}) });

describe("ADR-310 Phase 8 — a virtual Table's column widths = the Canvas grid", () => {
  const cases: [string, number, CatalogColumnInput[]][] = [
    ["default 1fr × 3 (fractional thirds)", 598, [col({}), col({}), col({})]],
    ["1fr : 2fr", 301, [col({ width: "1fr" }), col({ width: "2fr" })]],
    [
      "120px + 1fr + 2fr — the 75px floor freezes the 1fr",
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
      "a % width over its px floor grows before the fr (minmax(75px, 30%))",
      500,
      [col({ width: "30%" }), col({ width: "2fr" })],
    ],
    [
      "a % width with no room grows less",
      200,
      [col({ width: "30%" }), col({ width: 150 })],
    ],
    [
      "the selection column (40px) + two data columns",
      333,
      [col({}, true), col({}), col({})],
    ],
    [
      "1fr with a 75% floor + 1fr",
      300,
      [col({ width: "1fr", minWidth: "75%" }), col({ width: "1fr" })],
    ],
    [
      "% width under a % floor",
      500,
      [col({ width: "10%", minWidth: "20%" }), col({})],
    ],
  ];
  for (const [name, width, columns] of cases)
    it(name, async () => {
      const tracks = parseGridTemplate(
        catalogTableColumnTracks(columns),
      ) as string[];
      const expected = await engineWidths(width, tracks);
      const actual = catalogTableTrackWidths(tracks, width)!;
      expect(actual).toHaveLength(expected.length);
      actual.forEach((value, index) =>
        expect(value).toBeCloseTo(expected[index]!, 2),
      );
    });

  it("a track no Column makes is not sized", () => {
    expect(catalogTableTrackWidths(["auto", "1fr"], 300)).toBeUndefined();
  });

  // (The Canvas's tracks hold the desktop px — selection 40, drag 16; the DOM's grid follows the
  //  device: S2 `scale === 'medium' ? 40 : 52` and the drag column's 16 × 1.25. The `Layout` takes
  //  the device's tracks: oracle = the engine on the tracks a touch device's grid lays out.)
  const touch: [string, CatalogColumnInput[]][] = [
    ["the selection column", [col({}, true), col({}), col({})]],
    [
      "the selection column under an authored px max · over a px floor",
      [col({ maxWidth: 48, minWidth: 45 }, true), col({})],
    ],
    ["an authored selection width keeps its px", [col({ width: 64 }, true), col({})]],
  ];
  for (const [name, columns] of touch)
    for (const drag of [false, true])
      it(`touch: ${name}${drag ? " + the drag column" : ""}`, async () => {
        const withDrag = (list: string) => (drag ? `16px ${list}` : list);
        const canvas = parseGridTemplate(
          withDrag(catalogTableColumnTracks(columns)),
        ) as string[];
        const device = catalogTableColumnDeviceTracks(columns);
        const tracks = catalogDeviceColumnTracks(
          canvas,
          device && withDrag(device),
          drag,
          { selectionVar: CATALOG_SELECTION_COLUMN_VAR, selection: 52, drag: 20 },
        );
        const touchTracks = parseGridTemplate(
          (drag ? "20px " : "") +
            catalogTableColumnTracks(
              columns.map((column) => ({ ...column, selectionWidth: 52 })),
            ),
        ) as string[];
        expect(tracks).toEqual(touchTracks);
        const expected = await engineWidths(333, touchTracks);
        catalogTableTrackWidths(tracks, 333)!.forEach((value, index) =>
          expect(value).toBeCloseTo(expected[index]!, 2),
        );
      });

  it("desktop: the device's tracks are the Canvas's", () => {
    const columns = [col({}, true), col({})];
    const canvas = parseGridTemplate(
      `16px ${catalogTableColumnTracks(columns)}`,
    ) as string[];
    expect(
      catalogDeviceColumnTracks(
        canvas,
        `16px ${catalogTableColumnDeviceTracks(columns)}`,
        true,
        { selectionVar: CATALOG_SELECTION_COLUMN_VAR, selection: 40, drag: 16 },
      ),
    ).toEqual(canvas);
  });
});
