import { beforeAll, describe, expect, it } from "vitest";
import {
  coerceFormulaResult,
  formulaCellErrors,
  withComputedCells,
} from "../compute";
import { dateTextToDays, daysToDateText, loadFormulaEngine } from "../engine";

/**
 * ADR-291 G2 — result types and the date bridge, hand-computed: number · string · boolean · date
 * results (3 each), date edges (month end · leap day · a zoned instant · null), a row's failure
 * (a type error · 1/0) as `null` + a cell marker, a computed field reading another, `today()`
 * from the run's `today`, a `$var_<id>` from `resolve`.
 */
beforeAll(() => loadFormulaEngine());
const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-price", key: "price", type: "number" },
  { id: "f-qty", key: "qty", type: "number" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-due", key: "due", type: "date" },
  { id: "f-done", key: "done", type: "boolean" },
];
const compute = (
  fields: { id: string; key: string; type: string; formula: string }[],
  rows: Record<string, unknown>[],
  input: Parameters<typeof withComputedCells>[2] = { today: "2026-10-29" },
) =>
  withComputedCells(rows, [...SCHEMA, ...fields], input) as Record<
    string,
    unknown
  >[];
const one = (
  type: string,
  formula: string,
  row: Record<string, unknown>,
  input?: Parameters<typeof withComputedCells>[2],
) => compute([{ id: "f-x", key: "x", type, formula }], [row], input)[0]!;
const ROW = {
  id: "o1",
  price: 10,
  qty: 3,
  name: "Kim",
  due: "2026-11-03",
  done: false,
};

describe("ADR-291 G2 — result types", () => {
  it("number: arithmetic · a numeric text · a count", () => {
    expect(one("number", "'f-price' * 'f-qty'", ROW).x).toBe(30);
    expect(one("number", "toNumber(\"4.5\") + 'f-qty'", ROW).x).toBe(7.5);
    expect(one("number", "length('f-name')", ROW).x).toBe(3);
  });
  it("string: concatenation · a number as text · a function", () => {
    expect(one("string", "'f-name' & \" — \" & 'f-id'", ROW).x).toBe(
      "Kim — o1",
    );
    expect(one("string", "'f-price' * 'f-qty'", ROW).x).toBe("30");
    expect(one("string", "upper('f-name')", ROW).x).toBe("KIM");
  });
  it("boolean: a comparison · `not` · `if`", () => {
    expect(one("boolean", "'f-price' > 5", ROW).x).toBe(true);
    expect(one("boolean", "not('f-done')", ROW).x).toBe(true);
    expect(one("boolean", "if('f-qty' > 5, true(), false())", ROW).x).toBe(
      false,
    );
  });
  it("date: a day number back as text · a date text through · the same instant", () => {
    expect(one("date", "'f-due' + 7", ROW).x).toBe("2026-11-10");
    expect(one("date", "'f-due'", ROW).x).toBe("2026-11-03");
    expect(one("date", 'toDate("2026-10-25T09:00:00Z")', ROW).x).toBe(
      "2026-10-25T09:00:00.000Z",
    );
  });
  it("a value the type cannot hold is `null` with a `FORMULA_RESULT_TYPE` marker (no quiet text)", () => {
    const row = one("number", "'f-name'", ROW);
    expect(row.x).toBeNull();
    expect(formulaCellErrors(row)).toEqual({ x: "FORMULA_RESULT_TYPE" });
    expect(one("boolean", "'f-price'", ROW).x).toBeNull();
    expect(one("date", "'f-name'", ROW).x).toBeNull();
  });
});

describe("ADR-291 G2 — the date bridge", () => {
  it("day numbers are UTC days; a whole day writes `YYYY-MM-DD`, a fraction the instant", () => {
    expect(dateTextToDays("1970-01-02")).toBe(1);
    expect(dateTextToDays("2026-10-29")).toBe(20755);
    expect(daysToDateText(20755)).toBe("2026-10-29");
    expect(daysToDateText(20755.5)).toBe("2026-10-29T12:00:00.000Z");
    expect(dateTextToDays("2026-10-25T09:00:00Z")).toBe(20751.375);
    expect(dateTextToDays("not a date")).toBeUndefined();
  });
  it("edges: month end · leap day · a zoned instant · null", () => {
    expect(one("date", "'f-due' + 28", { ...ROW, due: "2026-01-31" }).x).toBe(
      "2026-02-28",
    );
    expect(one("date", "'f-due' + 1", { ...ROW, due: "2028-02-28" }).x).toBe(
      "2028-02-29",
    );
    expect(
      one("number", "'f-due' - toDate(\"2026-10-29\")", {
        ...ROW,
        due: "2026-10-30T09:00:00+09:00",
      }).x,
    ).toBe(1);
    expect(
      one("number", 'datedif(toDate("2026-10-01"), \'f-due\', "d")', ROW).x,
    ).toBe(33);
    const missing = one("number", "'f-due' - 1", { ...ROW, due: null });
    expect(missing.x).toBe(-1);
  });
  it("`today()` · `now()` read the run's `today` — the same input, the same cells", () => {
    expect(one("number", "'f-due' - today()", ROW).x).toBe(5);
    expect(
      one("number", "'f-due' - today()", ROW, { today: "2026-11-01" }).x,
    ).toBe(2);
    expect(one("date", "now()", ROW).x).toBe("2026-10-29");
  });
});

describe("ADR-291 G2 — rows · errors · dependencies · variables", () => {
  it("a row's failure is `null` + a marker; the other rows and cells go on", () => {
    const rows = compute(
      [{ id: "f-x", key: "x", type: "number", formula: "'f-price' / 'f-qty'" }],
      [ROW, { ...ROW, id: "o2", qty: 0 }, { ...ROW, id: "o3", price: 1 }],
    );
    expect(rows.map((row) => row.x)).toEqual([10 / 3, null, 1 / 3]);
    expect(formulaCellErrors(rows[1])).toEqual({ x: "EvaluationError" });
    expect(formulaCellErrors(rows[0])).toBeUndefined();
  });
  it("the source rows are untouched; a schema without formulas returns the same array", () => {
    const source = [{ ...ROW }];
    const rows = compute(
      [{ id: "f-x", key: "x", type: "number", formula: "1" }],
      source,
    );
    expect(rows[0]).not.toBe(source[0]);
    expect(source[0]).not.toHaveProperty("x");
    expect(withComputedCells(source, SCHEMA)).toBe(source);
  });
  it("a computed field reads another, in dependency order whatever the schema order", () => {
    const rows = compute(
      [
        { id: "f-tax", key: "tax", type: "number", formula: "'f-total' * 0.1" },
        {
          id: "f-total",
          key: "total",
          type: "number",
          formula: "'f-price' * 'f-qty'",
        },
      ],
      [ROW],
    );
    expect(rows[0]!.total).toBe(30);
    expect(rows[0]!.tax).toBe(3);
  });
  it("`$var_<id>` reads the run's variable through `resolve`; an unresolved one is null", () => {
    const resolve = (value: unknown) =>
      value === "!var.rate" ? { value: 2 } : undefined;
    expect(one("number", "'f-price' * $var_rate", ROW, { resolve }).x).toBe(20);
    expect(one("number", "'f-price' * $var_other", ROW, { resolve }).x).toBe(0);
  });
  it("`type` coercion table", () => {
    expect(coerceFormulaResult(null, "number")).toBeNull();
    expect(coerceFormulaResult("12", "number")).toBe(12);
    expect(coerceFormulaResult("x", "number")).toBeUndefined();
    expect(coerceFormulaResult(true, "string")).toBe("true");
    expect(coerceFormulaResult([1], "string")).toBeUndefined();
    expect(coerceFormulaResult(0, "boolean")).toBeUndefined();
  });
});
