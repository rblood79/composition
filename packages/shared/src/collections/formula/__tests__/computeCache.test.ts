import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ViewQuery } from "../../../catalog/document/types";
import { runViewQueries } from "../../view/evaluate";
import { formulaCellErrors, withComputedCells } from "../compute";
import { formulaEngineSync, loadFormulaEngine } from "../engine";

/**
 * ADR-291 R6 — the computed cells are cached per rows and run key: a variable write re-runs the
 * view's conditions and sort, not the formulas (the cells read the rows · the formulas · the
 * variables they name · today · the language). A new rows array computes only the rows it has
 * not seen; `now()` is never served from the cache.
 */
beforeAll(() => loadFormulaEngine());
afterEach(() => vi.restoreAllMocks());

const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-price", key: "price", type: "number" },
  { id: "f-qty", key: "qty", type: "number" },
  {
    id: "f-total",
    key: "total",
    type: "number",
    formula: "'f-price' * 'f-qty'",
  },
];
const makeRows = () =>
  [1, 2, 3].map((i) => ({ id: `r${i}`, price: i * 10, qty: i }));
const runs = () => vi.spyOn(formulaEngineSync()!.formula, "run");
const f = (id: string) => [`data:field:${id}` as const];
const VIEW: ViewQuery = {
  where: {
    id: "where",
    op: "and",
    items: [{ id: "c", fields: [f("f-qty")], op: "gt", value: "!var.min" }],
  },
  sort: { field: f("f-total"), direction: "descending" },
};

describe("ADR-291 R6 — computed cell cache", () => {
  it("the same rows and run key give back the same rows without running a formula", () => {
    const rows = makeRows();
    const first = withComputedCells(rows, SCHEMA, { today: "2026-10-29" });
    const spy = runs();
    const again = withComputedCells(rows, SCHEMA, { today: "2026-10-29" });
    expect(again).toBe(first);
    expect(spy).not.toHaveBeenCalled();
    expect((again[2] as { total: number }).total).toBe(90);
  });

  it("a variable the formulas do not read: the view runs again, the formulas do not", () => {
    const rows = makeRows();
    const run = (min: number) =>
      runViewQueries(rows, {
        queries: [VIEW],
        schema: SCHEMA,
        today: "2026-10-29",
        resolve: (value) =>
          value === "!var.min" ? { value: min } : { value },
      });
    expect(run(0).rows.map((row) => (row as { id: string }).id)).toEqual([
      "r3",
      "r2",
      "r1",
    ]);
    const spy = runs();
    const next = run(1);
    expect(spy).not.toHaveBeenCalled();
    expect(next.rows.map((row) => (row as { total: number }).total)).toEqual([
      90, 40,
    ]);
  });

  it("a variable a formula reads is part of the key: its write computes again", () => {
    const rows = makeRows();
    const schema = [
      ...SCHEMA,
      {
        id: "f-scaled",
        key: "scaled",
        type: "number",
        formula: "'f-price' * $var_rate",
      },
    ];
    const at = (rate: number) =>
      withComputedCells(rows, schema, {
        today: "2026-10-29",
        resolve: (value) =>
          value === "!var.rate" ? { value: rate } : undefined,
      }) as { scaled: number }[];
    expect(at(2).map((row) => row.scaled)).toEqual([20, 40, 60]);
    expect(at(3).map((row) => row.scaled)).toEqual([30, 60, 90]);
    // (Both keys stay: going back is a hit.)
    const spy = runs();
    expect(at(2).map((row) => row.scaled)).toEqual([20, 40, 60]);
    expect(spy).not.toHaveBeenCalled();
  });

  it("a new rows array with one row replaced computes that row only", () => {
    const rows = makeRows();
    withComputedCells(rows, SCHEMA, { today: "2026-10-29" });
    const edited = rows.map((row, index) =>
      index === 1 ? { ...row, qty: 5 } : row,
    );
    const spy = runs();
    const next = withComputedCells(edited, SCHEMA, {
      today: "2026-10-29",
    }) as { total: number }[];
    expect(spy).toHaveBeenCalledTimes(1);
    expect(next.map((row) => row.total)).toEqual([10, 100, 90]);
  });

  it("a formula edit · another today are other keys; a row's error marker survives a hit", () => {
    const rows = [...makeRows(), { id: "r4", price: "x", qty: 1 }];
    const first = withComputedCells(rows, SCHEMA, { today: "2026-10-29" });
    expect(formulaCellErrors(first[3])).toBeDefined();
    expect(
      formulaCellErrors(
        withComputedCells(rows, SCHEMA, { today: "2026-10-29" })[3],
      ),
    ).toEqual(formulaCellErrors(first[3]));
    const spy = runs();
    const doubled = SCHEMA.map((field) =>
      field.formula ? { ...field, formula: "'f-price' * 'f-qty' * 2" } : field,
    );
    expect(
      (withComputedCells(rows, doubled, { today: "2026-10-29" })[2] as {
        total: number;
      }).total,
    ).toBe(180);
    const calls = spy.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
    withComputedCells(rows, SCHEMA, { today: "2026-10-30" });
    expect(spy.mock.calls.length).toBeGreaterThan(calls);
  });

  it("`now()` is the run's time — never served from the cache", () => {
    const rows = makeRows();
    const schema = [
      ...SCHEMA,
      { id: "f-at", key: "at", type: "number", formula: "now() * 0 + 'f-qty'" },
    ];
    withComputedCells(rows, schema);
    const spy = runs();
    withComputedCells(rows, schema);
    expect(spy).toHaveBeenCalled();
  });
});
