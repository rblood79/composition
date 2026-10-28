/**
 * Row form target — ADR-289 Decision 1 · R2 (리뷰 H2 round 1 ~ 3): which row an Update form writes.
 *
 * Rows have no identity. The document accepts rows without `id` and duplicate `id`s, `set_cell` ·
 * `remove_rows` address rows by **index**, and the row objects do not survive a step either — a
 * changed collection is JSON-copied into the document (`catalogDataStore.ts` `toCollectionEntry`)
 * and re-projected into new objects (Undo too). What survives is the collection: a step replaces
 * only the entries it touched and `fromCollectionEntry` caches the table per entry, so an
 * untouched table keeps the **same `mockData` array**.
 *
 * So the form holds what it opened — the index, the array reference and the rows' JSON — and
 * before writing compares them with the latest store: the same array (nothing touched this table)
 * or the same JSON (name · settings · schema changed, or Undo came back) → the opened index;
 * anything else (a row added · removed · edited · pasted · imported, the table deleted) is a
 * **conflict** — the save is refused and the input kept. No `id` · no object comparison.
 *
 * Tables over `SNAPSHOT_MAX_ROWS` keep no JSON (an open · save would serialise 10k rows) and
 * accept the array reference only — a rename while the form is open then reads as a conflict.
 */
import type { DataTable } from "../../../../types/builder/data.types";

export const SNAPSHOT_MAX_ROWS = 1_000;

export interface OpenedRowFormTarget {
  rowIndex: number;
  mockData: readonly Record<string, unknown>[];
  /** `JSON.stringify(mockData)` at open — `null` past `SNAPSHOT_MAX_ROWS`. */
  snapshot: string | null;
}

export type RowFormTarget = { rowIndex: number } | { conflict: true };

export function openRowFormTarget(
  table: Pick<DataTable, "mockData">,
  rowIndex: number,
): OpenedRowFormTarget {
  return {
    rowIndex,
    mockData: table.mockData,
    snapshot:
      table.mockData.length <= SNAPSHOT_MAX_ROWS
        ? JSON.stringify(table.mockData)
        : null,
  };
}

export function resolveRowFormTarget(
  latest: Pick<DataTable, "mockData" | "schema"> | undefined,
  opened: OpenedRowFormTarget,
  writtenFieldIds: readonly string[],
): RowFormTarget {
  if (!latest) return { conflict: true };
  if (latest.mockData === opened.mockData) return { rowIndex: opened.rowIndex };
  if (opened.snapshot === null) return { conflict: true };
  if (
    opened.rowIndex < latest.mockData.length &&
    JSON.stringify(latest.mockData) === opened.snapshot &&
    writtenFieldIds.every((id) =>
      latest.schema.some((field) => field.id === id),
    )
  )
    return { rowIndex: opened.rowIndex };
  return { conflict: true };
}
