import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadFormulaEngine } from "../engine";
import { runViewQueries } from "../../view/evaluate";
import type { ViewQuery } from "../../../catalog/document/types";

/**
 * ADR-291 G6 — node bench (run with `ADR291_G6=1`; `ADR291_G6_OUT=<file>` writes the table):
 * 1,000 rows × 5 formulas (arithmetic · string concatenation · date difference · condition ·
 * array sum) evaluated through the view evaluator (`withComputedCells` inside `runViewQueries`),
 * median of 100 runs × 2 repeats; the control arm is the same view over the schema without the
 * formulas. Gate: ≤ 16 ms per evaluation · ≤ 16 ms per re-evaluation after a variable change
 * (100 changes). An evaluation reads fresh row objects every run (the first read of loaded data —
 * the computed cell cache cannot serve it); a variable change re-runs over the same rows (the
 * cache's case, R6). Q1: the rows are synthetic — scale only (no distribution claims); Q2: the
 * unfavorable cases are the date and string formulas; Q3: the control arm. The run without the
 * flag only checks the arms produce the same row count (the shape, not the time).
 */
const RUN = !!process.env.ADR291_G6;
const RUNS = Number(process.env.ADR291_G6_RUNS ?? 100);
const ROWS = 1000;

const SCHEMA_PLAIN = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-price", key: "price", type: "number" },
  { id: "f-qty", key: "qty", type: "number" },
  { id: "f-due", key: "due", type: "date" },
  { id: "f-items", key: "items", type: "array" },
];
const SCHEMA = [
  ...SCHEMA_PLAIN,
  {
    id: "f-total",
    key: "total",
    type: "number",
    formula: "'f-price' * 'f-qty'",
  },
  {
    id: "f-label",
    key: "label",
    type: "string",
    formula: "'f-name' & \" × \" & 'f-qty'",
  },
  {
    id: "f-days",
    key: "days",
    type: "number",
    formula: "datedif(today(), 'f-due', \"d\")",
  },
  {
    id: "f-late",
    key: "late",
    type: "boolean",
    formula: "'f-due' < today() && 'f-qty' > 0",
  },
  {
    id: "f-sum",
    key: "sum",
    type: "number",
    formula: "sum('f-items'[*].v)",
  },
];
const makeRows = () => Array.from({ length: ROWS }, (_, i) => ({
  id: `r${i}`,
  name: `Order ${i}`,
  price: (i * 37) % 1000,
  qty: (i % 7) + 1,
  due: `2026-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
  items: [{ v: i % 10 }, { v: (i * 3) % 10 }, { v: 1 }],
}));
const rows = makeRows();
const f = (id: string) => [`data:field:${id}` as const];
/** A view that reads the computed fields: a condition on `late`, sorted by `total`. */
const VIEW: ViewQuery = {
  where: {
    id: "where",
    op: "and",
    items: [
      { id: "c1", fields: [f("f-late")], op: "equals", value: true },
      { id: "c2", fields: [f("f-qty")], op: "gt", value: "!var.min" },
    ],
  },
  sort: { field: f("f-total"), direction: "descending" },
};
const VIEW_PLAIN: ViewQuery = {
  where: {
    id: "where",
    op: "and",
    items: [
      { id: "c2", fields: [f("f-qty")], op: "gt", value: "!var.min" },
    ],
  },
  sort: { field: f("f-price"), direction: "descending" },
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

function run(
  schema: typeof SCHEMA,
  view: ViewQuery,
  min: number,
  source: readonly unknown[] = rows,
) {
  return runViewQueries(source, {
    queries: [view],
    schema,
    today: "2026-06-15",
    resolve: (value) =>
      typeof value === "string" && value === "!var.min"
        ? { value: min }
        : { value },
  });
}

function bench(label: string, schema: typeof SCHEMA, view: ViewQuery) {
  const repeats = [0, 1].map(() => {
    const times: number[] = [];
    const fresh = Array.from({ length: RUNS }, makeRows);
    for (let i = 0; i < RUNS; i += 1) {
      const s = performance.now();
      run(schema, view, 2, fresh[i]);
      times.push(performance.now() - s);
    }
    const variable: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      const s = performance.now();
      run(schema, view, i % 7);
      variable.push(performance.now() - s);
    }
    return { eval: median(times), variable: median(variable) };
  });
  return { label, repeats };
}

describe("ADR-291 G6 — 1,000 rows × 5 formulas through the evaluator", () => {
  it(
    RUN ? "bench (median of 100 × 2)" : "shape only (set ADR291_G6=1 to time)",
    async () => {
      await loadFormulaEngine();
      const withFormulas = run(SCHEMA, VIEW, 2);
      const plain = run(SCHEMA_PLAIN as typeof SCHEMA, VIEW_PLAIN, 2);
      expect(withFormulas.rows.length).toBeGreaterThan(0);
      expect(plain.rows.length).toBeGreaterThan(0);
      // (A computed cell is on every row of the result.)
      expect(
        withFormulas.rows.every(
          (row) => typeof (row as { total?: unknown }).total === "number",
        ),
      ).toBe(true);
      if (!RUN) return;
      const results = [
        bench("formulas 5 (condition late · sort total)", SCHEMA, VIEW),
        bench(
          "control — no formula (condition qty · sort price)",
          SCHEMA_PLAIN as typeof SCHEMA,
          VIEW_PLAIN,
        ),
      ];
      const lines = results.flatMap((result) =>
        result.repeats.map(
          (repeat, index) =>
            `| ${result.label} | ${index + 1} | ${repeat.eval.toFixed(2)} | ${repeat.variable.toFixed(2)} |`,
        ),
      );
      const table = [
        `| arm | repeat | eval (ms, median of ${RUNS}) | per variable change (ms, median of 100) |`,
        "| --- | --- | --- | --- |",
        ...lines,
      ].join("\n");
      console.log(
        `\nADR-291 G6 (node ${process.version}, ${ROWS} rows)\n${table}\n`,
      );
      if (process.env.ADR291_G6_OUT)
        writeFileSync(process.env.ADR291_G6_OUT, `${table}\n`);
      for (const result of results.slice(0, 1))
        for (const repeat of result.repeats) {
          expect(repeat.eval).toBeLessThanOrEqual(16);
          expect(repeat.variable).toBeLessThanOrEqual(16);
        }
    },
  );
});
