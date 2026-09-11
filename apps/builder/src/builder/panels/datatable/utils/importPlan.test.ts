/**
 * ADR-212 Phase 5 UX-3/M2 — import 계획. 붙여넣기/파일에서 온 행 + 기존 스키마 → 열별 매핑
 * (existing/new/ignore) + append/replace → 한 DataChange (replace_rows 또는 insert_rows + add_field).
 */
import { describe, expect, it } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import { planImport, importPlanToOps } from "./importPlan";

const schema: DataField[] = [
  { id: "f-id", key: "id", type: "number" },
  { id: "f-name", key: "name", type: "string" },
];
const rows = [
  { id: "1", name: "Ann", city: "NYC" },
  { id: "2", name: "Bob", city: "LA" },
];

describe("planImport", () => {
  it("기존 key 는 existing, 새 key 는 new, 타입 감지", () => {
    const plan = planImport(rows, schema);
    expect(plan.columns).toEqual([
      { sourceKey: "id", action: "existing", targetKey: "id", type: "number" },
      { sourceKey: "name", action: "existing", targetKey: "name", type: "string" },
      { sourceKey: "city", action: "new", targetKey: "city", type: "string" },
    ]);
    expect(plan.rowCount).toBe(2);
  });
});

describe("importPlanToOps", () => {
  it("replace + 새 열 추가 → add_field 먼저, 그 다음 replace_rows (강제 타입)", () => {
    const plan = planImport(rows, schema);
    const ops = importPlanToOps(plan, {
      collectionId: "c1",
      mode: "replace",
    });
    expect(ops).toEqual([
      { op: "add_field", collectionId: "c1", field: { key: "city", type: "string" } },
      {
        op: "replace_rows",
        collectionId: "c1",
        rows: [
          { id: 1, name: "Ann", city: "NYC" },
          { id: 2, name: "Bob", city: "LA" },
        ],
      },
    ]);
  });
  it("append → insert_rows (끝에)", () => {
    const plan = planImport([{ id: "3", name: "Cy" }], schema);
    const ops = importPlanToOps(plan, { collectionId: "c1", mode: "append", at: 5 });
    expect(ops).toEqual([
      { op: "insert_rows", collectionId: "c1", rows: [{ id: 3, name: "Cy" }], at: 5 },
    ]);
  });
  it("ignore 한 열은 add_field·행에서 빠진다", () => {
    const plan = planImport(rows, schema);
    plan.columns[2].action = "ignore"; // city 무시
    const ops = importPlanToOps(plan, { collectionId: "c1", mode: "replace" });
    expect(ops.some((o) => o.op === "add_field")).toBe(false);
    const replace = ops.find((o) => o.op === "replace_rows") as { rows: Record<string, unknown>[] };
    expect(replace.rows[0]).toEqual({ id: 1, name: "Ann" });
  });
  it("강제 실패 셀은 null (0 아님)", () => {
    const plan = planImport([{ id: "x", name: "Ann" }], schema);
    const ops = importPlanToOps(plan, { collectionId: "c1", mode: "replace" });
    const replace = ops.find((o) => o.op === "replace_rows") as { rows: Record<string, unknown>[] };
    expect(replace.rows[0]).toEqual({ id: null, name: "Ann" });
  });
});
