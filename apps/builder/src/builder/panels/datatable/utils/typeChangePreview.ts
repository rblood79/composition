/**
 * 타입 변경 미리보기 — ADR-212 Phase 3 UX-5.
 *
 * 필드 타입을 바꿀 때 기존 행 값이 새 타입으로 강제되는지 미리 세고 ("12행 중 3행이 숫자가
 * 아님"), 사용자가 "비움 / 유지" 를 고르면 `update_field` + (비움일 때) 실패 셀마다 `set_cell null`
 * 을 한 DataChange 로 만든다. 강제 판정은 격자와 같은 `coerceCellValue` (SSOT). 순수 함수.
 */
import type { DataOp } from "@composition/shared";
import type {
  DataField,
  DataFieldType,
} from "../../../../types/builder/data.types";
import { coerceCellValue, formatCellValue } from "../grid/cellValue";

export interface TypeChangePreview {
  total: number;
  invalidRowIndexes: number[];
  invalidCount: number;
}

export function previewTypeChange(
  field: DataField,
  newType: DataFieldType,
  rows: readonly Record<string, unknown>[],
  fieldKey: string,
): TypeChangePreview {
  const invalidRowIndexes: number[] = [];
  rows.forEach((row, index) => {
    const raw = formatCellValue(row[fieldKey]);
    if (raw.trim() === "") return; // 빈 값은 null 로 성공
    if (!coerceCellValue(newType, raw).ok) invalidRowIndexes.push(index);
  });
  return {
    total: rows.length,
    invalidRowIndexes,
    invalidCount: invalidRowIndexes.length,
  };
}

export interface TypeChangeOpsInput {
  collectionId: string;
  field: DataField;
  newType: DataFieldType;
  invalidRowIndexes: readonly number[];
  /** clear = 실패 셀을 null 로, keep = 값 그대로 (타입만) */
  mode: "keep" | "clear";
}

export function typeChangeToOps({
  collectionId,
  field,
  newType,
  invalidRowIndexes,
  mode,
}: TypeChangeOpsInput): DataOp[] {
  const fieldId = field.id ?? field.key;
  const ops: DataOp[] = [
    { op: "update_field", collectionId, fieldId, patch: { type: newType } },
  ];
  if (mode === "clear") {
    for (const rowIndex of invalidRowIndexes) {
      ops.push({
        op: "set_cell",
        collectionId,
        rowIndex,
        fieldId,
        value: null,
      });
    }
  }
  return ops;
}
