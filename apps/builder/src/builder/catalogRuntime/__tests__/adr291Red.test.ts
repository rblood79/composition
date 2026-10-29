import { describe, expect, it } from "vitest";
import type { DataField, DataTable } from "../../../types/builder/data.types";
import { codeViewDataOf } from "../codeView";

/**
 * ADR-291 Phase 0 G0 — RED ⑦ (`it.fails`): the code view's data projection drops a field's
 * `formula`; the same formula under `type: "number"` and `type: "string"` must stay two fields
 * (review m3 — the existing `type` carries the result type, `formula` marks the computed column).
 */
const field = (key: string, type: DataField["type"], formula: string) =>
  ({ id: `f-${key}`, key, type, formula }) as DataField;
const TABLE: DataTable = {
  id: "orders",
  name: "Orders",
  project_id: "p",
  schema: [
    { id: "f-price", key: "price", type: "number" },
    { id: "f-qty", key: "qty", type: "number" },
    field("total", "number", "'f-price' * 'f-qty'"),
    field("label", "string", "'f-price' * 'f-qty'"),
  ],
  mockData: [],
  useMockData: true,
};

describe("ADR-291 Phase 0 RED — the code view's data today", () => {
  // (Phase 3 turned ⑦ GREEN — `codeViewDataOf` keeps `formula`.)
  it(
    "⑦ `codeViewDataOf` keeps `formula` with the field's own `type` (number · string of one formula stay distinct)",
    () => {
      const [collection] = codeViewDataOf([TABLE], []).collections;
      const computed = collection!.schema.filter(
        (item) => (item as { formula?: string }).formula,
      );
      expect(computed).toEqual([
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
          formula: "'f-price' * 'f-qty'",
        },
      ]);
    },
  );
});
