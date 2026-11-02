/**
 * The `date` variable type's value (사용자 결정 2026-10-29 「4개 type 에 date 하나만」): an ISO text
 * in RAC's own shapes — the same text `@internationalized/date` parses and `toString()` writes, and
 * the text Supabase returns for `date` · `timestamp` · `time` columns. One type; the text's shape
 * says its precision (a day · a day and time · a time · a zoned instant). Empty is `""`.
 */
import {
  parseAbsolute,
  parseDate,
  parseDateTime,
  parseTime,
  parseZonedDateTime,
  type CalendarDate,
  type CalendarDateTime,
  type Time,
  type ZonedDateTime,
  type DateValue,
} from "@internationalized/date";

export type DateValueKind = "date" | "dateTime" | "time" | "zoned";

export type ParsedDateValue =
  | { kind: "date"; value: CalendarDate }
  | { kind: "dateTime"; value: CalendarDateTime }
  | { kind: "time"; value: Time }
  | { kind: "zoned"; value: ZonedDateTime };

const ABSOLUTE = /(?:Z|[+-]\d{2}:\d{2})$/;

/** The parsed value of a date text, by its shape; undefined when it is no date text. */
export function parseDateValue(text: string): ParsedDateValue | undefined {
  const value = text.trim();
  if (value === "") return undefined;
  try {
    if (value.includes("["))
      return { kind: "zoned", value: parseZonedDateTime(value, "reject") };
    if (value.includes("T")) {
      if (ABSOLUTE.test(value))
        return { kind: "zoned", value: parseAbsolute(value, "UTC") };
      return { kind: "dateTime", value: parseDateTime(value) };
    }
    if (value.includes(":")) return { kind: "time", value: parseTime(value) };
    return { kind: "date", value: parseDate(value) };
  } catch {
    return undefined;
  }
}

/** The calendar-bearing subset RAC date fields accept; time-only and invalid ISO have none. */
export function safeParseDateString(
  text: string | null | undefined,
): DateValue | null {
  const parsed = text ? parseDateValue(text) : undefined;
  return parsed && parsed.kind !== "time" ? parsed.value : null;
}

/** Whether a stored value is a `date` variable's: `""` or a date text. */
export function isDateValueText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value === "" || parseDateValue(value) !== undefined)
  );
}

/**
 * A runtime date as stored text: a RAC date · time value (`toString()` — the ISO shape it parses),
 * a `Date` (its instant), a date text as is; anything else is empty.
 */
export function dateValueToText(raw: unknown): string {
  if (raw instanceof Date)
    return Number.isNaN(raw.getTime()) ? "" : raw.toISOString();
  const text =
    typeof raw === "string"
      ? raw.trim()
      : raw && typeof raw === "object" && typeof raw.toString === "function"
        ? String(raw)
        : "";
  return isDateValueText(text) ? text : "";
}
