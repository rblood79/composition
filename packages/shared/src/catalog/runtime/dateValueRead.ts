/**
 * ADR-309 Decision 1 · 3 — one reader for the date family's document values (DateField ·
 * TimeField · DatePicker · DateRangePicker · Calendar · RangeCalendar). The DOM (RAC's props) and
 * the Canvas (the calendar model) read a value through here: ISO text by its shape
 * (`parseDateValue` — date · dateTime · zoned · time), fitted to the granularity RAC takes, and
 * which value a component starts from.
 */
import {
  toCalendarDate,
  toCalendarDateTime,
  type CalendarDate,
  type DateValue,
} from "@internationalized/date";
import { parseDateValue } from "../../state/dateValue";

const TIME_GRANULARITIES: ReadonlySet<string> = new Set([
  "hour",
  "minute",
  "second",
]);

/** A value RAC already took (a running Preview's — `@internationalized/date` objects). */
const isDateObject = (value: unknown): value is DateValue =>
  !!value &&
  typeof value === "object" &&
  "calendar" in value &&
  "year" in value;

/**
 * A date prop's ISO text as RAC's `DateValue` (date · date and time · zoned), else undefined —
 * time-only text is no date. At a time granularity a date-only value is that day at midnight: RAC
 * throws on it (`Invalid granularity minute for value 2026-11-12` — ADR-309 R3, the Preview went
 * blank).
 */
export function catalogDateValue(
  value: unknown,
  granularity?: unknown,
): DateValue | undefined {
  const date = isDateObject(value)
    ? value
    : typeof value === "string"
      ? (() => {
          const parsed = parseDateValue(value);
          return parsed && parsed.kind !== "time" ? parsed.value : undefined;
        })()
      : undefined;
  if (!date) return undefined;
  return TIME_GRANULARITIES.has(String(granularity)) && !("hour" in date)
    ? toCalendarDateTime(date)
    : date;
}

/**
 * A TimeField prop's ISO text as RAC's `TimeValue`: a time (`10:30`), or the time of a date and
 * time · a zoned value (RAC takes those as they are — `TimeValue`). A date-only text is none.
 */
export function catalogTimeValue(value: unknown): unknown {
  if (value && typeof value === "object" && "hour" in value) return value;
  if (typeof value !== "string") return undefined;
  const parsed = parseDateValue(value);
  return parsed && parsed.kind !== "date" ? parsed.value : undefined;
}

/** A range `{start, end}` as RAC takes it — both ends read as dates — else none (`null`). */
export function catalogDateRange(
  value: unknown,
  granularity?: unknown,
): { start: DateValue; end: DateValue } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { start, end } = value as { start?: unknown; end?: unknown };
  const from = catalogDateValue(start, granularity);
  const to = catalogDateValue(end, granularity);
  return from && to ? { start: from, end: to } : null;
}

/**
 * The value a date component starts from (Decision 1): `value` when the record has one — a running
 * Preview's override included, its explicit `null` (a cleared value) too — else `defaultValue`.
 * An empty value never falls back: the key decides, not `??`.
 */
export function catalogDateStartValue(
  props: Readonly<Record<string, unknown>>,
): unknown {
  return props.value !== undefined ? props.value : props.defaultValue;
}

const isMultiple = (selectionMode: unknown) => selectionMode === "multiple";

/**
 * A Calendar's value for RAC in its selection mode (Decision 1, review h1): one date (single), or
 * the dates (`multiple` — each ISO text read, unreadable ones left out; none = `null`). The stored value is not
 * rewritten when the mode changes — a list in single mode is its first date, a date in multiple
 * mode a list of one.
 */
export function catalogCalendarValue(
  value: unknown,
  selectionMode: unknown,
): DateValue | readonly DateValue[] | null {
  const list = (Array.isArray(value) ? value : value == null ? [] : [value])
    .map((date) => catalogDateValue(date))
    .filter((date): date is DateValue => !!date);
  // (An empty list is RAC's `null`: RAC reads a mounting calendar's first focus from `value[0]` when
  //  the value is an array — `[]` is truthy, so an empty list threw `reading 'subtract'`.)
  return isMultiple(selectionMode) && list.length ? list : (list[0] ?? null);
}

/**
 * RAC's changed Calendar value as the record's runtime `value` — the document's form: ISO text
 * (single) or ISO texts (`multiple` — never joined into one text). Cleared = `null` · `[]`.
 */
export function catalogCalendarOverride(
  next: unknown,
  selectionMode: unknown,
): string | readonly string[] | null {
  if (Array.isArray(next)) return next.map(String);
  if (next == null) return isMultiple(selectionMode) ? [] : null;
  return isMultiple(selectionMode) ? [String(next)] : String(next);
}

/** The first date of a Calendar value (a list's first — RAC focuses it), else none. */
export function catalogCalendarFirstDate(
  value: unknown,
): DateValue | undefined {
  const read = catalogCalendarValue(value, "multiple") as
    readonly DateValue[] | null;
  return read?.[0];
}

/** A date value's day in its own calendar's ISO form — the Canvas calendar's cells. */
export function catalogCalendarDayOf(value: unknown): CalendarDate | undefined {
  const date = catalogDateValue(value);
  return date ? toCalendarDate(date) : undefined;
}
