import { describe, expect, it } from "vitest";
import type { ViewCondition, ViewConditionGroup } from "../../document/types";
import { catalogBoundRows } from "../dataBinding";
import { catalogTableStateRowSlices } from "../tableRowSlices";

/**
 * ADR-320 HC6 (G1) — a bound Table's rows under a filter tree, through the product's row path
 * (`catalogBoundRows` — the tree → row tests → the kept row numbers in the sort's order → the
 * window's rows). Node bench: run with `ADR320_BENCH=1` (`ADR320_BENCH_ROWS` · `ADR320_BENCH_RUNS`).
 *
 * Arms (each run changes a condition's value — a run is 「조건 변경 한 번」, never a memo hit):
 *   column   one root condition (a Column's filter — the path before ADR-320: the control)
 *   flat6    six root conditions (the fast path)
 *   tree6    six conditions, two levels, an `or`: c3 그리고 (c1 또는 c2 또는 (c4 그리고 c5)) 그리고 c6
 *
 * Q1: the rows are synthetic (seeded) — scale only. Q2: the unfavorable arm is `tree6` (an `or`
 * compares every row for each of its conditions) under a text sort. Q3: `column` is the control,
 * the arms alternate. The kept rows are checked against predicates written here (not the views'
 * comparison). Without the flag only that check runs (1,000 rows).
 */
const RUN = !!process.env.ADR320_BENCH;
const SIZES = (process.env.ADR320_BENCH_ROWS ?? (RUN ? "10000,100000" : "1000"))
  .split(",")
  .map(Number);
const RUNS = Number(process.env.ADR320_BENCH_RUNS ?? 21);

const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-dept", key: "dept", type: "string" },
  { id: "f-region", key: "region", type: "string" },
  { id: "f-status", key: "status", type: "string" },
  { id: "f-score", key: "score", type: "number" },
];
const COLUMNS = SCHEMA.slice(1).map((field) => ({ key: field.key }));
const DEPTS = ["sales", "dev", "ops", "hr", "fin", "legal", "mkt", "cs"];
const STATUSES = ["open", "closed", "hold"];
const NAMES = ["kim", "lee", "park", "choi", "jung", "kang", "cho", "yoon"];
interface Row {
  id: string;
  name: string;
  dept: string;
  region: string;
  status: string;
  score: number;
}
function rowsOf(count: number): Row[] {
  let seed = 4242;
  const next = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff);
  return Array.from({ length: count }, (_, index) => ({
    id: `r${index}`,
    name: `${NAMES[next() % NAMES.length]} ${index}`,
    dept: DEPTS[next() % DEPTS.length]!,
    region: `r${next() % 20}`,
    status: STATUSES[next() % STATUSES.length]!,
    score: next() % 101,
  }));
}
const cond = (
  id: string,
  field: string,
  op: ViewCondition["op"],
  value: ViewCondition["value"],
): ViewCondition => ({ id, fields: [[`data:field:f-${field}`]], op, value });
const and = (
  id: string,
  ...items: ViewConditionGroup["items"]
): ViewConditionGroup => ({ id, op: "and", items });
const or = (
  id: string,
  ...items: ViewConditionGroup["items"]
): ViewConditionGroup => ({ id, op: "or", items });

/** The arms' trees at a run's value `least` (the score bound the run changes). */
const TREES = {
  column: (least: number) => and("root", cond("c3", "score", "gte", least)),
  flat6: (least: number) =>
    and(
      "root",
      cond("c1", "dept", "equals", "sales"),
      cond("c2", "region", "oneOf", ["r1", "r2"]),
      cond("c3", "score", "gte", least),
      cond("c4", "status", "notEquals", "closed"),
      cond("c5", "name", "contains", "kim"),
      cond("c6", "score", "lt", 90),
    ),
  tree6: (least: number) =>
    and(
      "root",
      cond("c3", "score", "gte", least),
      or(
        "g1",
        cond("c1", "dept", "equals", "sales"),
        cond("c2", "region", "oneOf", ["r1", "r2"]),
        and(
          "g2",
          cond("c4", "status", "notEquals", "closed"),
          cond("c5", "name", "contains", "kim"),
        ),
      ),
      cond("c6", "score", "lt", 90),
    ),
};
/** The same conditions as predicates written here (the answer the arms are checked against). */
const ANSWERS: Record<
  keyof typeof TREES,
  (row: Row, least: number) => boolean
> = {
  column: (row, least) => row.score >= least,
  flat6: (row, least) =>
    row.dept === "sales" &&
    (row.region === "r1" || row.region === "r2") &&
    row.score >= least &&
    row.status !== "closed" &&
    row.name.includes("kim") &&
    row.score < 90,
  tree6: (row, least) =>
    row.score >= least &&
    (row.dept === "sales" ||
      row.region === "r1" ||
      row.region === "r2" ||
      (row.status !== "closed" && row.name.includes("kim"))) &&
    row.score < 90,
};
const median = (values: number[]) =>
  values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)]!;
const p95 = (values: number[]) =>
  values.slice().sort((a, b) => a - b)[
    Math.min(values.length - 1, Math.floor(values.length * 0.95))
  ]!;

describe("ADR-320 HC6 — a filter tree through the row path", () => {
  for (const size of SIZES)
    it(`${size.toLocaleString()} rows: the arms keep the rows the predicates keep${RUN ? " — timings" : ""}`, () => {
      const rows = rowsOf(size);
      const source = {
        id: "items",
        name: "Items",
        schema: SCHEMA,
        mockData: rows,
        useMockData: true,
      };
      const binding = {
        collectionId: "data:collection:items",
        fieldMap: {},
      };
      const run = (arm: keyof typeof TREES, least: number) =>
        catalogBoundRows(
          binding as never,
          [source as never],
          "items",
          100,
          0,
          catalogTableStateRowSlices(
            {
              filters: TREES[arm](least),
              // (a text sort: the kept rows are read in its order — made once, as a header press)
              sort: [{ column: "name", direction: "ascending" }],
            },
            COLUMNS,
          ),
        )!;
      const arms = Object.keys(TREES) as (keyof typeof TREES)[];
      // (the answer: the rows the predicate keeps, the first 100 by name — the window's rows)
      for (const arm of arms) {
        const kept = rows.filter((row) => ANSWERS[arm](row, 50));
        const got = run(arm, 50);
        expect(got.length, arm).toBe(Math.min(100, kept.length));
        const allowed = new Set(kept.map((row) => row.id));
        expect(
          got.every((row) => allowed.has(String(row.values.id))),
          arm,
        ).toBe(true);
      }
      if (!RUN) return;
      const times: Record<string, number[]> = {};
      for (const arm of arms) times[arm] = [];
      // (warm-up: the sort's order and the JIT)
      for (let index = 0; index < 5; index += 1)
        for (const arm of arms) run(arm, 60 + index);
      for (let index = 0; index < RUNS; index += 1) {
        // (alternate the order; a new bound each run — no memo hit)
        const order = index % 2 ? [...arms].reverse() : arms;
        for (const arm of order) {
          const least = 1 + ((index * 7 + arms.indexOf(arm)) % 49);
          const start = performance.now();
          run(arm, least);
          times[arm]!.push(performance.now() - start);
        }
      }
      const line = arms
        .map(
          (arm) =>
            `${arm} ${median(times[arm]!).toFixed(2)} ms (p95 ${p95(times[arm]!).toFixed(2)})`,
        )
        .join(" · ");
      console.info(`[adr320-bench] ${size.toLocaleString()} rows — ${line}`);
    });
});
