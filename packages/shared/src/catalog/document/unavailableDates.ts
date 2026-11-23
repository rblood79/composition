/**
 * S2 `isDateUnavailable` as data (S2 체크리스트 부록 D.3 2단계, 2026-11-23 — 사용자 결정: 함수가 아니라
 * 요일 · 날짜 목록 · 데이터 표). A date component's `isDateUnavailable` holds the weekdays and the dates
 * (one day, or a `{start, end}` period) no one may pick; a date a data table names comes from the
 * node's own binding (`binding.fieldMap.unavailable` · `unavailableEnd`, its view's conditions the
 * rows that count — `CatalogBoundRows.unavailableDates`). A date is unavailable when any of them
 * names it.
 */
export interface CatalogUnavailableDates {
  /** 0 = Sunday … 6 = Saturday (fixed — not the locale's first day). */
  readonly weekdays?: readonly number[];
  /** ISO dates (`YYYY-MM-DD`) — a day, or a period from `start` to `end` (both included). */
  readonly dates?: readonly CatalogUnavailableDate[];
}

export type CatalogUnavailableDate =
  string | { readonly start: string; readonly end: string };

/** The date components that take `isDateUnavailable` (S2 1.8.2 · RAC — their calendar or field). */
export const CATALOG_UNAVAILABLE_DATE_TYPES: ReadonlySet<string> = new Set([
  "Calendar",
  "RangeCalendar",
  "DateField",
  "DatePicker",
  "DateRangePicker",
]);

/** The binding roles of a date component's data dates (`DataBindingRef.fieldMap`). */
export const CATALOG_UNAVAILABLE_FIELD = "unavailable";
export const CATALOG_UNAVAILABLE_END_FIELD = "unavailableEnd";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** An ISO calendar day (`YYYY-MM-DD`, a real day of the Gregorian calendar). */
export function catalogIsoDayFits(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DAY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function entryFits(value: unknown): value is CatalogUnavailableDate {
  if (catalogIsoDayFits(value)) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { start, end, ...rest } = value as Record<string, unknown>;
  return (
    Object.keys(rest).length === 0 &&
    catalogIsoDayFits(start) &&
    catalogIsoDayFits(end) &&
    start <= end
  );
}

/** An `isDateUnavailable` value: weekdays (0 ~ 6, each once) · dates · periods — nothing else. */
export function catalogUnavailableDatesFit(
  value: unknown,
): value is CatalogUnavailableDates {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const { weekdays, dates, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) return false;
  if (weekdays === undefined && dates === undefined) return false;
  if (
    weekdays !== undefined &&
    !(
      Array.isArray(weekdays) &&
      weekdays.every(
        (day, index) =>
          Number.isInteger(day) &&
          day >= 0 &&
          day <= 6 &&
          weekdays.indexOf(day) === index,
      )
    )
  )
    return false;
  return (
    dates === undefined || (Array.isArray(dates) && dates.every(entryFits))
  );
}

/** A data value as an ISO day: a date text (or a date-time's day) — else none. */
export function catalogIsoDayOf(value: unknown): string | undefined {
  if (value instanceof Date)
    return Number.isNaN(value.getTime())
      ? undefined
      : value.toISOString().slice(0, 10);
  if (typeof value !== "string") return undefined;
  const day = value.slice(0, 10);
  return catalogIsoDayFits(day) ? day : undefined;
}

/**
 * The dates a data table names, one per row: the row's date field (`unavailable`), and with an end
 * field (`unavailableEnd`) the period up to it — a row with no date, or an end before its start
 * (no period), names the one day or nothing.
 */
export function catalogUnavailableRowDates(
  rows: readonly unknown[],
  dateField: string,
  endField?: string,
): CatalogUnavailableDate[] {
  const out: CatalogUnavailableDate[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const values = row as Record<string, unknown>;
    const start = catalogIsoDayOf(values[dateField]);
    if (!start) continue;
    const end = endField ? catalogIsoDayOf(values[endField]) : undefined;
    out.push(end && end > start ? { start, end } : start);
  }
  return out;
}
