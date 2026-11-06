/** Serializable counterpart of S2 values. Dates use explicit ISO records. */
export type LabeledDate = {
  kind: "date" | "datetime" | "time";
  value: string;
};
export type LabeledValue =
  | string
  | number
  | string[]
  | LabeledDate
  | { start: number; end: number }
  | { start: LabeledDate; end: LabeledDate };
export type LabeledFormat =
  | Intl.NumberFormatOptions
  | Intl.DateTimeFormatOptions
  | Intl.ListFormatOptions;

const plain = (v: unknown): v is Record<string, unknown> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  Object.getPrototypeOf(v) === Object.prototype;

function isDate(value: unknown): value is LabeledDate {
  if (
    !plain(value) ||
    typeof value.value !== "string" ||
    Object.keys(value).length !== 2
  )
    return false;
  if (value.kind === "time") {
    return (
      /^\d{2}:\d{2}(?::\d{2})?$/.test(value.value) &&
      Number(value.value.slice(0, 2)) < 24 &&
      Number(value.value.slice(3, 5)) < 60 &&
      (value.value.length === 5 || Number(value.value.slice(6, 8)) < 60)
    );
  }
  if (value.kind !== "date" && value.kind !== "datetime") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.value.slice(0, 10))) return false;
  if (value.kind === "date" && value.value.length !== 10) return false;
  if (value.kind === "datetime" && !value.value.includes("T")) return false;
  const parsed = Date.parse(value.value);
  if (!Number.isFinite(parsed)) return false;
  const calendarDay = new Date(`${value.value.slice(0, 10)}T00:00:00Z`);
  return calendarDay.toISOString().slice(0, 10) === value.value.slice(0, 10);
}

export function catalogLabeledValueFits(value: unknown): value is LabeledValue {
  if (typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((v) => typeof v === "string");
  if (isDate(value)) return true;
  if (!plain(value) || Object.keys(value).sort().join() !== "end,start")
    return false;
  return (
    (typeof value.start === "number" &&
      typeof value.end === "number" &&
      Number.isFinite(value.start) &&
      Number.isFinite(value.end) &&
      value.start <= value.end) ||
    (isDate(value.start) &&
      isDate(value.end) &&
      value.start.kind === value.end.kind &&
      dateOf(value.start).getTime() <= dateOf(value.end).getTime())
  );
}

const EXTRA_FORMAT_KEYS = [
  "style",
  "type",
  "dateStyle",
  "timeStyle",
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
  "weekday",
  "timeZoneName",
  "currency",
  "unit",
  "unitDisplay",
  "minimumFractionDigits",
  "maximumFractionDigits",
  "minimumSignificantDigits",
  "maximumSignificantDigits",
  "useGrouping",
  "hour12",
  "era",
  "dayPeriod",
  "fractionalSecondDigits",
  "hourCycle",
  "formatMatcher",
  "currencyDisplay",
  "currencySign",
  "signDisplay",
  "notation",
  "compactDisplay",
  "roundingMode",
  "roundingPriority",
  "roundingIncrement",
  "trailingZeroDisplay",
];
const DATE_FORMAT_KEYS = [
  "dateStyle",
  "timeStyle",
  "year",
  "month",
  "day",
  "hour",
  "minute",
  "second",
  "weekday",
  "timeZone",
  "timeZoneName",
  "hour12",
  "hourCycle",
  "era",
  "dayPeriod",
  "fractionalSecondDigits",
  "formatMatcher",
];

export function catalogLabeledFormatFits(
  value: unknown,
): value is LabeledFormat {
  if (
    !plain(value) ||
    Object.values(value).some(
      (v) => !["string", "number", "boolean"].includes(typeof v),
    )
  )
    return false;
  try {
    const allowed = new Set([
      ...Object.keys(new Intl.NumberFormat("en").resolvedOptions()),
      ...Object.keys(new Intl.DateTimeFormat("en").resolvedOptions()),
      ...EXTRA_FORMAT_KEYS,
    ]);
    if (Object.keys(value).some((k) => !allowed.has(k))) return false;
    if (["conjunction", "disjunction", "unit"].includes(String(value.type)))
      new Intl.ListFormat("en", value as Intl.ListFormatOptions);
    else if (Object.keys(value).some((k) => DATE_FORMAT_KEYS.includes(k)))
      new Intl.DateTimeFormat("en", value);
    else new Intl.NumberFormat("en", value);
    return true;
  } catch {
    return false;
  }
}

function dateOf(value: LabeledDate): Date {
  return new Date(
    value.kind === "time" ? `1970-01-01T${value.value}Z` : value.value,
  );
}

/** Switching a value's kind can leave another kind's formatting in a document.
 * Each Intl constructor validates its own options; incompatible options use that kind's default.
 */
function formatter<T>(
  create: (options: LabeledFormat | undefined) => T,
  options: LabeledFormat | undefined,
): T {
  try {
    return create(options);
  } catch {
    return create(undefined);
  }
}

export function formatLabeledValue(
  value: unknown,
  locale?: string,
  options?: unknown,
): string {
  if (!catalogLabeledValueFits(value)) return "";
  const opts = catalogLabeledFormatFits(options) ? options : undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number")
    return formatter(
      (options) =>
        new Intl.NumberFormat(locale, options as Intl.NumberFormatOptions),
      opts,
    ).format(value);
  if (Array.isArray(value))
    return formatter(
      (options) =>
        new Intl.ListFormat(locale, options as Intl.ListFormatOptions),
      opts,
    ).format(value);
  const sample = "start" in value ? value.start : value;
  if (typeof sample === "number" && "start" in value)
    return formatter(
      (options) =>
        new Intl.NumberFormat(locale, options as Intl.NumberFormatOptions),
      opts,
    ).formatRange(value.start as number, value.end as number);
  const date = sample as LabeledDate;
  const defaults: Intl.DateTimeFormatOptions =
    date.kind === "date"
      ? { dateStyle: "long", timeZone: "UTC" }
      : date.kind === "time"
        ? { timeStyle: "short", timeZone: "UTC" }
        : { dateStyle: "long", timeStyle: "short" };
  const dateFormatter = formatter(
    (options) =>
      new Intl.DateTimeFormat(locale, {
        ...(date.kind !== "datetime" ? { timeZone: "UTC" } : {}),
        ...(options ?? defaults),
      } as Intl.DateTimeFormatOptions),
    opts,
  );
  return "start" in value
    ? dateFormatter.formatRange(
        dateOf(value.start as LabeledDate),
        dateOf(value.end as LabeledDate),
      )
    : dateFormatter.format(dateOf(value as LabeledDate));
}
