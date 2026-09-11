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
  /** clear = 실패 셀을 null 로, keep = 값 그대로 (강제 실패 행만). 두 경우 모두 강제 성공 행은 새 타입 값으로 정규화 ("30" → 30). */
  mode: "keep" | "clear";
  /** 강제 성공 행 정규화용 — 생략하면 update_field 만 (정규화 없음). */
  rows?: readonly Record<string, unknown>[];
  fieldKey?: string;
}

export function typeChangeToOps({
  collectionId,
  field,
  newType,
  invalidRowIndexes,
  mode,
  rows,
  fieldKey,
}: TypeChangeOpsInput): DataOp[] {
  const fieldId = field.id ?? field.key;
  const ops: DataOp[] = [
    { op: "update_field", collectionId, fieldId, patch: { type: newType } },
  ];
  const invalid = new Set(invalidRowIndexes);
  const key = fieldKey ?? field.key;
  if (rows) {
    // 강제 성공 행: 문자열 "30" 을 number 30 으로 정규화 (셀 값이 새 타입과 어긋나지 않게).
    rows.forEach((row, rowIndex) => {
      if (invalid.has(rowIndex)) return;
      const raw = formatCellValue(row[key]);
      if (raw.trim() === "") return;
      const coerced = coerceCellValue(newType, raw);
      if (coerced.ok && !Object.is(coerced.value, row[key])) {
        ops.push({
          op: "set_cell",
          collectionId,
          rowIndex,
          fieldId,
          value: coerced.value,
        });
      }
    });
  }
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
