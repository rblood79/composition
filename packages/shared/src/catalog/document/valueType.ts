import type { ValueType } from "./types";

/**
 * A scalar value against its declared value type. `slot` (ADR-256 Decision 4) holds a slot name or
 * `false` (the explicit detach) — a condition, a part rule or a template value keyed on a slot name
 * (`[slot="description"]`) matches it like a string.
 */
export function scalarFitsType(
  value: unknown,
  type: ValueType | string | undefined,
): boolean {
  if (type === "slot") return typeof value === "string" || value === false;
  if (type === "columnSize") return catalogColumnSizeFits(value, false);
  if (type === "columnStaticSize") return catalogColumnSizeFits(value, true);
  return type !== undefined && typeof value === type;
}

const COLUMN_FR = /^([1-9]\d*)fr$/;
const COLUMN_PERCENT = /^(\d+)%$/;

/**
 * ADR-257 — S2 1.8.0 `ColumnSize` (`staticOnly` = `ColumnStaticSize`) as stored: a finite px
 * number ≥ 0, `"Nfr"` (whole N ≥ 1), `"N%"` (whole N). S2's type also admits a numeric string
 * (`${number}`), but RAC's `parseStaticWidth` throws on one — the document keeps numbers only
 * (a composition restriction of the notation, not the meaning).
 */
export function catalogColumnSizeFits(
  value: unknown,
  staticOnly: boolean,
): boolean {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0;
  if (typeof value !== "string") return false;
  return (
    COLUMN_PERCENT.test(value) || (!staticOnly && COLUMN_FR.test(value))
  );
}
