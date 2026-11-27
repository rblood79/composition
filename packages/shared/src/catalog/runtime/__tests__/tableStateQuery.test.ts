import { describe, expect, it } from "vitest";
import type { ViewQuery } from "../../document/types";
import {
  runViewQueries,
  type ViewRunField,
} from "../../../collections/view/evaluate";
import { serializeViewQueries } from "../../../collections/view/serialize";
import { catalogTableStateWith, type CatalogTableShape } from "../tableState";
import {
  catalogRowSlicesView,
  catalogTableSliceServable,
  catalogTableStateQueries,
  catalogTableFacetQueries,
} from "../tableStateQuery";
import { catalogTableStateRowSorts } from "../tableRowSlices";
import type { CatalogRowSorts } from "../tableSort";

/** A Table state's sort alone as a view (`catalogRowSlicesView` of its sorts). */
const sortsView = (sorts: CatalogRowSorts) =>
  catalogRowSlicesView({ sorts }, SCHEMA);
/**
 * ADR-315 Phase 2 (G2 · R2) — a Table state's sort as a view query: the same translation gives the
 * local order and the request, and both are the hand-written answer.
 *
 * The fixture is 리뷰 round 1 H1's: a page of 2, `team` ascending then `score` descending. Sent
 * whole the page is [s3, s2]; sent as its first sort alone it is [s1, s2] — s3 is not in that
 * answer, so the second sort cannot be made up for here.
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-team", key: "team", type: "string" },
  { id: "f-score", key: "score", type: "number" },
  { id: "f-joined", key: "joined", type: "date" },
];
const ROWS = [
  { id: "s1", team: "A", score: 1, joined: "2026-03-01" },
  { id: "s2", team: "A", score: 5, joined: "2025-12-31" },
  { id: "s3", team: "A", score: 9, joined: null },
  { id: "s4", team: "B", score: 3, joined: "2024-06-01" },
];
const COLUMNS = [
  { key: "id" },
  { key: "team" },
  { key: "score" },
  { key: "joined", sortEmptyValues: "first" },
];
const SHAPE: CatalogTableShape = {
  columns: [
    { key: "id", rowHeader: true },
    { key: "team" },
    { key: "score" },
    { key: "joined" },
  ],
  multiSort: true,
};
const TWO = [
  { column: "team", direction: "ascending" as const },
  { column: "score", direction: "descending" as const },
];
const ids = (rows: readonly unknown[]) =>
  rows.map((row) => (row as { id: string }).id);
const local = (queries: readonly ViewQuery[]) =>
  ids(
    runViewQueries(ROWS, {
      queries,
      schema: SCHEMA,
      resolve: () => undefined,
    }).rows,
  );
const request = (
  queries: readonly ViewQuery[],
  format: Parameters<typeof serializeViewQueries>[0],
) =>
  serializeViewQueries(
    format,
    { queries, schema: SCHEMA, resolve: () => undefined },
    format.kind === "body" ? "POST" : "GET",
  );
/** A server that sorts by the request's entries and cuts a page of 2 (by hand: a stable sort). */
const served = (
  sorts: readonly { field: string; direction: string }[],
  size = 2,
) =>
  ids(
    [...ROWS]
      .sort((a, b) => {
        for (const { field, direction } of sorts) {
          const x = (a as Record<string, unknown>)[field] as string | number;
          const y = (b as Record<string, unknown>)[field] as string | number;
          if (x === y) continue;
          return (x < y ? -1 : 1) * (direction === "descending" ? -1 : 1);
        }
        return 0;
      })
      .slice(0, size),
  );

describe("a Table state's sort → the view query", () => {
  it("translates the entries in order: the Column's field, its direction, its empty place", () => {
    const sorts = catalogTableStateRowSorts(
      [...TWO, { column: "joined", direction: "ascending" }],
      COLUMNS,
    );
    expect(sorts).toEqual([
      { key: "team", direction: "ascending" },
      { key: "score", direction: "descending" },
      { key: "joined", direction: "ascending", empty: "first" },
    ]);
    expect(sortsView(sorts)?.sort).toEqual([
      { field: ["data:field:f-team"], direction: "ascending" },
      { field: ["data:field:f-score"], direction: "descending" },
      {
        field: ["data:field:f-joined"],
        direction: "ascending",
        empty: "first",
      },
    ]);
  });

  it("drops an entry of no Column; a key the data has no field for is not a view's sort", () => {
    expect(
      catalogTableStateRowSorts(
        [{ column: "gone", direction: "ascending" }, TWO[0]!],
        COLUMNS,
      ),
    ).toEqual([{ key: "team", direction: "ascending" }]);
    expect(
      sortsView([{ key: "label", direction: "ascending" }]),
    ).toBeUndefined();
  });

  it("sorts the bound (last) view of the chain; a binding without a view gets one that only sorts", () => {
    const view = sortsView(catalogTableStateRowSorts(TWO, COLUMNS))!;
    const sort = view.sort!;
    expect(catalogTableStateQueries(undefined, view)).toEqual([
      { where: { id: "table-state", op: "and", items: [] }, sort },
    ]);
    const source: ViewQuery = { where: { id: "a", op: "and", items: [] } };
    const bound: ViewQuery = {
      where: { id: "b", op: "and", items: [] },
      sort: [{ field: ["data:field:f-id"], direction: "descending" }],
    };
    // (The state stands in for the authored sort — the run layer's value over the default.)
    expect(catalogTableStateQueries([source, bound], view)).toEqual([
      source,
      { ...bound, sort },
    ]);
    // (No state sort: the chain as authored — the same array.)
    const authored = [source, bound];
    expect(catalogTableStateQueries(authored, { sort: [] })).toBe(authored);
    expect(catalogTableStateQueries(authored, undefined)).toBe(authored);
  });
});

describe("the same translation — the local rows and the request (HC2)", () => {
  const queries = catalogTableStateQueries(
    undefined,
    sortsView(catalogTableStateRowSorts(TWO, COLUMNS)),
  )!;

  it("orders the rows here: team ↑ then score ↓", () => {
    // A9 · A5 · A1 · B3
    expect(local(queries)).toEqual(["s3", "s2", "s1", "s4"]);
  });

  it("a body format carries the whole list — the server's page of 2 is the local first 2", () => {
    const { body, warnings } = request(queries, { kind: "body", pageSize: 2 });
    expect(warnings).toEqual([]);
    expect(body?.sort).toEqual([
      { field: "team", direction: "ascending" },
      { field: "score", direction: "descending" },
    ]);
    expect(served(body!.sort as never)).toEqual(["s3", "s2"]);
    expect(served(body!.sort as never)).toEqual(local(queries).slice(0, 2));
  });

  it("a suffix format that takes a sort list carries it as comma lists", () => {
    const { params, warnings } = request(queries, {
      kind: "suffix",
      multiSort: true,
    });
    expect(warnings).toEqual([]);
    expect(params).toEqual([
      ["_sort", "team,score"],
      ["_order", "asc,desc"],
    ]);
  });

  it("a suffix format that takes one sort: the state never holds the second (never sent short)", () => {
    const servable = catalogTableSliceServable(
      { remote: true, format: { kind: "suffix" } },
      "sort",
    );
    expect(servable).toEqual({ accepts: "one", reason: "suffixSingle" });
    // (The session gives the Table's shape `multiSort` only when the slice is accepted whole: the
    //  second column replaces the first — one sort, the page the server cuts is that sort's.)
    const state = catalogTableStateWith(
      { sort: [TWO[0]!] },
      { sort: TWO },
      { ...SHAPE, multiSort: servable.accepts === "whole" },
    );
    expect(state.sort).toEqual([TWO[1]]);
    const one = catalogTableStateQueries(
      undefined,
      sortsView(catalogTableStateRowSorts(state.sort, COLUMNS)),
    )!;
    const { params, warnings } = request(one, { kind: "suffix" });
    expect(warnings).toEqual([]);
    expect(params).toEqual([
      ["_sort", "score"],
      ["_order", "desc"],
    ]);
    // (An authored view of two sorts on that format says what it could not send.)
    expect(request(queries, { kind: "suffix" }).warnings).toEqual([
      { code: "MULTI_SORT" },
    ]);
    // (H1 — the first sort alone gives another page: the reason the list is never sent short.)
    expect(served([{ field: "team", direction: "ascending" }])).toEqual([
      "s1",
      "s2",
    ]);
  });

  it("one entry is the request's object it always was", () => {
    const single = catalogTableStateQueries(
      undefined,
      sortsView(catalogTableStateRowSorts([TWO[1]!], COLUMNS)),
    )!;
    expect(request(single, { kind: "body" }).body?.sort).toEqual({
      field: "score",
      direction: "descending",
    });
  });
});

describe("where the sort runs (breakdown §4.3.1)", () => {
  it("accepts the whole list on rows that are all here, a body format, a sort-list suffix format", () => {
    expect(catalogTableSliceServable({ remote: false }, "sort")).toEqual({
      accepts: "whole",
    });
    expect(
      catalogTableSliceServable(
        { remote: true, format: { kind: "body" } },
        "sort",
      ),
    ).toEqual({ accepts: "whole" });
    expect(
      catalogTableSliceServable(
        { remote: true, format: { kind: "suffix", multiSort: true } },
        "sort",
      ),
    ).toEqual({ accepts: "whole" });
  });

  it("accepts one on an endpoint that reads `{{ sortDescriptor }}` — whatever its format", () => {
    expect(
      catalogTableSliceServable(
        { remote: true, readsSortTemplate: true, format: { kind: "body" } },
        "sort",
      ),
    ).toEqual({ accepts: "one", reason: "sortTemplate" });
  });
});

describe("the sort by the field's type (날짜 · 숫자 · 빈 값)", () => {
  const by = (column: string, direction: "ascending" | "descending") =>
    local(
      catalogTableStateQueries(
        undefined,
        sortsView(catalogTableStateRowSorts([{ column, direction }], COLUMNS)),
      )!,
    );

  it("orders a date column by time, its empty value where the Column says (first)", () => {
    // (empty first) · 2024-06-01 · 2025-12-31 · 2026-03-01
    expect(by("joined", "ascending")).toEqual(["s3", "s4", "s2", "s1"]);
    expect(by("joined", "descending")).toEqual(["s3", "s1", "s2", "s4"]);
  });

  it("orders a number column by value", () => {
    expect(by("score", "descending")).toEqual(["s3", "s2", "s4", "s1"]);
  });
});

it("날짜 후보를 구할 때 변환된 범위 묶음만 빼고 같은 ID의 작성자 조건은 보존한다", () => {
  const authored: ViewQuery = {
    where: {
      id: "author",
      op: "and",
      items: [
        {
          id: "day",
          fields: [["data:field:f-team"]],
          op: "equals",
          value: "A",
        },
      ],
    },
  };
  const queries = catalogTableFacetQueries(
    [authored],
    {
      where: [
        {
          id: "day",
          op: "or",
          items: [
            {
              id: "day~before",
              fields: [["data:field:f-score"]],
              op: "lt",
              value: 3,
            },
            {
              id: "day~after",
              fields: [["data:field:f-score"]],
              op: "gt",
              value: 7,
            },
          ],
        },
      ],
    },
    "data:field:f-score",
    "day",
  );
  const { rows } = runViewQueries(ROWS, {
    queries,
    schema: SCHEMA,
    resolve: (value) => ({ value }),
  });
  expect(rows).toMatchObject([{ score: 1 }, { score: 5 }, { score: 9 }]);
});
