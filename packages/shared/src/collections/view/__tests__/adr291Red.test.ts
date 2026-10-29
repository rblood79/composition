import { beforeAll, describe, expect, it } from "vitest";
import { loadFormulaEngine } from "../../formula/engine";
import type {
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../../catalog/document/types";
import {
  CatalogValidationError,
  validateCatalogEntry,
} from "../../../catalog/document/validation";
import { catalogBoundRows } from "../../../catalog/runtime/dataBinding";
import { runViewQueries, type ViewRunField } from "../evaluate";
import { serializeViewQueries } from "../serialize";

/**
 * ADR-291 Phase 0 G0 — RED (`it.fails`): what the data layer does today that the ADR changes.
 * Each turns into a plain `it` in the phase that makes it pass (breakdown §1d). Expected values
 * are hand-computed (never regenerated from the evaluator).
 *
 * Formulas are stored over field **ids** (Decision 2 — `'f-price' * 'f-qty'`), so a rename of the
 * key leaves them untouched; the spike's key form is not what these assert.
 */
type Field = ViewRunField & { formula?: string };
const field = (
  id: string,
  key: string,
  type: string,
  formula?: string,
): ViewRunField =>
  ({ id, key, type, ...(formula ? { formula } : {}) }) as Field;
const SCHEMA: ViewRunField[] = [
  field("f-id", "id", "string"),
  field("f-price", "price", "number"),
  field("f-qty", "qty", "number"),
  field("f-city", "city", "string"),
  field("f-items", "items", "array"),
  // total = price × qty (number) · label = the same formula as a string (RED ⑦ — m3).
  field("f-total", "total", "number", "'f-price' * 'f-qty'"),
  field("f-label", "label", "string", "'f-price' * 'f-qty'"),
  // RED ⑧ (h2): `items[*].price` is a JSON sub-property — only `items` is a root reference.
  field("f-sum", "sum", "number", "sum('f-items'[*].price)"),
  // RED ⑧ (Round 2 h2): `@` keeps the root row — `@.'f-price'` is a root reference.
  field("f-cur", "cur", "number", "@.'f-price' * 'f-qty'"),
];
const ROWS = [
  {
    id: "o1",
    price: 10,
    qty: 2,
    city: "Seoul",
    items: [{ price: 10 }, { price: 20 }],
  },
  { id: "o2", price: 11, qty: 2, city: "Seoul", items: [] },
];
const where = (
  items: ViewConditionGroup["items"] = [],
): ViewConditionGroup => ({
  id: "where",
  op: "and",
  items,
});
const c = (
  id: string,
  op: ViewCondition["op"],
  fieldId: string,
  value?: ViewCondition["value"],
): ViewCondition => ({
  id,
  fields: [[`data:field:${fieldId}`]],
  op,
  ...(value !== undefined ? { value } : {}),
});
const run = (
  query: ViewQuery,
  schema: ViewRunField[] = SCHEMA,
  rows: readonly unknown[] = ROWS,
) =>
  runViewQueries(rows, {
    queries: [query],
    schema,
    resolve: (value) => ({ value }),
    today: "2026-10-29",
  });
const cell = (row: unknown, key: string) =>
  (row as Record<string, unknown>)[key];
const collection = (schema: ViewRunField[] = SCHEMA, rows = ROWS) => ({
  id: "orders",
  name: "Orders",
  schema: schema as never,
  mockData: rows as never,
  useMockData: true,
});
const BINDING = {
  collectionId: "data:collection:orders" as const,
  fieldMap: {},
};
/** The schema with `price` renamed to `unitPrice` (the id stays — ADR-152) and rows to match. */
const RENAMED = SCHEMA.map((item) =>
  item.id === "f-price" ? { ...item, key: "unitPrice" } : item,
);
const RENAMED_ROWS = ROWS.map(({ price, ...rest }) => ({
  ...rest,
  unitPrice: price,
}));

describe("ADR-291 Phase 0 RED — the data layer today", () => {
  // (Phase 1 turned ① ④ ⑧ GREEN — the formula module; Phase 3 ② ③ ⑤ ⑥ — the row sources · the serializer. The engine
  // loads before the sync paths.)
  beforeAll(() => loadFormulaEngine());
  it(
    "① a `formula` field of the schema is a cell of the evaluator's rows (price × qty = 20)",
    () => {
      const { rows } = run({ where: where() });
      expect(rows.map((row) => cell(row, "total"))).toEqual([20, 22]);
    },
  );

  it(
    "② a binding with no view still carries the computed cell (the evaluator does not run today)",
    () => {
      const bound = catalogBoundRows(BINDING, [collection()])!;
      expect(bound.map((row) => row.values.total)).toEqual([20, 22]);
    },
  );

  it(
    "③ rows the server answered (`served`) carry the computed cell too",
    () => {
      const bound = catalogBoundRows(
        {
          ...BINDING,
          query: {
            queries: [{ where: where() }],
            values: {},
            names: [],
            served: { complete: true },
          },
        },
        [collection()],
      )!;
      expect(bound.map((row) => row.values.total)).toEqual([20, 22]);
    },
  );

  it(
    "④ a rename of the key (`price` → `unitPrice`) leaves the formula's value (id-stored)",
    () => {
      const { rows } = run({ where: where() }, RENAMED, RENAMED_ROWS);
      expect(rows.map((row) => cell(row, "total"))).toEqual([20, 22]);
    },
  );

  it(
    "⑤ a view over a computed field cannot go to the server — `COMPUTED` reported, no `group` in the body (h1: groupBy(raw) + sum(total) = 42 locally)",
    () => {
      const resolve = (value: unknown) => ({ value });
      const filtered = serializeViewQueries(
        { kind: "body" },
        {
          queries: [{ where: where([c("big", "gt", "f-total", 15)]) }],
          schema: SCHEMA,
          resolve,
        },
        "POST",
      );
      expect(filtered.warnings.map((warning) => warning.code)).toContain(
        "COMPUTED",
      );
      const grouped: ViewQuery = {
        where: where(),
        groupBy: [["data:field:f-city"]],
        aggregates: [{ fn: "sum", field: ["data:field:f-total"], as: "sum" }],
      };
      const request = serializeViewQueries(
        { kind: "body" },
        { queries: [grouped], schema: SCHEMA, resolve },
        "POST",
      );
      expect(request.warnings.map((warning) => warning.code)).toContain(
        "COMPUTED",
      );
      expect(request.body?.group).toBeUndefined();
      expect(request.load).toBe("all");
      // (The whole chain runs locally — the aggregate reads the computed cell: 20 + 22.)
      const { rows } = run(grouped);
      expect(rows.map((row) => cell(row, "sum"))).toEqual([42]);
    },
  );

  it(
    "⑥ a `body` endpoint carries a grouping · aggregates over raw fields as `group` (today: `GROUP` warning, local)",
    () => {
      const grouped: ViewQuery = {
        where: where(),
        groupBy: [["data:field:f-city"]],
        aggregates: [{ fn: "sum", field: ["data:field:f-price"], as: "sum" }],
      };
      const request = serializeViewQueries(
        { kind: "body" },
        { queries: [grouped], schema: SCHEMA, resolve: (value) => ({ value }) },
        "POST",
      );
      expect(request.warnings.map((warning) => warning.code)).not.toContain(
        "GROUP",
      );
      expect(request.body).toMatchObject({
        group: {
          by: ["city"],
          aggregates: [{ fn: "sum", field: "price", as: "sum" }],
        },
      });
    },
  );

  it(
    "⑧ scope: `sum('f-items'[*].price)` = 30 (root `items` only) · `@.'f-price' * 'f-qty'` = 20 before and after the rename",
    () => {
      const { rows } = run({ where: where() });
      expect(cell(rows[0], "sum")).toBe(30);
      expect(rows.map((row) => cell(row, "cur"))).toEqual([20, 22]);
      const renamed = run({ where: where() }, RENAMED, RENAMED_ROWS);
      expect(renamed.rows.map((row) => cell(row, "cur"))).toEqual([20, 22]);
    },
  );

  it(
    "⑧ definition: a formula over an unknown root id · an unclassifiable shape is refused with a `FORMULA_*` code (today: `formula` is not a field key at all)",
    () => {
      const entry = (formula: string) => ({
        kind: "collection",
        id: "data:collection:orders",
        name: "Orders",
        schema: [
          { id: "f-price", key: "price", type: "number" },
          { id: "f-x", key: "x", type: "number", formula },
        ],
        mockData: [],
        useMockData: true,
      });
      const codeOf = (formula: string) => {
        try {
          validateCatalogEntry(entry(formula));
          return "ACCEPTED";
        } catch (error) {
          return error instanceof CatalogValidationError ? error.code : "OTHER";
        }
      };
      expect(codeOf("'f-price' * 2")).toBe("ACCEPTED");
      expect(codeOf("'f-nope' * 2")).toMatch(/^FORMULA_/);
      // (A projection over a function's result — the tracker cannot classify what `price` applies to.)
      expect(codeOf("sum(values(@)[*].price)")).toBe(
        "FORMULA_SCOPE_UNSUPPORTED",
      );
    },
  );
});
