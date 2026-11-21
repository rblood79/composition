import { describe, expect, it } from "vitest";
import type {
  ViewConditionGroup,
  ViewQuery,
} from "../../../catalog/document/types";
import { validateCatalogEntry } from "../../../catalog/document/validation";
import {
  runViewQueries,
  viewResultSchema,
  type ViewRunField,
} from "../evaluate";
import { serializeViewQueries, viewQueryLimits } from "../serialize";

/**
 * ADR-315 사용자 결정 4 (2026-11-21) — TanStack's other built-in aggregates: `median` · `unique` ·
 * `uniqueCount` · `extent` · `first` · `last`, in the one evaluator (a view's grouping and a Table's
 * groups). Expected values are written by hand. A `body` endpoint runs them only when it says so.
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-team", key: "team", type: "string" },
  { id: "f-score", key: "score", type: "number" },
  { id: "f-tag", key: "tag", type: "string" },
  { id: "f-due", key: "due", type: "date" },
];
const ROWS = [
  { team: "A", score: 10, tag: "x", due: "2026-11-02" },
  { team: "B", score: 4, tag: "y", due: "2026-10-01" },
  { team: "A", score: 30, tag: "X", due: "2026-10-15" },
  { team: "A", score: "", tag: "x", due: "" },
  { team: "A", score: 20, tag: "", due: "2026-12-01" },
  { team: "B", score: 6, tag: "y", due: "2026-09-30" },
];
const NONE: ViewConditionGroup = { id: "where", op: "and", items: [] };
const f = (id: string) => [`data:field:${id}`] as never;
const GROUPED: ViewQuery = {
  where: NONE,
  groupBy: [f("f-team")],
  aggregates: [
    { fn: "median", field: f("f-score"), as: "median" },
    { fn: "unique", field: f("f-tag"), as: "tags" },
    { fn: "uniqueCount", field: f("f-tag"), as: "tagCount" },
    { fn: "extent", field: f("f-due"), as: "span" },
    { fn: "first", field: f("f-score"), as: "first" },
    { fn: "last", field: f("f-tag"), as: "last" },
  ],
};
const run = (queries: ViewQuery[], rows: readonly unknown[] = ROWS) =>
  runViewQueries(rows, {
    queries,
    schema: SCHEMA,
    resolve: (value) => ({ value }),
  });

describe("ADR-315 사용자 결정 4 — the six aggregates", () => {
  it("per group: median of the numbers (even = the two middles' mean), unique exact values in first-seen order, extent [min, max], first · last rows' cells as they are", () => {
    expect(run([GROUPED]).rows).toEqual([
      {
        team: "A",
        // (10 · 30 · 20 — the empty score is not a number → median 20.)
        median: 20,
        // ("x" and "X" are two values — a grouping's exact equality; the empty tag is not one.)
        tags: ["x", "X"],
        tagCount: 2,
        span: ["2026-10-15", "2026-12-01"],
        first: 10,
        // (The last row's tag is empty: first · last are the row's cell as it is.)
        last: "",
      },
      {
        team: "B",
        // (4 · 6 → (4 + 6) / 2.)
        median: 5,
        tags: ["y"],
        tagCount: 1,
        span: ["2026-09-30", "2026-10-01"],
        first: 4,
        last: "y",
      },
    ]);
  });

  it("no numbers → median null; no values → extent null, unique [] , uniqueCount 0; no rows' first is null", () => {
    expect(
      run([GROUPED], [{ team: "C", score: "", tag: "", due: "" }]).rows,
    ).toEqual([
      {
        team: "C",
        median: null,
        tags: [],
        tagCount: 0,
        span: null,
        first: "",
        last: "",
      },
    ]);
  });

  it("the result schema: median · uniqueCount numbers, unique · extent lists, first · last keep the field's type", () => {
    const fields = viewResultSchema(GROUPED, SCHEMA);
    expect(
      Object.fromEntries(fields.map((field) => [field.key, field.type])),
    ).toEqual({
      team: "string",
      median: "number",
      tags: "array",
      tagCount: "number",
      span: "array",
      first: "number",
      last: "string",
    });
  });
});

describe("ADR-315 Phase 5 — aggregates of decimals carry no float noise", () => {
  it("a sum is rounded to its inputs' most decimals, a mean · median snap only last-bits noise", () => {
    const rows = [{ v: 0.1 }, { v: 0.2 }, { v: 0.3 }];
    const schema: ViewRunField[] = [{ id: "f-v", key: "v", type: "number" }];
    const result = runViewQueries(rows, {
      queries: [
        {
          where: NONE,
          aggregates: [
            { fn: "sum", field: f("f-v"), as: "sum" },
            { fn: "mean", field: f("f-v"), as: "mean" },
            { fn: "median", field: f("f-v"), as: "median" },
          ],
        },
      ],
      schema,
      resolve: (value) => ({ value }),
    });
    // (In binary 0.1 + 0.2 + 0.3 = 0.6000000000000001 and ÷ 3 = 0.20000000000000004 — by hand
    //  0.6 · 0.2; the median is the middle cell, 0.2.)
    expect(result.rows).toEqual([{ sum: 0.6, mean: 0.2, median: 0.2 }]);
    const run = (values: number[]) =>
      runViewQueries(
        values.map((v) => ({ v })),
        {
          queries: [
            {
              where: NONE,
              aggregates: [
                { fn: "mean", field: f("f-v"), as: "mean" },
                { fn: "median", field: f("f-v"), as: "median" },
              ],
            },
          ],
          schema,
          resolve: (value) => ({ value }),
        },
      ).rows[0];
    // (Two middle cells: (0.1 + 0.2) / 2 — in binary 0.15000000000000002; by hand 0.15.)
    expect(run([0.1, 0.2])).toEqual({ mean: 0.15, median: 0.15 });
    // (A mean that is a repeating decimal keeps every digit a server's has — ADR-291 G5: 400 / 15,
    //  not 26.67.)
    expect(run([400, ...Array<number>(14).fill(0)])).toEqual({
      mean: 400 / 15,
      median: 0,
    });
  });
});

describe("ADR-315 사용자 결정 4 — a body endpoint runs them only when it says so", () => {
  const input = {
    queries: [GROUPED],
    schema: SCHEMA,
    resolve: () => undefined,
  };
  it("undeclared: the grouping is not sent, every row is loaded (`AGGREGATE` per aggregate)", () => {
    const served = serializeViewQueries({ kind: "body" }, input, "POST");
    expect(served.load).toBe("all");
    expect(served.body).not.toHaveProperty("group");
    expect(served.warnings.map((warning) => warning.aggregate)).toEqual([
      "median",
      "tags",
      "tagCount",
      "span",
      "first",
      "last",
    ]);
    expect(
      viewQueryLimits({ kind: "body" }, input, "POST").map((w) => w.code),
    ).toEqual(Array(6).fill("AGGREGATE"));
  });

  it("declared (`extendedAggregates`): the grouping goes whole, no warning", () => {
    const served = serializeViewQueries(
      { kind: "body", extendedAggregates: true },
      input,
      "POST",
    );
    expect(served.load).toBeUndefined();
    expect(served.warnings).toEqual([]);
    expect(served.body).toMatchObject({
      group: {
        by: ["team"],
        aggregates: [
          { fn: "median", field: "score", as: "median" },
          { fn: "unique", field: "tag", as: "tags" },
          { fn: "uniqueCount", field: "tag", as: "tagCount" },
          { fn: "extent", field: "due", as: "span" },
          { fn: "first", field: "score", as: "first" },
          { fn: "last", field: "tag", as: "last" },
        ],
      },
    });
  });

  it("the five of ADR-291 go undeclared as before", () => {
    const served = serializeViewQueries(
      { kind: "body" },
      {
        ...input,
        queries: [
          {
            where: NONE,
            groupBy: [f("f-team")],
            aggregates: [
              { fn: "count", as: "count" },
              { fn: "sum", field: f("f-score"), as: "total" },
            ],
          },
        ],
      },
      "POST",
    );
    expect(served.load).toBeUndefined();
    expect(served.body).toHaveProperty("group");
  });
});

describe("ADR-315 사용자 결정 4 — the document takes the six names", () => {
  const entryWith = (fn: string) => ({
    kind: "view",
    id: "project:view:v",
    name: "V",
    source: { collectionId: "data:collection:c" },
    where: NONE,
    groupBy: [f("f-team")],
    aggregates: [{ fn, field: f("f-score"), as: "a" }],
  });
  const refusal = (fn: string) => {
    try {
      validateCatalogEntry(entryWith(fn));
      return "";
    } catch (error) {
      return String((error as { code?: string }).code ?? error);
    }
  };
  it("validation accepts each and still refuses an unknown name", () => {
    for (const fn of [
      "median",
      "unique",
      "uniqueCount",
      "extent",
      "first",
      "last",
    ])
      expect(refusal(fn)).toBe("");
    expect(refusal("mode")).toMatch(/UNKNOWN_AGGREGATE/);
  });
});
