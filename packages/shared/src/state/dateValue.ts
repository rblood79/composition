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
} from "@internationalized/date";

export type DateValueKind = "date" | "dateTime" | "time" | "zoned";

export type ParsedDateValue =
  | { kind: "date"; value: CalendarDate }
  | { kind: "dateTime"; value: CalendarDateTime }
  | { kind: "time"; value: Time }
  | { kind: "zoned"; value: ZonedDateTime };

const TIME_ONLY = /^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const ABSOLUTE = /(?:Z|[+-]\d{2}:\d{2})$/;

/** The parsed value of a date text, by its shape; undefined when it is no date text. */
export function parseDateValue(text: string): ParsedDateValue | undefined {
  const value = text.trim();
  if (value === "") return undefined;
  try {
    if (TIME_ONLY.test(value)) return { kind: "time", value: parseTime(value) };
    if (value.includes("["))
      return { kind: "zoned", value: parseZonedDateTime(value) };
    if (value.includes("T")) {
      if (ABSOLUTE.test(value))
        return { kind: "zoned", value: parseAbsolute(value, "UTC") };
      return { kind: "dateTime", value: parseDateTime(value) };
    }
    return { kind: "date", value: parseDate(value) };
  } catch {
    return undefined;
  }
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
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return isDateValueText(raw) ? raw.trim() : "";
  if (raw instanceof Date)
    return Number.isNaN(raw.getTime()) ? "" : raw.toISOString();
  if (
    typeof raw === "object" &&
    typeof (raw as { toString?: unknown }).toString === "function"
  ) {
    const text = String(raw);
    return isDateValueText(text) ? text : "";
  }
  return "";
}

export interface NativeDateInput {
  type: "date" | "datetime-local" | "time";
  value: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The browser's own picker for a date text's shape — a day → `date`, a day and time →
 * `datetime-local` (a zoned instant as local time), a time → `time`; empty starts as a day. The
 * picker's value is the stored ISO shape. The Builder's date fields (a variable's default, a
 * table cell) all open this one picker (사용자 2026-10-29 「date 편집일 때 캘린더 오픈」).
 */
export function nativeDateInputOf(text: string): NativeDateInput {
  const parsed = parseDateValue(text);
  if (!parsed) return { type: "date", value: "" };
  switch (parsed.kind) {
    case "time":
      return { type: "time", value: parsed.value.toString().slice(0, 5) };
    case "dateTime":
      return {
        type: "datetime-local",
        value: parsed.value.toString().slice(0, 16),
      };
    case "zoned": {
      const d = parsed.value.toDate();
      return {
        type: "datetime-local",
        value: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
      };
    }
    default:
      return { type: "date", value: parsed.value.toString() };
  }
}

/**
 * A typed date as stored text: an ISO text in RAC's shapes as written (trimmed); a looser text
 * the browser reads (`Oct 29 2026`, `2026/10/29 10:00`) as a day, or a day and time when it has
 * one. Undefined when it is no date.
 */
export function coerceDateText(raw: string): string | undefined {
  const text = raw.trim();
  if (text === "") return "";
  if (parseDateValue(text)) return text;
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return undefined;
  const d = new Date(ms);
  const day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return d.getHours() || d.getMinutes() || d.getSeconds()
    ? `${day}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    : day;
}
