import { describe, expect, it } from "vitest";
import type {
  ViewConditionGroup,
  ViewQuery,
} from "../../../catalog/document/types";
import { catalogBoundRows } from "../../../catalog/runtime/dataBinding";
import { explainViewRow, runViewQueries, type ViewRunField } from "../evaluate";
import { viewQueryLimits } from "../serialize";

/**
 * ADR-284 Phase 4 (G4) — group · aggregate: one row per group with its group fields and its
 * aggregates, a count without grouping is the result count, the sort and a derived view read the
 * result's fields. Expected values are written by hand.
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-status", key: "status", type: "string" },
  { id: "f-points", key: "points", type: "number" },
  { id: "f-due", key: "due", type: "date" },
];
const ROWS = [
  { id: "t1", name: "Plan", status: "todo", points: 3, due: "2026-11-02" },
  { id: "t2", name: "Build", status: "doing", points: 8, due: "2026-11-09" },
  { id: "t3", name: "Test", status: "todo", points: 5, due: "2026-10-30" },
  { id: "t4", name: "Ship", status: "done", points: 2, due: "2026-11-20" },
  { id: "t5", name: "Docs", status: "todo", points: "", due: "" },
];
const NONE: ViewConditionGroup = { id: "where", op: "and", items: [] };
const statusIs = (value: string): ViewConditionGroup => ({
  id: "where",
  op: "and",
  items: [
    { id: "status", fields: [["data:field:f-status"]], op: "equals", value },
  ],
});
const run = (queries: ViewQuery[], rows: readonly unknown[] = ROWS) =>
  runViewQueries(rows, {
    queries,
    schema: SCHEMA,
    resolve: (value) => ({ value }),
  });

describe("ADR-284 G4 — group · aggregate", () => {
  it("groupBy + the five aggregates: one row per status in first-seen order; empty cells are not numbers", () => {
    const result = run([
      {
        where: NONE,
        groupBy: [["data:field:f-status"]],
        aggregates: [
          { fn: "count", as: "count" },
          { fn: "sum", field: ["data:field:f-points"], as: "total" },
          { fn: "mean", field: ["data:field:f-points"], as: "average" },
          { fn: "min", field: ["data:field:f-due"], as: "first" },
          { fn: "max", field: ["data:field:f-points"], as: "most" },
        ],
      },
    ]);
    expect(result.rows).toEqual([
      {
        status: "todo",
        count: 3,
        total: 8,
        average: 4,
        first: "2026-10-30",
        most: 5,
      },
      {
        status: "doing",
        count: 1,
        total: 8,
        average: 8,
        first: "2026-11-09",
        most: 8,
      },
      {
        status: "done",
        count: 1,
        total: 2,
        average: 2,
        first: "2026-11-20",
        most: 2,
      },
    ]);
    // (The result's fields: the group field as the source has it, then each aggregate by its name.)
    expect(result.schema).toEqual([
      { id: "f-status", key: "status", type: "string" },
      { id: "count", key: "count", type: "number" },
      { id: "total", key: "total", type: "number" },
      { id: "average", key: "average", type: "number" },
      { id: "first", key: "first", type: "date" },
      { id: "most", key: "most", type: "number" },
    ]);
  });

  it("a count without grouping is one row — the result count of the source view (0 when nothing matches)", () => {
    const count: ViewQuery = {
      where: NONE,
      aggregates: [{ fn: "count", as: "count" }],
    };
    expect(run([{ where: statusIs("todo") }, count]).rows).toEqual([
      { count: 3 },
    ]);
    expect(run([{ where: statusIs("blocked") }, count]).rows).toEqual([
      { count: 0 },
    ]);
  });

  it("a group with no rows: no row by default; `emptyGroups: all` keeps every value of the source rows", () => {
    const query = (emptyGroups?: "all"): ViewQuery => ({
      where: statusIs("todo"),
      groupBy: [["data:field:f-status"]],
      aggregates: [{ fn: "count", as: "count" }],
      ...(emptyGroups ? { emptyGroups } : {}),
    });
    expect(run([query()]).rows).toEqual([{ status: "todo", count: 3 }]);
    expect(run([query("all")]).rows).toEqual([
      { status: "todo", count: 3 },
      { status: "doing", count: 0 },
      { status: "done", count: 0 },
    ]);
  });

  it("the sort reads an aggregate (by its name) — a literal sort and a sort variable", () => {
    const grouped: ViewQuery = {
      where: NONE,
      groupBy: [["data:field:f-status"]],
      aggregates: [{ fn: "sum", field: ["data:field:f-points"], as: "total" }],
      sort: { field: ["data:field:total"], direction: "descending" },
    };
    expect(run([grouped]).rows.map((row) => (row as never)["status"])).toEqual([
      "todo",
      "doing",
      "done",
    ]);
    const ascending = runViewQueries(ROWS, {
      queries: [{ ...grouped, sort: { variableId: "data:variable:v" } }],
      schema: SCHEMA,
      resolve: (value) =>
        value === "!var.data:variable:v"
          ? { value: { column: "total", direction: "ascending" } }
          : { value },
    });
    expect(ascending.rows.map((row) => (row as never)["status"])).toEqual([
      "done",
      "todo",
      "doing",
    ]);
  });

  it("a view derived from a grouped view filters on an aggregate; the explanation reads the source's result fields", () => {
    const grouped: ViewQuery = {
      where: NONE,
      groupBy: [["data:field:f-status"]],
      aggregates: [{ fn: "count", as: "count" }],
    };
    const busy: ViewQuery = {
      where: {
        id: "where",
        op: "and",
        items: [
          { id: "many", fields: [["data:field:count"]], op: "gte", value: 2 },
        ],
      },
    };
    expect(run([grouped, busy]).rows).toEqual([{ status: "todo", count: 3 }]);
    const verdicts = explainViewRow(
      { status: "done", count: 1 },
      {
        queries: [grouped, busy],
        schema: SCHEMA,
        resolve: (value) => ({ value }),
      },
    );
    expect(verdicts.get("many")).toBe("miss");
  });

  it("a grouping · an aggregate field that does not resolve is reported broken (never a silent wrong count)", () => {
    const result = run([
      {
        where: NONE,
        groupBy: [["data:field:gone"]],
        aggregates: [{ fn: "sum", field: ["data:field:lost"], as: "total" }],
      },
    ]);
    expect(result.broken).toEqual(["groupBy", "aggregate:total"]);
  });

  it("an API format names a grouped view as not a request (GROUP)", () => {
    expect(
      viewQueryLimits(
        { kind: "suffix" },
        {
          queries: [
            { where: NONE, aggregates: [{ fn: "count", as: "count" }] },
          ],
          schema: SCHEMA,
        },
      ),
    ).toEqual([{ code: "GROUP" }]);
  });
});

describe("ADR-284 G4 — the count of 200 rows (§5a): before the display window", () => {
  const rows = Array.from({ length: 200 }, (_unused, index) => ({
    id: `r${index + 1}`,
    phase: index >= 100 ? "late" : "early",
  }));
  const collection = {
    id: "big",
    name: "Big",
    schema: [
      { id: "f-id", key: "id", type: "string" },
      { id: "f-phase", key: "phase", type: "string" },
    ],
    mockData: rows,
    useMockData: true,
  };
  const counted = (where: ViewConditionGroup) => ({
    collectionId: "data:collection:big" as const,
    fieldMap: { value: "data:field:count" as const },
    query: {
      queries: [
        { where },
        { where: NONE, aggregates: [{ fn: "count" as const, as: "count" }] },
      ] as ViewQuery[],
      values: {},
      names: [],
    },
  });
  const phase = (value: string): ViewConditionGroup => ({
    id: "where",
    op: "and",
    items: [
      { id: "phase", fields: [["data:field:f-phase"]], op: "equals", value },
    ],
  });

  it("r101..r200 match → 100; every row → 200 (the window of 100 does not cap the count)", () => {
    const late = catalogBoundRows(counted(phase("late")), [collection])!;
    expect(late).toHaveLength(1);
    expect(late[0]!.values).toMatchObject({ count: 100 });
    // (The binding's value field is the aggregate — read through the result's fields by id.)
    expect(late[0]!.values["value"]).toBe("100");
    const all = catalogBoundRows(counted(NONE), [collection])!;
    expect(all[0]!.values).toMatchObject({ count: 200 });
    expect(all.view).toMatchObject({ matched: 1, loaded: 200, complete: true });
  });

  it("over part of the data (an API page) a count says 「at least」 — never the whole (Decision 6)", () => {
    const api = {
      ...collection,
      useMockData: false,
      mockData: [],
      runtimeData: rows.slice(0, 120),
    };
    const partial = catalogBoundRows(
      {
        ...counted(phase("late")),
        query: { ...counted(phase("late")).query, loaded: { complete: false } },
      },
      [api],
    )!;
    expect(partial[0]!.values).toMatchObject({ count: "20+" });
    expect(partial.view?.complete).toBe(false);
  });

  it("a count of the view the server answered is the server's total; without one the loaded count is 「at least」", () => {
    const api = {
      ...collection,
      useMockData: false,
      mockData: [],
      runtimeData: rows.slice(100, 120),
    };
    const served = (total?: number) =>
      catalogBoundRows(
        {
          ...counted(phase("late")),
          query: {
            ...counted(phase("late")).query,
            served: {
              complete: false,
              depth: 1,
              ...(total !== undefined ? { total } : {}),
            },
          },
        },
        [api],
      )!;
    expect(served(100)[0]!.values).toMatchObject({ count: 100 });
    expect(served(100).view?.complete).toBe(true);
    expect(served()[0]!.values).toMatchObject({ count: "20+" });
  });
});
