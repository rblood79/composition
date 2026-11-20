import { describe, expect, it } from "vitest";
import {
  catalogTableStateRead,
  catalogTableStateRemembered,
  catalogTableStateWith,
  type CatalogTableShape,
  type CatalogTableState,
} from "../tableState";

/**
 * ADR-315 Phase 1 — the Table's grid state: one closed shape, and the rules between its slices in
 * one place (breakdown §4.4). Expected values are written by hand.
 */
const SHAPE: CatalogTableShape = {
  columns: [
    { key: "name", rowHeader: true },
    { key: "team" },
    { key: "score" },
    { key: "note" },
  ],
};
const MULTI: CatalogTableShape = { ...SHAPE, multiSort: true };

describe("catalogTableStateWith — a slice written", () => {
  it("keeps one sort on a Table without multi-column sort (the last written)", () => {
    const state = catalogTableStateWith(
      { sort: [{ column: "team", direction: "ascending" }] },
      {
        sort: [
          { column: "team", direction: "ascending" },
          { column: "score", direction: "descending" },
        ],
      },
      SHAPE,
    );
    expect(state.sort).toEqual([{ column: "score", direction: "descending" }]);
  });

  it("keeps the sort list in order, one entry a column, up to the Table's maximum", () => {
    const state = catalogTableStateWith(
      {},
      {
        sort: [
          { column: "team", direction: "ascending" },
          { column: "score", direction: "descending" },
          { column: "team", direction: "descending" },
          { column: "note", direction: "ascending" },
        ],
      },
      { ...MULTI, maxSortColumns: 2 },
    );
    // (`team` twice: the later entry replaces the first in place; the third column is past the max.)
    expect(state.sort).toEqual([
      { column: "team", direction: "descending" },
      { column: "score", direction: "descending" },
    ]);
  });

  it("goes back to the first page when a data slice changes", () => {
    const paged: CatalogTableState = { page: 4 };
    expect(
      catalogTableStateWith(
        paged,
        { sort: [{ column: "team", direction: "ascending" }] },
        SHAPE,
      ).page,
    ).toBeUndefined();
    expect(
      catalogTableStateWith(paged, { search: "kim" }, SHAPE).page,
    ).toBeUndefined();
    expect(
      catalogTableStateWith(paged, { grouping: ["team"] }, SHAPE).page,
    ).toBeUndefined();
  });

  it("keeps the page when a column · row slice changes, or a data slice is written unchanged", () => {
    const paged: CatalogTableState = {
      page: 4,
      sort: [{ column: "team", direction: "ascending" }],
    };
    expect(
      catalogTableStateWith(paged, { hiddenColumns: ["note"] }, SHAPE).page,
    ).toBe(4);
    expect(
      catalogTableStateWith(paged, { selectedKeys: ["r1"] }, SHAPE).page,
    ).toBe(4);
    expect(
      catalogTableStateWith(
        paged,
        { sort: [{ column: "team", direction: "ascending" }] },
        SHAPE,
      ).page,
    ).toBe(4);
  });

  it("keeps a page written with a data slice only when the patch says so", () => {
    expect(
      catalogTableStateWith({ page: 4 }, { search: "kim", page: 2 }, SHAPE)
        .page,
    ).toBe(2);
  });

  it("drops a column the Table does not have, from every slice that names columns", () => {
    const state = catalogTableStateWith(
      {},
      {
        sort: [{ column: "gone", direction: "ascending" }],
        grouping: ["gone", "team"],
        hiddenColumns: ["gone", "note"],
        columnOrder: ["score", "gone", "team"],
        pinnedColumns: { start: ["gone"], end: ["note", "gone"] },
        columnWidths: { gone: 120, score: 80 },
      },
      MULTI,
    );
    expect(state).toEqual({
      grouping: ["team"],
      hiddenColumns: ["note"],
      columnOrder: ["score", "team"],
      pinnedColumns: { start: [], end: ["note"] },
      columnWidths: { score: 80 },
    });
  });

  it("never hides the last row header column (RAC throws without one)", () => {
    expect(
      catalogTableStateWith({}, { hiddenColumns: ["name", "team"] }, SHAPE)
        .hiddenColumns,
    ).toEqual(["team"]);
    // (Two row header columns: one of them may hide.)
    const two: CatalogTableShape = {
      columns: [
        { key: "name", rowHeader: true },
        { key: "team", rowHeader: true },
        { key: "score" },
      ],
    };
    expect(
      catalogTableStateWith({}, { hiddenColumns: ["name"] }, two).hiddenColumns,
    ).toEqual(["name"]);
    expect(
      catalogTableStateWith({}, { hiddenColumns: ["name", "team"] }, two)
        .hiddenColumns,
    ).toEqual(["name"]);
  });

  it("pins a column at one side only (the start side wins)", () => {
    expect(
      catalogTableStateWith(
        {},
        { pinnedColumns: { start: ["team"], end: ["team", "note"] } },
        SHAPE,
      ).pinnedColumns,
    ).toEqual({ start: ["team"], end: ["note"] });
  });

  it("removes an emptied slice — absent is the authored default", () => {
    const state = catalogTableStateWith(
      {
        search: "kim",
        sort: [{ column: "team", direction: "ascending" }],
        hiddenColumns: ["note"],
        pinnedColumns: { start: ["team"], end: [] },
        columnWidths: { score: 80 },
        selectedKeys: ["r1"],
      },
      {
        search: "",
        sort: [],
        hiddenColumns: [],
        pinnedColumns: { start: [], end: [] },
        columnWidths: {},
      },
      SHAPE,
    );
    expect(state).toEqual({ selectedKeys: ["r1"] });
  });

  it("returns the same state when nothing changes (a reader's memo holds)", () => {
    const state: CatalogTableState = {
      sort: [{ column: "team", direction: "ascending" }],
      hiddenColumns: ["note"],
    };
    expect(
      catalogTableStateWith(
        state,
        { sort: [{ column: "team", direction: "ascending" }] },
        SHAPE,
      ),
    ).toBe(state);
  });
});

describe("catalogTableStateRead — a value from outside (the browser's memory · a rule)", () => {
  it("reads a well-formed state through the same rules", () => {
    expect(
      catalogTableStateRead(
        {
          sort: [{ column: "score", direction: "descending" }],
          hiddenColumns: ["note", "gone"],
          columnWidths: { score: 96, team: "wide" },
        },
        SHAPE,
      ),
    ).toEqual({
      sort: [{ column: "score", direction: "descending" }],
      hiddenColumns: ["note"],
      columnWidths: { score: 96 },
    });
  });

  it("reads nothing from a value that is not a state", () => {
    for (const value of [null, undefined, "x", 3, [], { sort: "team" }])
      expect(catalogTableStateRead(value, SHAPE)).toEqual({});
    expect(
      catalogTableStateRead(
        { sort: [{ column: "team", direction: "sideways" }], page: "2" },
        SHAPE,
      ),
    ).toEqual({});
  });
});

describe("catalogTableStateRemembered — what the browser keeps", () => {
  it("keeps the column slices and the sort; never the rows' · the page's", () => {
    expect(
      catalogTableStateRemembered({
        sort: [{ column: "team", direction: "ascending" }],
        search: "kim",
        hiddenColumns: ["note"],
        columnOrder: ["score", "team"],
        pinnedColumns: { start: ["team"], end: [] },
        columnWidths: { score: 80 },
        selectedKeys: ["r1"],
        expandedKeys: ["g1"],
        page: 3,
      }),
    ).toEqual({
      sort: [{ column: "team", direction: "ascending" }],
      hiddenColumns: ["note"],
      columnOrder: ["score", "team"],
      pinnedColumns: { start: ["team"], end: [] },
      columnWidths: { score: 80 },
    });
  });
});
