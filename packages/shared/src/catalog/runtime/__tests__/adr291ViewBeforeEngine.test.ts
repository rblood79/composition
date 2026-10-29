import { describe, expect, it } from "vitest";
import { loadFormulaEngine } from "../../../collections/formula/engine";
import { catalogBoundRows } from "../dataBinding";

/**
 * ADR-291 G7 (2026-10-29 live) — a view whose condition reads a computed field, read before the
 * formula engine loaded (a project opened · a reload): its cells were `null`, every row failed,
 * and the binding's view memo kept that empty result after the load — Canvas and Preview showed
 * 0 rows until the view changed. The engine load is part of the memo key. (No `beforeAll` load:
 * this file starts with the engine not loaded.)
 */
const SCHEMA = [
  { id: "o-id", key: "id", type: "string" },
  { id: "o-price", key: "price", type: "number" },
  { id: "o-qty", key: "qty", type: "number" },
  { id: "o-total", key: "total", type: "number", formula: "'o-price' * 'o-qty'" },
];
const ROWS = [
  { id: "kim", price: 10, qty: 2 },
  { id: "park", price: 11, qty: 2 },
];
const SOURCES = [
  {
    id: "orders",
    name: "Orders",
    schema: SCHEMA as never,
    mockData: ROWS as never,
    useMockData: true,
  },
];
const BINDING = {
  collectionId: "data:collection:orders" as const,
  fieldMap: {},
  query: {
    queries: [
      {
        where: {
          id: "where",
          op: "and" as const,
          items: [
            {
              id: "c",
              fields: [["data:field:o-total" as const]],
              op: "gt" as const,
              value: 20,
            },
          ],
        },
      },
    ],
    values: {},
    names: [],
  },
};

describe("ADR-291 — a computed field's view read before the engine loaded", () => {
  it("reads the rows again once the engine lands (the memo does not keep the null run)", async () => {
    const before = catalogBoundRows(BINDING, SOURCES)!;
    expect(before.map((row) => row.values.id)).toEqual([]);
    await loadFormulaEngine();
    const after = catalogBoundRows(BINDING, SOURCES)!;
    expect(after.map((row) => row.values.id)).toEqual(["park"]);
  });
});
