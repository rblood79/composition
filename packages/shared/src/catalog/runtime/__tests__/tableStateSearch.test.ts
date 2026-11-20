import { describe, expect, it } from "vitest";
import type { ViewQuery } from "../../document/types";
import {
  runViewQueries,
  type ViewRunField,
} from "../../../collections/view/evaluate";
import { serializeViewQueries } from "../../../collections/view/serialize";
import { catalogBoundRows } from "../dataBinding";
import { catalogCountlessViews } from "../viewQuery";
import { catalogTableStateWith, type CatalogTableShape } from "../tableState";
import {
  catalogRowSlicesView,
  catalogTableSliceServable,
  catalogTableStateQueries,
  catalogTableStateRowSlices,
} from "../tableStateQuery";

/**
 * ADR-315 Phase 3 (G3 · R2) — a Table state's search · column filters as a view query: the same
 * translation gives the rows here (on row numbers — `catalogBoundRows`) and the request, and both
 * are the hand-written answer.
 *
 * Fixture (리뷰 round 1 H2's shape — 「needle」 is in `name` or in `note`):
 *   r1 Alpha needle · A · 5 · —          r2 Beta · B · 9 · the needle
 *   r3 Gamma · A · 7 · none              r4 NEEDLE delta · B · 3 · —
 *   r5 Epsilon · A · 1 · needles
 * 「needle」 keeps r1 · r2 · r4 · r5; with score ≥ 5: r1 · r2.
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-team", key: "team", type: "string" },
  { id: "f-score", key: "score", type: "number" },
  { id: "f-note", key: "note", type: "string" },
];
const ROWS = [
  { id: "r1", name: "Alpha needle", team: "A", score: 5, note: "" },
  { id: "r2", name: "Beta", team: "B", score: 9, note: "the needle" },
  { id: "r3", name: "Gamma", team: "A", score: 7, note: "none" },
  { id: "r4", name: "NEEDLE delta", team: "B", score: 3, note: null },
  { id: "r5", name: "Epsilon", team: "A", score: 1, note: "needles" },
];
const COLUMNS = [
  { key: "name" },
  { key: "team", allowsSearching: false },
  { key: "score" },
  { key: "note" },
];
const SHAPE: CatalogTableShape = {
  columns: COLUMNS.map(({ key }) => ({ key })),
};
const SOURCE = {
  id: "items",
  name: "Items",
  schema: SCHEMA,
  mockData: ROWS,
  useMockData: true,
};
const BINDING = {
  collectionId: "data:collection:items",
  fieldMap: {},
} as const;
const keys = (rows: readonly { key: string }[] | undefined) =>
  rows?.map((row) => row.key);
const ids = (rows: readonly unknown[]) =>
  rows.map((row) => (row as { id: string }).id);
const here = (
  state: Parameters<typeof catalogTableStateRowSlices>[0],
  options: { limit?: number; start?: number; table?: object } = {},
) =>
  catalogBoundRows(
    BINDING as never,
    [SOURCE as never],
    "items",
    options.limit ?? 100,
    options.start ?? 0,
    catalogTableStateRowSlices(state, COLUMNS, options.table),
  );
const view = (state: Parameters<typeof catalogTableStateRowSlices>[0]) =>
  catalogRowSlicesView(catalogTableStateRowSlices(state, COLUMNS), SCHEMA);
const evaluated = (queries: readonly ViewQuery[]) =>
  ids(
    runViewQueries(ROWS, {
      queries,
      schema: SCHEMA,
      resolve: (v) => ({ value: v }),
    }).rows,
  );
const request = (
  queries: readonly ViewQuery[],
  format: Parameters<typeof serializeViewQueries>[0],
) =>
  serializeViewQueries(
    format,
    { queries, schema: SCHEMA, resolve: (value) => ({ value }) },
    format.kind === "body" ? "POST" : "GET",
  );
const SEARCH = { search: "needle" };
const FILTER = {
  columnFilters: [
    { column: "score", condition: { op: "gte" as const, value: 5 } },
  ],
};

describe("a Table state's search · column filters → the view query", () => {
  it("is one 「contains」 over the searchable Columns' fields, and a condition a column filter", () => {
    expect(
      catalogTableStateRowSlices({ ...SEARCH, ...FILTER }, COLUMNS),
    ).toEqual({
      // (`team` says it is not searched.)
      search: { text: "needle", keys: ["name", "score", "note"] },
      filters: [{ key: "score", op: "gte", value: 5 }],
    });
    expect(view({ ...SEARCH, ...FILTER })).toEqual({
      where: [
        {
          id: "table-search",
          fields: [
            ["data:field:f-name"],
            ["data:field:f-score"],
            ["data:field:f-note"],
          ],
          op: "contains",
          value: "needle",
        },
        {
          id: "table-filter:score",
          fields: [["data:field:f-score"]],
          op: "gte",
          value: 5,
        },
      ],
    });
  });

  it("joins the authored conditions by 「and」 — in the bound view's own group", () => {
    const authored: ViewQuery = {
      where: {
        id: "where",
        op: "and",
        items: [
          {
            id: "c1",
            fields: [["data:field:f-team"]],
            op: "equals",
            value: "A",
          },
        ],
      },
    };
    const [query] = catalogTableStateQueries([authored], view(SEARCH))!;
    expect(query!.where.id).toBe("where");
    expect(query!.where.items.map((item) => item.id)).toEqual([
      "c1",
      "table-search",
    ]);
    // team A and 「needle」: r1 · r5
    expect(evaluated([query!])).toEqual(["r1", "r5"]);
  });

  it("does not read the column slices — hiding a searched Column is the same search (HC4)", () => {
    const hidden = {
      ...SEARCH,
      hiddenColumns: ["note"],
      columnOrder: ["note"],
    };
    expect(catalogTableStateRowSlices(hidden, COLUMNS)).toEqual(
      catalogTableStateRowSlices(SEARCH, COLUMNS),
    );
    expect(keys(here(hidden))).toEqual(keys(here(SEARCH)));
  });

  it("is no slice for a state without one, or a search with no searchable Column", () => {
    expect(catalogTableStateRowSlices({}, COLUMNS)).toBeUndefined();
    expect(catalogTableStateRowSlices(undefined, COLUMNS)).toBeUndefined();
    expect(
      catalogTableStateRowSlices(SEARCH, [
        { key: "name", allowsSearching: false },
      ]),
    ).toBeUndefined();
  });
});

describe("the same translation — the rows here and the request (HC2)", () => {
  it("keeps the rows here by row number: the hand-written rows, and the evaluator's", () => {
    // 「needle」: r1 (name) · r2 (note) · r4 (name, case folded) · r5 (note 「needles」)
    expect(keys(here(SEARCH))).toEqual(["r1", "r2", "r4", "r5"]);
    expect(
      evaluated(catalogTableStateQueries(undefined, view(SEARCH))!),
    ).toEqual(["r1", "r2", "r4", "r5"]);
    // … and score ≥ 5: r1 · r2
    const both = { ...SEARCH, ...FILTER };
    expect(keys(here(both))).toEqual(["r1", "r2"]);
    expect(evaluated(catalogTableStateQueries(undefined, view(both))!)).toEqual(
      ["r1", "r2"],
    );
    // (score ≥ 5 alone: r1 · r2 · r3)
    expect(keys(here(FILTER))).toEqual(["r1", "r2", "r3"]);
  });

  it("filters the sorted rows before the window · the page cuts them", () => {
    const sorted = {
      ...SEARCH,
      sort: [{ column: "score", direction: "descending" as const }],
    };
    // 「needle」 by score ↓: r2 (9) · r1 (5) · r4 (3) · r5 (1)
    expect(keys(here(sorted))).toEqual(["r2", "r1", "r4", "r5"]);
    // (A window of 2: the first two of those — and the count of all four.)
    const window = here(sorted, { limit: 2 });
    expect(keys(window)).toEqual(["r2", "r1"]);
    expect(window?.total).toBe(4);
    // (The second page of 2.)
    const page = here(sorted, { limit: 4, start: 2 });
    expect(keys(page)).toEqual(["r4", "r5"]);
    expect(page?.total).toBe(4);
  });

  it("keeps a row's key under every search (a collection without a key field)", () => {
    const keyless = {
      ...SOURCE,
      schema: SCHEMA.slice(1),
      mockData: ROWS.map(({ id: _id, ...row }) => row),
    };
    const read = (state: object) =>
      catalogBoundRows(
        BINDING as never,
        [keyless as never],
        "items",
        100,
        0,
        catalogTableStateRowSlices(state, COLUMNS),
      )!.map((row) => [row.key, row.values.name]);
    const all = read({ sort: [{ column: "name", direction: "ascending" }] });
    const found = read(SEARCH);
    // (Each kept row has the key it has unsearched.)
    for (const [key, name] of found)
      expect(all.find((row) => row[1] === name)?.[0]).toBe(key);
    expect(found.map((row) => row[1])).toEqual([
      "Alpha needle",
      "Beta",
      "NEEDLE delta",
      "Epsilon",
    ]);
  });

  it("a body format carries the search and the filters as the bound view's conditions", () => {
    const sent = request(
      catalogTableStateQueries(undefined, view({ ...SEARCH, ...FILTER }))!,
      { kind: "body" },
    );
    expect(sent.warnings).toEqual([]);
    expect(sent.body?.where).toEqual({
      op: "and",
      items: [
        { fields: ["name", "score", "note"], op: "contains", value: "needle" },
        { fields: ["score"], op: "gte", value: 5 },
      ],
    });
  });

  it("a suffix format with a search parameter carries the text in it", () => {
    const sent = request(
      catalogTableStateQueries(undefined, view({ ...SEARCH, ...FILTER }))!,
      { kind: "suffix", searchParam: "q" },
    );
    expect(sent.warnings).toEqual([]);
    expect(sent.params).toEqual([
      ["q", "needle"],
      ["score_gte", "5"],
    ]);
  });

  it("a suffix format without one: the state never holds a search (never sent short)", () => {
    const service = { remote: true, format: { kind: "suffix" } } as const;
    expect(catalogTableSliceServable(service, "search")).toEqual({
      accepts: "none",
      reason: "suffixNoSearch",
    });
    const shape = { ...SHAPE, search: false };
    expect(catalogTableStateWith({}, SEARCH, shape)).toEqual({});
    // (The same search as an authored view's condition says what it cannot carry.)
    expect(
      request(catalogTableStateQueries(undefined, view(SEARCH))!, {
        kind: "suffix",
      }).warnings,
    ).toEqual([{ code: "MULTI_FIELD", conditionId: "table-search" }]);
  });
});

describe("where the search · a column filter run (breakdown §4.3.1)", () => {
  it("accepts them on rows that are all here, a body format, a suffix format that names them", () => {
    for (const slice of ["search", { filter: "startsWith" }] as const) {
      expect(catalogTableSliceServable({ remote: false }, slice).accepts).toBe(
        "whole",
      );
      expect(catalogTableSliceServable({ remote: true }, slice).accepts).toBe(
        "whole",
      );
      expect(
        catalogTableSliceServable(
          { remote: true, format: { kind: "body" } },
          slice,
        ).accepts,
      ).toBe("whole");
    }
    const suffix = { remote: true, format: { kind: "suffix" } } as const;
    // (The default suffix table names `contains` · `gte` · `between` (its two ends) — not
    //  `startsWith`.)
    expect(
      catalogTableSliceServable(suffix, { filter: "contains" }).accepts,
    ).toBe("whole");
    expect(
      catalogTableSliceServable(suffix, { filter: "between" }).accepts,
    ).toBe("whole");
    expect(catalogTableSliceServable(suffix, { filter: "startsWith" })).toEqual(
      {
        accepts: "none",
        reason: "suffixComparison",
      },
    );
    expect(
      catalogTableSliceServable(
        {
          remote: true,
          format: { kind: "suffix", suffixes: { startsWith: "_sw" } },
        },
        { filter: "startsWith" },
      ).accepts,
    ).toBe("whole");
  });

  it("the state holds one filter a column, of a comparison its Table takes", () => {
    const state = catalogTableStateWith(
      {},
      {
        columnFilters: [
          { column: "score", condition: { op: "gte", value: 1 } },
          { column: "gone", condition: { op: "gte", value: 1 } },
          { column: "name", condition: { op: "startsWith", value: "A" } },
          { column: "score", condition: { op: "lte", value: 7 } },
        ],
      },
      { ...SHAPE, filters: (op) => op !== "startsWith" },
    );
    // (The later `score` filter at its first place; no Column `gone`; `startsWith` not taken.)
    expect(state).toEqual({
      columnFilters: [{ column: "score", condition: { op: "lte", value: 7 } }],
    });
    // (Not a comparison: the write is not a value of the slice — nothing changes.)
    expect(
      catalogTableStateWith(
        state,
        { columnFilters: [{ column: "score", condition: { op: "like" } }] },
        SHAPE,
      ),
    ).toBe(state);
    expect(catalogTableStateWith(state, { columnFilters: [] }, SHAPE)).toEqual(
      {},
    );
  });

  it("a data slice changing goes back to the first page", () => {
    expect(catalogTableStateWith({ page: 3 }, SEARCH, SHAPE)).toEqual(SEARCH);
    expect(
      catalogTableStateWith({ page: 3, ...SEARCH }, FILTER, SHAPE),
    ).toEqual({ ...SEARCH, ...FILTER });
  });
});

describe("a filter control's candidate-values view and the list's request", () => {
  it("is not part of the request: the chain a request carries ends at the list's view", () => {
    const listView: ViewQuery = {
      where: { id: "where", op: "and", items: [] },
    };
    const facet: ViewQuery = {
      where: { id: "facet", op: "and", items: [] },
      groupBy: [["data:field:f-team"]],
      aggregates: [{ fn: "count", as: "count" }],
      facet: true,
    };
    // (The control's binding reads [list view, its candidate values]: the same request as the
    //  list's own — never a second view of the endpoint.)
    expect(catalogCountlessViews([listView, facet])).toEqual([listView]);
    const grouped: ViewQuery = { ...facet };
    delete (grouped as { facet?: true }).facet;
    expect(catalogCountlessViews([listView, grouped])).toEqual([
      listView,
      grouped,
    ]);
  });
});

describe("a fuzzy search (사용자 결정 2 — the Table's `searchMatch`)", () => {
  const FUZZY = { table: { searchMatch: "fuzzy" } };
  it("orders the rows by how well they match when the Table has no sort", () => {
    // 「ndl」: no row contains it — r1 · r2 · r4 · r5 hold n · d · l apart (in `needle`).
    expect(keys(here({ search: "ndl" }))).toEqual([]);
    expect(keys(here({ search: "ndl" }, FUZZY))?.sort()).toEqual([
      "r1",
      "r2",
      "r4",
      "r5",
    ]);
    // 「needle」: r4 begins with it (grade 1) · r1 has a word beginning with it (2) · r2 too
    // (`the needle`) · r5 `needles` begins with it (1) — grade, then the rows' own order.
    expect(keys(here({ search: "needle" }, FUZZY))).toEqual([
      "r4",
      "r5",
      "r1",
      "r2",
    ]);
  });

  it("keeps the Table's sort when it has one", () => {
    expect(
      keys(
        here(
          {
            search: "needle",
            sort: [{ column: "score", direction: "ascending" }],
          },
          FUZZY,
        ),
      ),
    ).toEqual(["r5", "r4", "r1", "r2"]);
  });

  it("is 「contains」 in a request (a request carries no grades)", () => {
    const slices = catalogTableStateRowSlices(SEARCH, COLUMNS, FUZZY.table);
    expect(slices?.search?.match).toBe("fuzzy");
    expect(catalogRowSlicesView(slices, SCHEMA)?.where?.[0]?.op).toBe(
      "contains",
    );
  });
});
