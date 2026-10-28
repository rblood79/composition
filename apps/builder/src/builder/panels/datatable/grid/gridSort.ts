/**
 * Column sort for the data grid — a view of the rows, not a write (Supabase Table Editor 어법:
 * the column ⌄ menu's Sort ascending · descending). Rows keep their document order and their
 * index (`item.index`), so editing · selection · the row form still address the stored row.
 *
 * Empty cells (null · undefined · "") go last in both directions. Numbers and booleans compare as
 * values; everything else as its displayed text with a numeric-aware collator ("row 2" < "row 10").
 */
import type { DataField } from "../../../../types/builder/data.types";
import { formatCellValue } from "./cellValue";

export type GridSortDirection = "ascending" | "descending";

export interface GridSort {
  key: string;
  direction: GridSortDirection;
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

function compareValues(a: unknown, b: unknown, field: DataField): number {
  if (field.type === "number") {
    const na = typeof a === "number" ? a : Number(a);
    const nb = typeof b === "number" ? b : Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1;
  }
  return collator.compare(formatCellValue(a), formatCellValue(b));
}

/** A sorted copy of `items` (stable: equal cells keep their document order). */
export function sortGridItems<
  T extends { index: number; row: Record<string, unknown> },
>(items: readonly T[], field: DataField, direction: GridSortDirection): T[] {
  const sign = direction === "ascending" ? 1 : -1;
  return [...items].sort((x, y) => {
    const a = x.row[field.key];
    const b = y.row[field.key];
    const ea = isEmpty(a);
    const eb = isEmpty(b);
    if (ea || eb) return ea === eb ? x.index - y.index : ea ? 1 : -1;
    return sign * compareValues(a, b, field) || x.index - y.index;
  });
}
