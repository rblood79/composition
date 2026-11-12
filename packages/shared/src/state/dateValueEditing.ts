/** Lossless ISO authoring adapter. Kept separate from runtime date parsing. */
import {
  parseDate,
  parseDateTime,
  parseTime,
  parseZonedDateTime,
  type CalendarDate,
  type CalendarDateTime,
  type Time,
} from "@internationalized/date";
import { isDateValueText, parseDateValue } from "./dateValue";

const TIME_ONLY = /^\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * A typed date as stored text: an ISO text in RAC's shapes as written (trimmed); a looser text
 * the browser reads (`Oct 29 2026`, `2026/10/29 10:00`) as a day, or a day and time when it has
 * one. Undefined when it is no date.
 */
export function coerceDateText(raw: string): string | undefined {
  const text = raw.trim();
  if (text === "") return "";
  if (parseDateValue(text)) return text;
  // An invalid ISO/DST value must not escape through Date.parse's normalization.
  if (
    /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}(?:T|$)/.test(text) ||
    TIME_ONLY.test(text)
  )
    return undefined;
  const ms = Date.parse(text);
  if (Number.isNaN(ms)) return undefined;
  const d = new Date(ms);
  if (/\b(?:GMT|UTC)\b|[+-]\d{2}:?\d{2}\s*$/.test(text)) return d.toISOString();
  const day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return d.getHours() || d.getMinutes() || d.getSeconds() || d.getMilliseconds()
    ? `${day}T${pad2(d.getHours())}:${pad2(d.getMinutes())}${d.getSeconds() || d.getMilliseconds() ? `:${pad2(d.getSeconds())}` : ""}${d.getMilliseconds() ? `.${String(d.getMilliseconds()).padStart(3, "0")}` : ""}`
    : day;
}

export interface NativeDateInput {
  type: "date" | "datetime-local" | "time" | "text";
  value: string;
  step?: number;
  /** The stored zone, never the host's zone. Also shown next to the picker. */
  zone?: string;
}

/** A lossless lexical envelope: parsing a fixed offset into UTC loses its original wall clock. */
function dateEnvelope(text: string) {
  const zoned = /^(.*T.*?)(Z|[+-]\d{2}:\d{2}(?::\d{2})?)?(\[[^\]]+\])?$/.exec(
    text,
  );
  return {
    body: zoned?.[1] ?? text,
    offset: zoned?.[2] ?? "",
    zone: zoned?.[3] ?? "",
  };
}

const EDIT_TIME =
  /^(?:(\d{4}-\d{2}-\d{2})T)?(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/;

/**
 * Project a stored ISO value into a picker. The projection is not a value to store: changes
 * must go through dateValueFromNativeInput. Date/time kinds stay distinct; the original zone's
 * wall clock and all native-representable precision remain visible. Finer precision or an
 * unsupported ISO shape uses exact text editing, without a Date/millisecond round trip.
 */
export function nativeDateInputOf(text: string): NativeDateInput {
  if (text === "") return { type: "date", value: "" };
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(text) &&
    Number(text.slice(0, 4)) > 0 &&
    parseDateValue(text)
  )
    return { type: "date", value: text };
  const envelope = dateEnvelope(text);
  const time = EDIT_TIME.exec(envelope.body);
  // A DST-invalid draft still has an editable local wall clock; validation rejects its ISO
  // value at commit instead of silently shifting it by an hour.
  if (
    !time ||
    (time[1] && Number(time[1].slice(0, 4)) === 0) ||
    !parseDateValue(envelope.body) ||
    (time[5]?.length ?? 0) > 3
  )
    return { type: "text", value: text };
  const zone = [
    envelope.zone.slice(1, -1),
    envelope.offset === "Z"
      ? "UTC"
      : envelope.offset
        ? `UTC${envelope.offset}`
        : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    type: time[1] ? "datetime-local" : "time",
    value: envelope.body,
    step: time[5] ? 10 ** -time[5].length : time[4] ? 1 : 60,
    ...(zone ? { zone } : {}),
  };
}

/** Merge an edited picker projection back into its ISO envelope, preserving untouched fields. */
export function dateValueFromNativeInput(
  previous: string,
  input: string,
): string {
  const native = nativeDateInputOf(previous);
  if (native.type === "text" || input === "" || previous === "") return input;
  if (input === native.value) return previous;
  const before = dateEnvelope(previous);
  const oldTime = EDIT_TIME.exec(before.body);
  const nextTime = EDIT_TIME.exec(input);
  let body = input;
  if (oldTime && nextTime) {
    const second = nextTime[4] ?? oldTime[4];
    const fraction = nextTime[5] ?? (nextTime[4] ? "" : (oldTime[5] ?? ""));
    const digits = Math.max(oldTime[5]?.length ?? 0, fraction.length);
    const seconds =
      oldTime[4] !== undefined ||
      (second !== undefined && second !== "00") ||
      digits > 0;
    body = `${nextTime[1] ? `${nextTime[1]}T` : ""}${nextTime[2]}:${nextTime[3]}${seconds ? `:${second ?? "00"}` : ""}${digits ? `.${fraction.padEnd(digits, "0")}` : ""}`;
    const same =
      oldTime[1] === nextTime[1] &&
      oldTime[2] === nextTime[2] &&
      oldTime[3] === nextTime[3] &&
      (oldTime[4] ?? "00") === (second ?? "00") &&
      (oldTime[5] ?? "").replace(/0+$/, "") === fraction.replace(/0+$/, "");
    if (same) return previous;
  }
  const candidate = `${body}${before.offset}${before.zone}`;
  if (!before.zone || isDateValueText(candidate)) return candidate;
  try {
    // Keep an explicit offset when valid (including a chosen side of a DST overlap). When
    // seasons change, derive the unique new offset in the same IANA zone. Gaps/undisambiguated
    // overlaps are rejected; return the invalid draft for the existing owner's validation UI.
    const zoned = parseZonedDateTime(`${body}${before.zone}`, "reject");
    const offset =
      /([+-]\d{2}:\d{2}(?::\d{2})?)\[/.exec(zoned.toString())?.[1] ?? "";
    return `${body}${before.offset ? offset : ""}${before.zone}`;
  } catch {
    return candidate;
  }
}

/**
 * A picker projection as the RAC date picker's value (the wall clock it edits): a date, a date and
 * time, or a time; null when empty or not a date. Edits go back through dateValueFromNativeInput.
 */
export function pickerValueOf(
  native: NativeDateInput,
): CalendarDate | CalendarDateTime | Time | null {
  if (native.value === "") return null;
  try {
    if (native.type === "date") return parseDate(native.value);
    if (native.type === "datetime-local") return parseDateTime(native.value);
    if (native.type === "time") return parseTime(native.value);
  } catch {
    /* not a date */
  }
  return null;
}
