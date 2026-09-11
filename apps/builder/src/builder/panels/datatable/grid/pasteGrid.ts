/**
 * 격자 붙여넣기 계획 — ADR-212 Phase 2 UX-3.
 *
 * 클립보드 텍스트를 2차원 문자열로 읽고 (스프레드시트 = TSV · 그 외 줄마다 한 셀), anchor 셀부터
 * 채운다. 기존 행 · 열 → `set_cell`, 넘치는 행 → `insert_rows` (스키마 모양, 빈 키는 null),
 * 넘치는 열 → `extraColumns` 후보 (호출자가 "새 필드로 추가?" 를 물은 뒤 `add_field`).
 * 값은 `coerceCellValue` 로 강제하고 실패 셀은 null + `invalid` 로 표시한다. 순수 함수 —
 * store 를 모른다.
 */
import type { DataOp } from "@composition/shared";
import type {
  DataField,
  DataFieldType,
} from "../../../../types/builder/data.types";
import { coerceCellValue } from "./cellValue";

export function parseClipboardGrid(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  if (lines.length === 0 || lines.every((line) => line.trim() === ""))
    return [];
  const tabbed = text.includes("\t");
  return lines.map((line) => (tabbed ? line.split("\t") : [line]));
}

export interface GridPasteInput {
  grid: string[][];
  schema: readonly DataField[];
  rowCount: number;
  anchor: { rowIndex: number; colIndex: number };
}

export interface PastedCell {
  rowIndex: number;
  key: string;
  value: unknown;
  invalid: boolean;
}

export interface ExtraColumn {
  key: string;
  type: DataFieldType;
  /** 붙여넣은 행 순서대로 (기존 행 + 새 행) */
  values: unknown[];
}

export interface GridPastePlan {
  cells: PastedCell[];
  newRows: Record<string, unknown>[];
  /** 새 행이 들어갈 자리 (= 기존 행 수) */
  insertAt: number;
  /** 붙여넣은 행 수 (기존 행에 얹힌 수 + 새 행 수) — extraColumns.values 의 길이 */
  pastedRowCount: number;
  extraColumns: ExtraColumn[];
  invalidCount: number;
}

function inferExtraType(values: string[]): DataFieldType {
  const filled = values.map((v) => v.trim()).filter((v) => v !== "");
  if (filled.length === 0) return "string";
  if (filled.every((v) => /^-?\d+(\.\d+)?$/.test(v))) return "number";
  if (filled.every((v) => /^(true|false)$/i.test(v))) return "boolean";
  return "string";
}

function uniqueExtraKey(
  schema: readonly DataField[],
  colIndex: number,
  taken: Set<string>,
): string {
  const base = `col_${colIndex + 1}`;
  let key = base;
  let n = 1;
  while (schema.some((f) => f.key === key) || taken.has(key))
    key = `${base}_${n++}`;
  taken.add(key);
  return key;
}

export function planGridPaste({
  grid,
  schema,
  rowCount,
  anchor,
}: GridPasteInput): GridPastePlan {
  const cells: PastedCell[] = [];
  const newRows: Record<string, unknown>[] = [];
  const extraColumns: ExtraColumn[] = [];
  let invalidCount = 0;
  if (grid.length === 0) {
    return {
      cells,
      newRows,
      insertAt: rowCount,
      extraColumns,
      invalidCount,
      pastedRowCount: 0,
    };
  }

  const width = Math.max(...grid.map((row) => row.length));
  const extraRaw = new Map<number, string[]>();
  const takenKeys = new Set<string>();

  grid.forEach((line, r) => {
    const rowIndex = anchor.rowIndex + r;
    const isNewRow = rowIndex >= rowCount;
    const newRow: Record<string, unknown> | null = isNewRow
      ? Object.fromEntries(schema.map((f) => [f.key, null]))
      : null;
    for (let c = 0; c < width; c++) {
      const raw = line[c] ?? "";
      const colIndex = anchor.colIndex + c;
      const field = schema[colIndex];
      if (!field) {
        const bucket = extraRaw.get(colIndex) ?? [];
        bucket.push(raw);
        extraRaw.set(colIndex, bucket);
        continue;
      }
      if (c >= line.length) continue; // 짧은 줄 — 없는 셀은 건드리지 않는다
      const coerced = coerceCellValue(field.type, raw);
      if (!coerced.ok) invalidCount += 1;
      if (newRow) newRow[field.key] = coerced.value;
      else
        cells.push({
          rowIndex,
          key: field.key,
          value: coerced.value,
          invalid: !coerced.ok,
        });
    }
    if (newRow) newRows.push(newRow);
  });

  for (const [colIndex, raws] of [...extraRaw].sort((a, b) => a[0] - b[0])) {
    const type = inferExtraType(raws);
    const key = uniqueExtraKey(schema, colIndex, takenKeys);
    extraColumns.push({
      key,
      type,
      values: raws.map((raw) => coerceCellValue(type, raw).value),
    });
  }

  return {
    cells,
    newRows,
    insertAt: rowCount,
    extraColumns,
    invalidCount,
    pastedRowCount: grid.length,
  };
}

export interface GridPasteOpsOptions {
  collectionId: string;
  schema: readonly DataField[];
  /** true = extraColumns 를 `add_field` 로 만들고 값을 채운다 */
  addExtraColumns: boolean;
}

/** 계획 → DataChange ops. add_field → set_cell (기존 행) → insert_rows (새 행, 값 포함) 순. */
export function gridPasteToOps(
  plan: GridPastePlan,
  options: GridPasteOpsOptions,
): DataOp[] {
  const { collectionId, schema, addExtraColumns } = options;
  const ops: DataOp[] = [];
  const fieldRef = new Map(schema.map((f) => [f.key, f.id ?? f.key]));
  const extras = addExtraColumns ? plan.extraColumns : [];
  /** 붙여넣은 행 중 기존 행에 얹힌 수 — extraColumns.values 의 앞부분이 그 행들 몫 */
  const onExistingRows = plan.pastedRowCount - plan.newRows.length;

  for (const column of extras) {
    ops.push({
      op: "add_field",
      collectionId,
      field: { key: column.key, type: column.type },
    });
  }

  const firstPastedRow = plan.insertAt - onExistingRows;
  const byRow = new Map<number, PastedCell[]>();
  for (const cell of plan.cells) {
    const bucket = byRow.get(cell.rowIndex) ?? [];
    bucket.push(cell);
    byRow.set(cell.rowIndex, bucket);
  }
  const existingRows = [...byRow.keys()].sort((a, b) => a - b);
  for (const rowIndex of existingRows) {
    for (const cell of byRow.get(rowIndex) ?? []) {
      ops.push({
        op: "set_cell",
        collectionId,
        rowIndex,
        fieldId: fieldRef.get(cell.key) ?? cell.key,
        value: cell.value,
      });
    }
    for (const column of extras) {
      const value = column.values[rowIndex - firstPastedRow];
      if (value === undefined) continue;
      ops.push({
        op: "set_cell",
        collectionId,
        rowIndex,
        fieldId: column.key,
        value,
      });
    }
  }

  if (plan.newRows.length > 0) {
    const rows = plan.newRows.map((row, i) => {
      if (extras.length === 0) return row;
      const withExtras = { ...row };
      for (const column of extras) {
        withExtras[column.key] = column.values[onExistingRows + i] ?? null;
      }
      return withExtras;
    });
    ops.push({ op: "insert_rows", collectionId, rows, at: plan.insertAt });
  }
  return ops;
}
