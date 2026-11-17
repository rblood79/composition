/**
 * ADR-313 사용자 결정 6 — 값 표현을 바꾸면 작성 행은 타입 변경과 같은 규칙: 읽히는 값은 바꾸고, 못 읽는 값은
 * 비움 / 유지. 한 DataChange (update_field + set_cell).
 */
import { describe, expect, it } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import { encodingChangeToOps, previewEncodingChange } from "./encodingChange";

const field: DataField = { id: "f-use", key: "USE_YN", type: "string", format: "email" };
const rows = [{ USE_YN: "Y" }, { USE_YN: "N" }, { USE_YN: "x" }, { USE_YN: null }];
const flag = { type: "boolean" as const, encoding: { kind: "flag" as const, true: "Y", false: "N" } };

describe("ADR-313 결정 6 — 값 표현 변경과 작성 행", () => {
  it("읽히는 값은 바꾸고 못 읽는 값을 센다 (빈 값은 건너뛴다)", () => {
    const preview = previewEncodingChange(field, flag, rows);
    expect(preview.converted).toEqual([
      { rowIndex: 0, value: true },
      { rowIndex: 1, value: false },
    ]);
    expect(preview.invalidRowIndexes).toEqual([2]);
  });

  it("비움 — 타입 · 표현 · format 지움 한 update_field + 바뀌는 셀 + 못 읽은 셀 null", () => {
    const preview = previewEncodingChange(field, flag, rows);
    expect(encodingChangeToOps("c1", field, flag, preview, "clear")).toEqual([
      {
        op: "update_field",
        collectionId: "c1",
        fieldId: "f-use",
        patch: { type: "boolean", encoding: flag.encoding, format: null },
      },
      { op: "set_cell", collectionId: "c1", rowIndex: 0, fieldId: "f-use", value: true },
      { op: "set_cell", collectionId: "c1", rowIndex: 1, fieldId: "f-use", value: false },
      { op: "set_cell", collectionId: "c1", rowIndex: 2, fieldId: "f-use", value: null },
    ]);
  });

  it("유지 — 못 읽은 셀은 그대로 · 표현을 없애면 encoding: null 만 (정규 값은 그대로 타입의 값)", () => {
    const preview = previewEncodingChange(field, flag, rows);
    expect(encodingChangeToOps("c1", field, flag, preview, "keep").filter((op) => op.op === "set_cell")).toHaveLength(2);
    const declared: DataField = { id: "f-use", key: "USE_YN", type: "boolean", encoding: flag.encoding };
    const none = previewEncodingChange(declared, { type: "boolean" }, [{ USE_YN: true }]);
    expect(encodingChangeToOps("c1", declared, { type: "boolean" }, none, "keep")).toEqual([
      { op: "update_field", collectionId: "c1", fieldId: "f-use", patch: { encoding: null } },
    ]);
  });
});
