/**
 * The date segments RAC renders for an empty DateInput (`useDateFieldState`): the locale's
 * `Intl.DateTimeFormat` parts (year · month · day numeric, time fields `minute`/`second` 2-digit),
 * each editable field shown as its placeholder and each literal as written. Canvas measures the
 * same parts the DOM lays out, so a DateInput's content box is the RAC segment row.
 *
 * Placeholders mirror react-stately `datepicker/placeholders` (Chrome/Firefox `<input type=date>`
 * strings, Apache-2.0) for the locales the builder offers; other languages fall back to `en` like
 * RAC's dictionary. Time fields show `––`; `dayPeriod` / `era` show their value.
 */
const PLACEHOLDERS: Readonly<
  Record<string, { year: string; month: string; day: string }>
> = {
  en: { year: "yyyy", month: "mm", day: "dd" },
  de: { year: "jjjj", month: "mm", day: "tt" },
  es: { year: "aaaa", month: "mm", day: "dd" },
  fr: { year: "aaaa", month: "mm", day: "jj" },
  it: { year: "aaaa", month: "mm", day: "gg" },
  ja: { year: "年", month: "月", day: "日" },
  ko: { year: "연도", month: "월", day: "일" },
  pt: { year: "aaaa", month: "mm", day: "dd" },
  ru: { year: "гггг", month: "мм", day: "дд" },
  zh: { year: "年", month: "月", day: "日" },
};

export interface DateSegmentPart {
  text: string;
  /** Editable field (padded) vs literal separator. */
  editable: boolean;
  /**
   * ADR-309 — an editable field showing the value, not its placeholder (`false`): the field's text
   * paint, not the owner's `[data-placeholder]` one. Unset = `editable`.
   */
  placeholder?: boolean;
}

/**
 * ADR-309 Decision 4 — the value a DateInput shows, as RAC formats it (`useDateFieldState`): its
 * fields' numbers in the formatter's calendar (`toDate` in the value's zone, else UTC — a time's
 * fields on a fixed day).
 */
export interface DateSegmentValue {
  readonly year?: number;
  readonly hour?: number;
  readonly minute?: number;
  readonly second?: number;
  readonly timeZone?: string;
  toDate?(timeZone: string): Date;
}

/** RAC `getFormatOptions` (`datepicker/utils`): two-digit fields when leading zeros are forced. */
const DEFAULT_FIELDS = {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
} as const;
const TWO_DIGIT_FIELDS = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
} as const;

/**
 * The hour cycle a date field's DOM renderer gives RAC: the typed enum value as a number
 * (`DateRenderers` `Number(props.hourCycle)`), a TimeField's component default 24 when unset.
 */
export function racFieldHourCycle(
  ownerType: string | undefined,
  value: unknown,
): 12 | 24 | undefined {
  const cycle = value === undefined || value === "" ? NaN : Number(value);
  if (cycle === 12 || cycle === 24) return cycle;
  return ownerType === "TimeField" ? 24 : undefined;
}

export function racDateSegmentParts(options: {
  locale?: string;
  granularity?: string;
  hourCycle?: number;
  /** RAC `maxGranularity`: `"hour"` formats the time fields only (`useTimeFieldState`). */
  maxGranularity?: "hour";
  /** ADR-309 — the value the field shows (its segments' text), else the empty placeholders. */
  value?: DateSegmentValue;
  /** RAC `shouldForceLeadingZeros` (the DOM's default `true`). */
  shouldForceLeadingZeros?: boolean;
  /** RAC `hideTimeZone` (the DOM's default `true`): a zoned value's zone name otherwise. */
  hideTimeZone?: boolean;
}): DateSegmentPart[] {
  const locale = options.locale || "en-US";
  const timeOnly = options.maxGranularity === "hour";
  const granularity = options.granularity || (timeOnly ? "minute" : "day");
  if (options.value) return valueParts(options, locale, granularity, timeOnly);
  const hasTime =
    granularity === "hour" ||
    granularity === "minute" ||
    granularity === "second";
  const format = new Intl.DateTimeFormat(locale, {
    ...(timeOnly ? {} : { year: "numeric", month: "numeric", day: "numeric" }),
    ...(hasTime
      ? {
          hour: "numeric",
          ...(granularity !== "hour" ? { minute: "2-digit" } : {}),
          ...(granularity === "second" ? { second: "2-digit" } : {}),
          ...(options.hourCycle === 12
            ? { hour12: true }
            : options.hourCycle === 24
              ? { hourCycle: "h23" as const }
              : {}),
        }
      : {}),
  });
  const language = locale.split("-")[0];
  const placeholder =
    PLACEHOLDERS[locale] ?? PLACEHOLDERS[language] ?? PLACEHOLDERS.en;
  // RAC's placeholder value is midnight (`createPlaceholderDate`): the day period shows its value.
  return format.formatToParts(new Date(2000, 0, 1, 0)).map((part) => {
    if (part.type === "literal") return { text: part.value, editable: false };
    if (part.type === "year" || part.type === "month" || part.type === "day")
      return { text: placeholder[part.type], editable: true };
    if (part.type === "dayPeriod" || part.type === "era")
      return { text: part.value, editable: true };
    return { text: "\u2013\u2013", editable: true };
  });
}

/** The value's segments (ADR-309): RAC's format options at the granularity, the value's parts. */
function valueParts(
  options: Parameters<typeof racDateSegmentParts>[0],
  locale: string,
  granularity: string,
  timeOnly: boolean,
): DateSegmentPart[] {
  const value = options.value!;
  const fields =
    options.shouldForceLeadingZeros === false
      ? DEFAULT_FIELDS
      : TWO_DIGIT_FIELDS;
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  const start = timeOnly ? keys.indexOf("hour") : 0;
  const end = Math.max(keys.indexOf(granularity as keyof typeof fields), 2);
  const zone = typeof value.timeZone === "string" ? value.timeZone : undefined;
  const hasTime = ["hour", "minute", "second"].includes(granularity);
  const format: Intl.DateTimeFormatOptions = {
    ...Object.fromEntries(
      keys.slice(start, end + 1).map((key) => [key, fields[key]]),
    ),
    ...(options.hourCycle === 12
      ? { hour12: true }
      : options.hourCycle === 24
        ? { hour12: false }
        : {}),
    timeZone: zone ?? "UTC",
    ...(hasTime && zone && options.hideTimeZone === false
      ? { timeZoneName: "short" as const }
      : {}),
  };
  const date =
    typeof value.toDate === "function" && value.year !== undefined
      ? value.toDate(zone ?? "UTC")
      : new Date(
          Date.UTC(
            2000,
            0,
            1,
            value.hour ?? 0,
            value.minute ?? 0,
            value.second ?? 0,
          ),
        );
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale, format);
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", format);
  }
  return formatter.formatToParts(date).map((part) => {
    // (RAC: a zone name is shown, not edited — `EDITABLE_SEGMENTS`.)
    if (part.type === "literal" || part.type === "timeZoneName")
      return { text: part.value, editable: false };
    return { text: part.value, editable: true, placeholder: false };
  });
}
