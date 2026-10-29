import { beforeAll, describe, expect, it } from "vitest";
import type { ViewQuery } from "../../../catalog/document/types";
import { loadFormulaEngine } from "../../formula/engine";
import { explainViewRow, runViewQueries } from "../evaluate";

/**
 * ADR-291 G7 (2026-10-29 live) — the filter panel's row verdicts read a computed field's
 * condition on the source row: Park (total 22) showed 「no match · hidden」 under `total > 20`
 * while the Preview showed it. The verdict judges the row the run judges — computed cells written.
 */
beforeAll(() => loadFormulaEngine());

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
const VIEW: ViewQuery = {
  where: {
    id: "where",
    op: "and",
    items: [
      { id: "c", fields: [["data:field:o-total"]], op: "gt", value: 20 },
    ],
  },
};

describe("ADR-291 — the row verdict reads computed cells", () => {
  it("a computed field's condition: the verdict on the source row is the run's", () => {
    const input = {
      queries: [VIEW],
      schema: SCHEMA,
      resolve: (value: unknown) => ({ value }),
    };
    expect(
      runViewQueries(ROWS, input).rows.map((row) => (row as { id: string }).id),
    ).toEqual(["park"]);
    expect(explainViewRow(ROWS[0], input).get("c")).toBe("miss");
    expect(explainViewRow(ROWS[1], input).get("c")).toBe("match");
  });
});
