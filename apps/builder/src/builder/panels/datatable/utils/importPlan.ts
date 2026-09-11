/**
 * import 계획 — ADR-212 Phase 5 UX-3/M2.
 *
 * 붙여넣기·CSV·JSON 에서 온 행 배열 + 기존 스키마 → 열별 매핑 (existing/new/ignore) 을 세우고
 * (`planImport`), 사용자가 매핑·append/replace 를 고른 뒤 한 DataChange 로 만든다
 * (`importPlanToOps`: 새 열 `add_field` → `replace_rows` 또는 `insert_rows`). 값은
 * `coerceCellValue` 로 강제, 실패는 null (0 으로 바꾸지 않음). 순수 함수.
 */
import type { DataOp } from "@composition/shared";
import type { DataField, DataFieldType } from "../../../../types/builder/data.types";
import { detectColumns } from "./columnDetector";
import { coerceCellValue } from "../grid/cellValue";

export type ImportColumnAction = "existing" | "new" | "ignore";

export interface ImportColumn {
  sourceKey: string;
  action: ImportColumnAction;
  targetKey: string;
  type: DataFieldType;
}

export interface ImportPlan {
  columns: ImportColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

export function planImport(
  rows: readonly Record<string, unknown>[],
  schema: readonly DataField[],
): ImportPlan {
  const detected = detectColumns(rows);
  const byKey = new Map(schema.map((f) => [f.key, f]));
  const columns: ImportColumn[] = detected.map((col) => {
    const existing = byKey.get(col.key);
    return existing
      ? {
          sourceKey: col.key,
          action: "existing",
          targetKey: existing.key,
          type: existing.type,
        }
      : { sourceKey: col.key, action: "new", targetKey: col.key, type: col.type };
  });
  return { columns, rows: [...rows], rowCount: rows.length };
}

export interface ImportOpsOptions {
  collectionId: string;
  mode: "replace" | "append";
  /** append 위치 (기본 = 끝, 호출자가 rowCount 전달) */
  at?: number;
}

export function importPlanToOps(
  plan: ImportPlan,
  { collectionId, mode, at }: ImportOpsOptions,
): DataOp[] {
  const active = plan.columns.filter((c) => c.action !== "ignore");
  const ops: DataOp[] = [];
  for (const col of active) {
    if (col.action === "new") {
      ops.push({
        op: "add_field",
        collectionId,
        field: { key: col.targetKey, type: col.type },
      });
    }
  }
  const rows = plan.rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of active) {
      const raw = row[col.sourceKey];
      const text = raw === null || raw === undefined ? "" : String(raw);
      out[col.targetKey] = coerceCellValue(col.type, text).value;
    }
    return out;
  });
  if (mode === "replace") {
    ops.push({ op: "replace_rows", collectionId, rows });
  } else {
    ops.push({ op: "insert_rows", collectionId, rows, ...(at !== undefined ? { at } : {}) });
  }
  return ops;
}
