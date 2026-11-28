/**
 * ADR-323 Phase 3 — what an EventCalendar's month view and agenda show (breakdown §5.4): the
 * reference date, the month's title, the whole weeks the month grid shows (with the days outside
 * the month — an event calendar draws their events too), the visible window those days make
 * (`scheduleWindowQuery.ts` reads it), the step of 「이전 · 다음 · 오늘」, and the days' event lists
 * (the agenda's sections, a picked day's list). Pure — the Canvas (the start values) and the DOM
 * (the run's reference date and view) read the same functions. The month's line assignment and
 * 「+N」 are the lazy geometry's (`@composition/rendering/schedule/timeGrid` `layoutScheduleDayBands`
 * — it takes `days`).
 *
 * Dates follow the component's calendar system and locale (`dateLocaleProps.ts` — RAC's
 * `I18nProvider` locale with `-u-ca-`): the grid is that calendar's month; each day also carries its
 * Gregorian ISO day (`date` — the window, the rows' values) and its wall day (`wall` — UTC ms of
 * that day, the geometry's clock, `scheduleSpan.ts`). The reference date is the authored
 * `defaultDate`, else today in the component's zone (사용자 결정 7).
 */
import {
  type CalendarDate,
  createCalendar,
  DateFormatter,
  fromAbsolute,
  getWeeksInMonth,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  toCalendar,
  toCalendarDate,
} from "@internationalized/date";

import {
  SCHEDULE_DAY_MS,
  type ScheduleSpan,
} from "../../collections/scheduleSpan";
import {
  catalogCalendarHeading,
  catalogCalendarLocale,
  catalogParseCalendarDay,
} from "./calendarModel";
import type { ScheduleWindowDays } from "./scheduleWindowQuery";

type DayName = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const DAY_NAMES: readonly string[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

/** The views Phase 3 draws (week · day — Phase 4). */
export type CatalogEventCalendarViewKind = "month" | "agenda";
export const CATALOG_EVENT_CALENDAR_VIEWS: readonly CatalogEventCalendarViewKind[] =
  ["month", "agenda"];

/** A view key as the header's ToggleButtonGroup holds it; anything else is the month view. */
export function catalogEventCalendarViewOf(
  key: unknown,
): CatalogEventCalendarViewKind {
  return key === "agenda" ? "agenda" : "month";
}

/** The props the model reads (the EventCalendar's — the zone already resolved). */
export interface CatalogEventCalendarInput {
  /** The authored start date (`defaultDate`), or the run's reference date — an ISO day. */
  readonly referenceDate?: unknown;
  readonly locale?: unknown;
  readonly calendarSystem?: unknown;
  readonly firstDayOfWeek?: unknown;
  /** `resolveScheduleTimeZone` of the component's `timeZone`. */
  readonly timeZone: string;
}

interface Context {
  readonly locale: string;
  readonly firstDayOfWeek?: DayName;
  readonly reference: CalendarDate;
  readonly today: CalendarDate;
  readonly timeZone: string;
}

const GREGORIAN = createCalendar("gregory");

function context(
  input: CatalogEventCalendarInput,
  fallbackLocale?: string,
  now?: Date,
): Context {
  const locale = catalogCalendarLocale(input, fallbackLocale);
  const system =
    typeof input.calendarSystem === "string" && input.calendarSystem
      ? input.calendarSystem
      : undefined;
  const calendar = system ? createCalendar(system as never) : GREGORIAN;
  const today = toCalendar(
    toCalendarDate(fromAbsolute((now ?? new Date()).getTime(), input.timeZone)),
    calendar,
  );
  const authored = catalogParseCalendarDay(input.referenceDate);
  return {
    locale,
    ...(typeof input.firstDayOfWeek === "string" &&
    DAY_NAMES.includes(input.firstDayOfWeek)
      ? { firstDayOfWeek: input.firstDayOfWeek as DayName }
      : {}),
    reference: authored ? toCalendar(authored, calendar) : today,
    today,
    timeZone: input.timeZone,
  };
}

/** A date's Gregorian ISO day (`YYYY-MM-DD`). */
function isoDay(date: CalendarDate): string {
  return toCalendar(date, GREGORIAN).toString();
}

/** A date's wall day — UTC ms of its Gregorian day (`scheduleSpan.ts` — the geometry's clock). */
function wallDay(date: CalendarDate): number {
  const day = toCalendar(date, GREGORIAN);
  return new Date(0).setUTCFullYear(day.year, day.month - 1, day.day);
}

/** The reference date as an ISO day (the run's state starts from it). */
export function catalogEventCalendarReference(
  input: CatalogEventCalendarInput,
  now?: Date,
): string {
  return isoDay(context(input, undefined, now).reference);
}

/**
 * 「이전 · 다음」 — the reference date a month (`step` = −1 · +1) away (both views show a month), or
 * today (`step` = 0 — 「오늘」), as an ISO day.
 */
export function catalogEventCalendarStep(
  input: CatalogEventCalendarInput,
  step: -1 | 0 | 1,
  now?: Date,
): string {
  const ctx = context(input, undefined, now);
  if (step === 0) return isoDay(ctx.today);
  return isoDay(startOfMonth(ctx.reference).add({ months: step }));
}

/** The title of the period shown — the reference month (RAC's `CalendarHeading` text). */
export function catalogEventCalendarTitle(
  input: CatalogEventCalendarInput,
  fallbackLocale?: string,
  now?: Date,
): string {
  const ctx = context(input, fallbackLocale, now);
  return catalogCalendarHeading(
    {
      defaultFocusedValue: isoDay(ctx.reference),
      locale: input.locale,
      calendarSystem: input.calendarSystem,
      firstDayOfWeek: input.firstDayOfWeek,
    },
    0,
    fallbackLocale,
    now,
  );
}

export interface CatalogEventCalendarDay {
  /** The Gregorian ISO day. */
  readonly date: string;
  /** The day's number in the component's calendar. */
  readonly day: string;
  /** UTC ms of the day (the geometry's `days`). */
  readonly wall: number;
  /** Outside the reference month (a leading · trailing day of the first · last week). */
  readonly outside: boolean;
  readonly today: boolean;
}

export interface CatalogEventCalendarMonth {
  readonly title: string;
  /** The weekday names from the week's first day (`short`). */
  readonly weekdays: readonly string[];
  /** Week rows of 7 days — the whole weeks covering the month (the locale's week count). */
  readonly weeks: readonly (readonly CatalogEventCalendarDay[])[];
  /** The days the grid shows: its first day to the day after its last. */
  readonly window: ScheduleWindowDays;
}

/**
 * The month view: the reference month's weeks (`getWeeksInMonth` from `startOfWeek` of its first
 * day — RAC's `CalendarGrid` rows), every cell a date (RAC hides the outside ones in a date picker;
 * an event calendar shows them, dimmed, with their events).
 */
export function catalogEventCalendarMonth(
  input: CatalogEventCalendarInput,
  fallbackLocale?: string,
  now?: Date,
): CatalogEventCalendarMonth {
  const ctx = context(input, fallbackLocale, now);
  const first = startOfMonth(ctx.reference);
  const count = getWeeksInMonth(first, ctx.locale, ctx.firstDayOfWeek);
  const start = startOfWeek(first, ctx.locale, ctx.firstDayOfWeek);
  const weekday = new DateFormatter(ctx.locale, {
    weekday: "short",
    timeZone: ctx.timeZone,
  });
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    weekday.format(start.add({ days: index }).toDate(ctx.timeZone)),
  );
  const weeks: CatalogEventCalendarDay[][] = [];
  for (let week = 0; week < count; week++) {
    const row: CatalogEventCalendarDay[] = [];
    for (let column = 0; column < 7; column++) {
      const date = start.add({ days: week * 7 + column });
      row.push({
        date: isoDay(date),
        day: String(date.day),
        wall: wallDay(date),
        outside: !isSameMonth(date, first),
        today: isSameDay(date, ctx.today),
      });
    }
    weeks.push(row);
  }
  const last = start.add({ days: count * 7 });
  return {
    title: catalogEventCalendarTitle(input, fallbackLocale, now),
    weekdays,
    weeks,
    window: { from: isoDay(start), until: isoDay(last) },
  };
}

/** The agenda's window — the reference month (its first day to the next month's). */
export function catalogEventCalendarAgendaWindow(
  input: CatalogEventCalendarInput,
  now?: Date,
): ScheduleWindowDays {
  const first = startOfMonth(context(input, undefined, now).reference);
  return { from: isoDay(first), until: isoDay(first.add({ months: 1 })) };
}

export interface CatalogEventCalendarDayEvents<Row> {
  readonly date: string;
  readonly wall: number;
  readonly events: readonly {
    readonly row: Row;
    readonly span: ScheduleSpan;
  }[];
}

/**
 * The days of `window` that have events, each with the events covering it (wall days — a span
 * over several days is in each of them; a zero-length one on its moment's day): all-day first,
 * then by start instant, then the longer first, then the order given. The agenda's sections and a
 * picked day's list (`window` of that one day).
 */
export function catalogEventCalendarDayEvents<Row>(
  events: readonly { readonly row: Row; readonly span: ScheduleSpan }[],
  window: ScheduleWindowDays,
): CatalogEventCalendarDayEvents<Row>[] {
  const from = Date.parse(`${window.from}T00:00:00Z`);
  const until = Date.parse(`${window.until}T00:00:00Z`);
  const order = events
    .map((event, index) => ({ event, index }))
    .sort(
      (a, b) =>
        Number(b.event.span.allDay) - Number(a.event.span.allDay) ||
        a.event.span.start - b.event.span.start ||
        b.event.span.end -
          b.event.span.start -
          (a.event.span.end - a.event.span.start) ||
        a.index - b.index,
    )
    .map(({ event }) => event);
  const out: CatalogEventCalendarDayEvents<Row>[] = [];
  for (let wall = from; wall < until; wall += SCHEDULE_DAY_MS) {
    const end = wall + SCHEDULE_DAY_MS;
    const covering = order.filter(({ span }) =>
      span.wallEnd === span.wallStart
        ? span.wallStart >= wall && span.wallStart < end
        : span.wallStart < end && span.wallEnd > wall,
    );
    if (covering.length)
      out.push({
        date: new Date(wall).toISOString().slice(0, 10),
        wall,
        events: covering,
      });
  }
  return out;
}
