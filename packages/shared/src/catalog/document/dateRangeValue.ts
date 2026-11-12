/**
 * ADR-309 Decision 1 · 2 — the date family's structured values. Each date is ISO text (the date
 * variable's, the data's, the Code view's — `parseDateValue` reads it); a text that reads as no
 * date is kept and read as empty (the DOM · Canvas do the same), so a stored value never fails
 * validation for its date text.
 */

/** A DateRangePicker's · RangeCalendar's `value`: `{start, end}` (S2 `RangeValue<DateValue>`). */
export interface CatalogDateRange {
  readonly start: string;
  readonly end: string;
}

export function catalogDateRangeFits(
  value: unknown,
): value is CatalogDateRange {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  const { start, end } = value as Record<string, unknown>;
  return (
    keys.length === 2 && typeof start === "string" && typeof end === "string"
  );
}

/**
 * A Calendar's `value` (S2 `CalendarValueType<T, M>`): one date (single selection) or a list of
 * dates (`selectionMode: multiple`). The mode is read where the value is read — a stored value
 * stays as written when the mode changes (Decision 1).
 */
export type CatalogCalendarValue = string | readonly string[];

export function catalogCalendarValueFits(
  value: unknown,
): value is CatalogCalendarValue {
  return (
    typeof value === "string" ||
    (Array.isArray(value) && value.every((date) => typeof date === "string"))
  );
}
