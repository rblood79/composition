/**
 * ADR-256 Phase 9 — what a Calendar · RangeCalendar shows, for the Canvas: its visible range, each
 * month block's heading and each grid's weekday row and week rows. The DOM is RAC itself; this is
 * the same date arithmetic on the same `@internationalized/date` calls, as the installed RAC 1.21.0
 * does it without a user's focus change:
 *
 * - visible range: `useCalendarState` — focused = `defaultFocusedValue` ?? `defaultValue` ?? today
 *   (constrained to min/max), start = `alignCenter` (the `selectionAlignment` default), end = start
 *   + `visibleDuration` − 1 day (`react-stately/.../calendar/useCalendarState.mjs` · `utils.mjs`);
 * - a grid at month offset `i`: rows = `getWeeksInMonth` (`weeksInMonth` · the locale's count, or
 *   the weeks/days the duration shows), each row `getDatesInWeek` — a full week from
 *   `startOfWeek(…, firstDayOfWeek)` with `null` before the calendar's first day, or the first
 *   `days` dates when fewer than 7 days show (`useCalendarState.mjs:300-332`);
 * - weekday row: `useCalendarGrid` — narrow names from the week's first day, or the shown days
 *   (`react-aria/.../calendar/useCalendarGrid.mjs:81-105`);
 * - heading: `useCalendarHeading` — the month (long month · numeric year) at the block's offset, or
 *   the day range for a days/weeks view (`useCalendarHeading.mjs`).
 *
 * A cell outside its grid's month (month view) is hidden in the DOM (`CalendarCommon.css`
 * `[data-outside-month] { display: none }`) — here an empty cell.
 */
import {
  type CalendarDate,
  createCalendar,
  DateFormatter,
  endOfMonth,
  getDayOfWeek,
  getWeeksInMonth,
  isSameDay,
  isSameMonth,
  maxDate,
  minDate,
  parseDate,
  startOfMonth,
  startOfWeek,
  toCalendar,
  today as todayIn,
} from "@internationalized/date";
import { catalogCalendarDurationFits } from "../document/valueType";

type DayName = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const DAY_NAMES: readonly DayName[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

interface Duration {
  days?: number;
  weeks?: number;
  months?: number;
}

/** A Calendar's · RangeCalendar's authored `visibleDuration`, else RAC's default (one month). */
export function catalogCalendarDuration(value: unknown): Duration {
  return catalogCalendarDurationFits(value) ? { ...value } : { months: 1 };
}

/** How many month blocks a calendar shows (`visibleDuration.months`; a days/weeks view: one). */
export function catalogCalendarMonthCount(value: unknown): number {
  return catalogCalendarDuration(value).months ?? 1;
}

/** The props the model reads (the calendar node's, its picker's `firstDayOfWeek` folded in). */
export interface CatalogCalendarModelInput {
  readonly visibleDuration?: unknown;
  readonly weeksInMonth?: unknown;
  readonly firstDayOfWeek?: unknown;
  readonly locale?: unknown;
  readonly calendarSystem?: unknown;
  readonly defaultValue?: unknown;
  readonly defaultFocusedValue?: unknown;
  readonly minValue?: unknown;
  readonly maxValue?: unknown;
}

/** One grid: weekday names and week rows (a cell is its day number, or `""` for an empty one). */
export interface CatalogCalendarGridModel {
  readonly weekdays: readonly string[];
  readonly rows: readonly (readonly string[])[];
  /** `[row, column]` of today's cell, when shown. */
  readonly today?: readonly [number, number];
}

interface CalendarContext {
  locale: string;
  duration: Duration;
  firstDayOfWeek?: DayName;
  weeksInMonth?: number;
  start: CalendarDate;
  end: CalendarDate;
  today: CalendarDate;
  /** RAC's focused date (the month · year pickers' value). */
  focused: CalendarDate;
  timeZone: string;
}

/** The locale RAC formats in: the calendar's own (+ its calendar system), else the environment's. */
export function catalogCalendarLocale(
  input: CatalogCalendarModelInput,
  fallbackLocale: string = globalThis.navigator?.language || "en-US",
): string {
  const base =
    typeof input.locale === "string" && input.locale
      ? input.locale
      : fallbackLocale;
  const system =
    typeof input.calendarSystem === "string" ? input.calendarSystem : "";
  return system ? `${base}-u-ca-${system}` : base;
}

/** An authored ISO date (`YYYY-MM-DD…`) as RAC's `CalendarDate`, else undefined. */
export function catalogParseCalendarDay(
  value: unknown,
): CalendarDate | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    return parseDate(value.slice(0, 10));
  } catch {
    return undefined;
  }
}

function constrain(
  date: CalendarDate,
  min?: CalendarDate,
  max?: CalendarDate,
): CalendarDate {
  let out = date;
  if (min) out = maxDate(out, min) as CalendarDate;
  if (max) out = minDate(out, max) as CalendarDate;
  return out;
}

/** `utils.mjs` `alignStart`. */
function alignStart(
  date: CalendarDate,
  duration: Duration,
  locale: string,
  min?: CalendarDate,
  max?: CalendarDate,
): CalendarDate {
  let aligned = date;
  if (duration.months) aligned = startOfMonth(date);
  else if (duration.weeks || (duration.days && duration.days > 7))
    aligned = startOfWeek(date, locale);
  return constrainStart(date, aligned, duration, locale, min, max);
}

/** `utils.mjs` `alignEnd`. */
function alignEnd(
  date: CalendarDate,
  duration: Duration,
  locale: string,
  min?: CalendarDate,
  max?: CalendarDate,
): CalendarDate {
  const d = { ...duration };
  if (d.days) d.days--;
  else if (d.weeks) d.weeks--;
  else if (d.months) d.months--;
  const aligned = alignStart(date, duration, locale).subtract(d);
  return constrainStart(date, aligned, duration, locale, min, max);
}

/** `utils.mjs` `constrainStart`. */
function constrainStart(
  date: CalendarDate,
  aligned: CalendarDate,
  duration: Duration,
  locale: string,
  min?: CalendarDate,
  max?: CalendarDate,
): CalendarDate {
  let out = aligned;
  if (min && date.compare(min) >= 0) {
    const next = maxDate(out, alignStart(min, duration, locale));
    if (next) out = next as CalendarDate;
  }
  if (max && date.compare(max) <= 0) {
    const next = minDate(out, alignEnd(max, duration, locale));
    if (next) out = next as CalendarDate;
  }
  return out;
}

/** `utils.mjs` `alignCenter` (RAC's default `selectionAlignment`). */
function alignCenter(
  date: CalendarDate,
  duration: Duration,
  locale: string,
  min?: CalendarDate,
  max?: CalendarDate,
): CalendarDate {
  const half: Duration = {};
  for (const key of ["days", "weeks", "months"] as const) {
    const count = duration[key];
    if (count === undefined) continue;
    let value = Math.floor(count / 2);
    if (value > 0 && count % 2 === 0) value--;
    half[key] = value;
  }
  const aligned = alignStart(date, duration, locale).subtract(half);
  return constrainStart(date, aligned, duration, locale, min, max);
}

function context(
  input: CatalogCalendarModelInput,
  fallbackLocale: string | undefined,
  now: Date | undefined,
): CalendarContext {
  const locale = catalogCalendarLocale(input, fallbackLocale);
  let formatter: DateFormatter;
  try {
    formatter = new DateFormatter(locale);
  } catch {
    formatter = new DateFormatter("en-US");
  }
  const options = formatter.resolvedOptions();
  const calendar = createCalendar(
    options.calendar as Parameters<typeof createCalendar>[0],
  );
  const timeZone = options.timeZone;
  const today = toCalendar(
    now
      ? (todayIn(timeZone).set({
          year: now.getFullYear(),
          month: now.getMonth() + 1,
          day: now.getDate(),
        }) as CalendarDate)
      : todayIn(timeZone),
    calendar,
  ) as CalendarDate;
  const min = catalogParseCalendarDay(input.minValue);
  const max = catalogParseCalendarDay(input.maxValue);
  const inCalendar = (date: CalendarDate | undefined) =>
    date ? (toCalendar(date, calendar) as CalendarDate) : undefined;
  const focused = constrain(
    inCalendar(catalogParseCalendarDay(input.defaultFocusedValue)) ??
      inCalendar(catalogParseCalendarDay(input.defaultValue)) ??
      today,
    inCalendar(min),
    inCalendar(max),
  );
  const duration = catalogCalendarDuration(input.visibleDuration);
  const start = alignCenter(
    focused,
    duration,
    locale,
    inCalendar(min),
    inCalendar(max),
  );
  const span: Duration = { ...duration };
  if (span.days) span.days--;
  else span.days = -1;
  const end = start.add(span);
  const day = DAY_NAMES.find((name) => name === input.firstDayOfWeek);
  const weeks = input.weeksInMonth;
  return {
    locale,
    duration,
    firstDayOfWeek: day,
    weeksInMonth:
      typeof weeks === "number" && Number.isSafeInteger(weeks) && weeks >= 1
        ? weeks
        : undefined,
    start,
    end,
    today,
    focused,
    timeZone,
  };
}

/**
 * RAC's visible-range title (`useVisibleRangeDescription` — what RAC Calendar puts in its `Heading`
 * without an offset): one month, a month range when whole months show, else the day range.
 */
export function catalogCalendarRangeTitle(
  input: CatalogCalendarModelInput,
  fallbackLocale?: string,
  now?: Date,
): string {
  const ctx = context(input, fallbackLocale, now);
  const { start, end, timeZone, locale } = ctx;
  const options = {
    calendar: start.calendar.identifier,
    timeZone,
  };
  if (isSameDay(start, startOfMonth(start))) {
    const months = new DateFormatter(locale, {
      ...options,
      month: "long",
      year: "numeric",
    });
    const startMonth = start.calendar.getFormattableMonth
      ? start.calendar.getFormattableMonth(start)
      : start;
    const endMonth = end.calendar.getFormattableMonth
      ? end.calendar.getFormattableMonth(end)
      : end;
    if (isSameDay(end, endOfMonth(start)))
      return months.format(startMonth.toDate(timeZone));
    if (isSameDay(end, endOfMonth(end)))
      return months.formatRange(
        startMonth.toDate(timeZone),
        endMonth.toDate(timeZone),
      );
  }
  return new DateFormatter(locale, {
    ...options,
    month: "long",
    year: "numeric",
    day: "numeric",
  }).formatRange(start.toDate(timeZone), end.toDate(timeZone));
}

/** RAC's `CalendarHeading` text at month offset `offset` (`useCalendarHeading`). */
export function catalogCalendarHeading(
  input: CatalogCalendarModelInput,
  offset = 0,
  fallbackLocale?: string,
  now?: Date,
): string {
  const ctx = context(input, fallbackLocale, now);
  const isDays = !!(ctx.duration.days || ctx.duration.weeks);
  const start = offset ? ctx.start.add({ months: offset }) : ctx.start;
  const formatter = new DateFormatter(ctx.locale, {
    day: isDays ? "numeric" : undefined,
    month: "long",
    year: "numeric",
    calendar: start.calendar.identifier,
    timeZone: ctx.timeZone,
  });
  if (isDays)
    return formatter.formatRange(
      start.toDate(ctx.timeZone),
      ctx.end.toDate(ctx.timeZone),
    );
  const display = start.calendar.getFormattableMonth
    ? start.calendar.getFormattableMonth(start)
    : start;
  return formatter.format(display.toDate(ctx.timeZone));
}

/** RAC's `CalendarGrid` at month offset `offset`: weekday names and the week rows' day numbers. */
export function catalogCalendarGrid(
  input: CatalogCalendarModelInput,
  offset = 0,
  fallbackLocale?: string,
  now?: Date,
): CatalogCalendarGridModel {
  const ctx = context(input, fallbackLocale, now);
  const { duration, locale, firstDayOfWeek } = ctx;
  const start = offset ? ctx.start.add({ months: offset }) : ctx.start;
  const isDayView = !!(duration.days && duration.days < 7);
  const dayFormatter = new DateFormatter(locale, {
    weekday: "narrow",
    timeZone: ctx.timeZone,
  });
  const weekStart = isDayView
    ? start
    : startOfWeek(ctx.today, locale, firstDayOfWeek);
  const weekdays = Array.from(
    { length: isDayView ? duration.days! : 7 },
    (_, index) =>
      dayFormatter.format(weekStart.add({ days: index }).toDate(ctx.timeZone)),
  );
  let weeks =
    ctx.weeksInMonth ?? getWeeksInMonth(start, locale, firstDayOfWeek);
  if (duration.weeks || duration.days) {
    weeks = duration.weeks ?? 0;
    if (duration.days) weeks += Math.ceil(duration.days / 7);
  }
  const outsideMonth = (date: CalendarDate) =>
    !(duration.days || duration.weeks) && !isSameMonth(start, date);
  const rows: string[][] = [];
  let todayCell: [number, number] | undefined;
  for (let week = 0; week < weeks; week++) {
    let date: CalendarDate | null = start.add({ weeks: week });
    const days = isDayView ? duration.days! : 7;
    const cells: (CalendarDate | null)[] = [];
    if (days === 7) {
      date = startOfWeek(date, locale, firstDayOfWeek);
      const before = getDayOfWeek(date, locale, firstDayOfWeek);
      for (let i = 0; i < before; i++) cells.push(null);
    }
    while (cells.length < days && date) {
      cells.push(date);
      const next: CalendarDate = date.add({ days: 1 });
      if (isSameDay(date, next)) break;
      date = next;
    }
    while (cells.length < days) cells.push(null);
    rows.push(
      cells.map((cell, column) => {
        if (!cell || outsideMonth(cell)) return "";
        if (isSameDay(cell, ctx.today)) todayCell = [week, column];
        return String(cell.day);
      }),
    );
  }
  return { weekdays, rows, today: todayCell };
}

/**
 * RAC's month · year picker value text (`useCalendarMonthPicker` — the focused date's month,
 * `short`; `useCalendarYearPicker` — its year, `numeric` with the BC era where it applies): what
 * the picker's Select shows as its value.
 */
export function catalogCalendarPickerText(
  input: CatalogCalendarModelInput,
  picker: "month" | "year",
  fallbackLocale?: string,
  now?: Date,
): string {
  const ctx = context(input, fallbackLocale, now);
  const date = ctx.focused;
  if (picker === "month") {
    const display = date.calendar.getFormattableMonth
      ? date.calendar.getFormattableMonth(date)
      : date;
    return new DateFormatter(ctx.locale, {
      month: "short",
      calendar: date.calendar.identifier,
      timeZone: ctx.timeZone,
    }).format(display.toDate(ctx.timeZone));
  }
  return new DateFormatter(ctx.locale, {
    year: "numeric",
    era:
      date.calendar.identifier === "gregory" && date.era === "BC"
        ? "short"
        : undefined,
    calendar: date.calendar.identifier,
    timeZone: ctx.timeZone,
  }).format(date.toDate(ctx.timeZone));
}
