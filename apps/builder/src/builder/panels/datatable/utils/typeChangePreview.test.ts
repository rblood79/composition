/**
 * ADR-212 Phase 3 UX-5 — 타입 변경 미리보기. 새 타입으로 강제 실패하는 행을 세고, "비움" 선택
 * 시 그 셀들을 null 로 만드는 `set_cell` op 를 만든다 (update_field 와 한 DataChange 로 묶임).
 */
import { describe, expect, it } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import { previewTypeChange, typeChangeToOps } from "./typeChangePreview";

const field: DataField = { id: "f-age", key: "age", type: "string" };
const rows = [
  { age: "30" },
  { age: "not a number" },
  { age: "" },
  { age: "42" },
  { age: "NaN" },
];

describe("previewTypeChange", () => {
  it("새 타입으로 강제 실패하는 행 (빈 값 제외) 을 센다", () => {
    const p = previewTypeChange(field, "number", rows, "age");
    expect(p.total).toBe(5);
    expect(p.invalidRowIndexes).toEqual([1, 4]); // "not a number", "NaN" (빈 값은 성공 null)
    expect(p.invalidCount).toBe(2);
  });
  it("전부 강제 가능하면 invalid 0", () => {
    expect(previewTypeChange(field, "string", rows, "age").invalidCount).toBe(
      0,
    );
  });
  it("같은 타입이면 invalid 0", () => {
    const num: DataField = { id: "f", key: "n", type: "number" };
    expect(previewTypeChange(num, "number", [{ n: 3 }], "n").invalidCount).toBe(
      0,
    );
  });
});

describe("typeChangeToOps", () => {
  it("유지(keep) — update_field 만 (실패 셀 그대로)", () => {
    const ops = typeChangeToOps({
      collectionId: "c1",
      field,
      newType: "number",
      invalidRowIndexes: [1, 4],
      mode: "keep",
    });
    expect(ops).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-age",
        patch: { type: "number" },
      },
    ]);
  });
  it("비움(clear) — update_field + 실패 셀마다 set_cell null", () => {
    const ops = typeChangeToOps({
      collectionId: "c1",
      field,
      newType: "number",
      invalidRowIndexes: [1, 4],
      mode: "clear",
    });
    expect(ops).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-age",
        patch: { type: "number" },
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 1,
        fieldId: "f-age",
        value: null,
      },
      {
        op: "set_cell",
        collectionId: "c1",
        rowIndex: 4,
        fieldId: "f-age",
        value: null,
      },
    ]);
  });
  it("실패 0 이면 mode 무관하게 update_field 하나", () => {
    const ops = typeChangeToOps({
      collectionId: "c1",
      field,
      newType: "string",
      invalidRowIndexes: [],
      mode: "clear",
    });
    expect(ops).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-age",
        patch: { type: "string" },
      },
    ]);
  });
});
