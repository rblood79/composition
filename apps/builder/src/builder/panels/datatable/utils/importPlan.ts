/**
 * import 계획 — ADR-212 Phase 5 UX-3/M2.
 *
 * 붙여넣기·CSV·JSON 에서 온 행 배열 + 기존 스키마 → 열별 매핑 (existing/new/ignore) 을 세우고
 * (`planImport`), 사용자가 매핑·append/replace 를 고른 뒤 한 DataChange 로 만든다
 * (`importPlanToOps`: 새 열 `add_field` → `replace_rows` 또는 `insert_rows`). 값은 ADR-313 의
 * 진입 변환기 (`intakeRows`) 가 원본 종류의 규칙으로 읽는다 — JSON 원본은 선언 없는 값을 그대로 두고
 * (열 타입과 다르면 셈만), 글자 원본 (CSV · 탭) 은 대상 열 타입으로 읽는다. 실패는 null. 순수 함수.
 */
import type { DataOp } from "@composition/shared";
import type { DataField, DataFieldType } from "../../../../types/builder/data.types";
import type {
  IntakeReport,
  IntakeSource,
} from "../../../../../../../packages/shared/src/collections/intake/normalizeRows";
import { detectColumns } from "./columnDetector";
import { intakeRows } from "./intakeRows";

export type ImportColumnAction = "existing" | "new" | "ignore";

export interface ImportColumn {
  sourceKey: string;
  action: ImportColumnAction;
  targetKey: string;
  type: DataFieldType;
  /** A new text column's kind (`DetectedColumn.format`). */
  format?: DataField["format"];
  /** ADR-313 — an existing column's value notation (its field's `encoding`). */
  encoding?: DataField["encoding"];
}

export interface ImportPlan {
  columns: ImportColumn[];
  rows: Record<string, unknown>[];
  rowCount: number;
  /** ADR-313 — the source kind the entry told (JSON · CSV / tab text). */
  source: IntakeSource;
}

export function planImport(
  rows: readonly Record<string, unknown>[],
  schema: readonly DataField[],
  source: IntakeSource = "json",
): ImportPlan {
  const detected = detectColumns(rows, source);
  const byKey = new Map(schema.map((f) => [f.key, f]));
  const columns: ImportColumn[] = detected.map((col) => {
    const existing = byKey.get(col.key);
    return existing
      ? {
          sourceKey: col.key,
          action: "existing",
          targetKey: existing.key,
          type: existing.type,
          ...(existing.encoding ? { encoding: existing.encoding } : {}),
        }
      : {
          sourceKey: col.key,
          action: "new",
          targetKey: col.key,
          type: col.type,
          ...(col.format ? { format: col.format } : {}),
        };
  });
  return { columns, rows: [...rows], rowCount: rows.length, source };
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
        field: {
          key: col.targetKey,
          type: col.type,
          ...(col.format ? { format: col.format } : {}),
        },
      });
    }
  }
  const rows = importRowsOf(plan).map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of active) out[col.targetKey] = row[col.sourceKey] ?? null;
    return out;
  });
  if (mode === "replace") {
    ops.push({ op: "replace_rows", collectionId, rows });
  } else {
    ops.push({ op: "insert_rows", collectionId, rows, ...(at !== undefined ? { at } : {}) });
  }
  return ops;
}

/** The plan's rows in the target columns' stored values (ADR-313 — the source kind's rule). */
function intakeOf(plan: ImportPlan) {
  const fields = plan.columns
    .filter((c) => c.action !== "ignore")
    .map((c) => ({
      key: c.sourceKey,
      type: c.type,
      ...(c.encoding ? { encoding: c.encoding } : {}),
    }));
  return intakeRows(plan.rows, fields, plan.source);
}

function importRowsOf(plan: ImportPlan): readonly Record<string, unknown>[] {
  return intakeOf(plan).rows;
}

/** ADR-313 — what the import changes and cannot read, per source column (the preview's counts). */
export function importPlanReport(plan: ImportPlan): IntakeReport {
  return intakeOf(plan).report;
}
