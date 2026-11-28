/**
 * ADR-323 Phase 1 — reading a row's date-axis values as a span (breakdown §5.1). The query's precise
 * filter (Decision 8), the geometry (`@composition/rendering/schedule/*` — it takes the `wall*`
 * values) and the writes read this one function — 「실제 끝」 is defined here only.
 *
 * Time zone (사용자 결정 7, 2026-11-28 「둘 다」): the component's `timeZone` (IANA) when it is a
 * zone the browser knows, else the viewer's browser zone (`resolveScheduleTimeZone`).
 *
 * Two clocks:
 * - **instant** — epoch ms of the moment (the overlap contract, writes).
 * - **wall** — the same moment's local date and time in the zone written as if it were UTC
 *   (`instant + offset`). A local midnight is a multiple of a day, so the geometry places days,
 *   hours and months with UTC arithmetic and needs no zone; a daylight-saving day keeps its 24 wall
 *   hours (the 02:00 ~ 03:00 that does not exist is drawn empty, the repeated hour twice over).
 *
 * Values: ISO texts in the shapes `parseDateValue` reads (a day · a day and time without offset —
 * read in the zone · with an offset or zone — an instant), a `Date`, epoch ms. A day only value
 * (precision `date`) is all-day: from its day's 00:00 to the end day's 00:00 (end exclusive — HC8),
 * one day when there is no end.
 */
import {
  CalendarDate,
  fromAbsolute,
  getLocalTimeZone,
  toZoned,
} from "@internationalized/date";

import { parseDateValue } from "../state/dateValue";

export const SCHEDULE_DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

const zoneCache = new Map<string, boolean>();

/** Whether `zone` is an IANA zone this runtime knows (`Intl` accepts it). */
function zoneKnown(zone: string): boolean {
  let known = zoneCache.get(zone);
  if (known === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      known = true;
    } catch {
      known = false;
    }
    zoneCache.set(zone, known);
  }
  return known;
}

/** 사용자 결정 7 — the component's `timeZone` when known, else the browser's zone. */
export function resolveScheduleTimeZone(timeZone: unknown): string {
  if (typeof timeZone === "string") {
    const zone = timeZone.trim();
    if (zone !== "" && zoneKnown(zone)) return zone;
  }
  return getLocalTimeZone();
}

export interface ScheduleInstant {
  readonly instant: number;
  readonly wall: number;
  /** The value had no time (precision `date`). */
  readonly dateOnly: boolean;
}

/** `instant` as the zone's wall clock (`instant + offset`). */
export function scheduleWallOf(instant: number, timeZone: string): number {
  return instant + fromAbsolute(instant, timeZone).offset;
}

/** The first instant of a wall day (a multiple of a day) in the zone. */
export function scheduleWallDayStart(
  wallDay: number,
  timeZone: string,
): number {
  const date = new Date(wallDay);
  return new CalendarDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  )
    .toDate(timeZone)
    .getTime();
}

function floorDay(wall: number): number {
  return Math.floor(wall / SCHEDULE_DAY_MS) * SCHEDULE_DAY_MS;
}

/** A value as an instant in the zone; undefined when it is no date (a time only, bad text). */
export function readScheduleInstant(
  value: unknown,
  timeZone: string,
): ScheduleInstant | undefined {
  if (value instanceof Date) {
    const instant = value.getTime();
    return Number.isFinite(instant)
      ? { instant, wall: scheduleWallOf(instant, timeZone), dateOnly: false }
      : undefined;
  }
  if (typeof value === "number")
    return Number.isFinite(value)
      ? {
          instant: value,
          wall: scheduleWallOf(value, timeZone),
          dateOnly: false,
        }
      : undefined;
  if (typeof value !== "string") return undefined;
  const parsed = parseDateValue(value);
  if (!parsed) return undefined;
  switch (parsed.kind) {
    case "date": {
      const { year, month, day } = parsed.value;
      const wall = new Date(0).setUTCFullYear(year, month - 1, day);
      return {
        instant: parsed.value.toDate(timeZone).getTime(),
        wall,
        dateOnly: true,
      };
    }
    case "dateTime": {
      const instant = toZoned(parsed.value, timeZone).toDate().getTime();
      return {
        instant,
        wall: scheduleWallOf(instant, timeZone),
        dateOnly: false,
      };
    }
    case "zoned": {
      const instant = parsed.value.toDate().getTime();
      return {
        instant,
        wall: scheduleWallOf(instant, timeZone),
        dateOnly: false,
      };
    }
    default:
      return undefined;
  }
}

export interface ScheduleSpan {
  /** Instants — the overlap contract and writes. */
  readonly start: number;
  readonly end: number;
  /** Wall clock — the geometry. All-day spans are whole wall days. */
  readonly wallStart: number;
  readonly wallEnd: number;
  readonly allDay: boolean;
}

export type ScheduleSpanRefusal =
  "noStart" | "badStart" | "badEnd" | "reversed";

export type ScheduleSpanResult =
  | { readonly ok: true; readonly span: ScheduleSpan }
  | { readonly ok: false; readonly reason: ScheduleSpanRefusal };

export interface ScheduleSpanOptions {
  readonly timeZone: string;
  /** A timed value without an end lasts this long (EventCalendar: one slot). */
  readonly defaultDurationMinutes: number;
  /**
   * Keep an all-day span whose end day is its start day at zero length (Gantt's milestone — 시작 =
   * 끝). Otherwise it is one day.
   */
  readonly keepZeroLength?: boolean;
}

function empty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

/**
 * A row's span — 「실제 끝」 = the end value, else start + the default length (a day for an all-day
 * value). An end before the start is refused (`reversed`) — the caller counts it, nothing is drawn.
 */
export function readScheduleSpan(
  values: {
    readonly start: unknown;
    readonly end?: unknown;
    readonly allDay?: unknown;
  },
  options: ScheduleSpanOptions,
): ScheduleSpanResult {
  const { timeZone } = options;
  if (empty(values.start)) return { ok: false, reason: "noStart" };
  const start = readScheduleInstant(values.start, timeZone);
  if (!start) return { ok: false, reason: "badStart" };
  const hasEnd = !empty(values.end);
  const end = hasEnd ? readScheduleInstant(values.end, timeZone) : undefined;
  if (hasEnd && !end) return { ok: false, reason: "badEnd" };

  if (values.allDay === true || start.dateOnly) {
    const wallStart = floorDay(start.wall);
    let wallEnd = wallStart + SCHEDULE_DAY_MS;
    if (end) {
      const endDay = floorDay(end.wall);
      // A timed end inside a day ends that day (end exclusive — the next midnight).
      wallEnd =
        end.dateOnly || endDay === end.wall ? endDay : endDay + SCHEDULE_DAY_MS;
      if (wallEnd < wallStart) return { ok: false, reason: "reversed" };
      if (wallEnd === wallStart && !options.keepZeroLength)
        wallEnd = wallStart + SCHEDULE_DAY_MS;
    }
    return {
      ok: true,
      span: {
        start: scheduleWallDayStart(wallStart, timeZone),
        end: scheduleWallDayStart(wallEnd, timeZone),
        wallStart,
        wallEnd,
        allDay: true,
      },
    };
  }

  const endInstant = end
    ? end.instant
    : start.instant + options.defaultDurationMinutes * MINUTE_MS;
  if (endInstant < start.instant) return { ok: false, reason: "reversed" };
  return {
    ok: true,
    span: {
      start: start.instant,
      end: endInstant,
      wallStart: start.wall,
      wallEnd: end ? end.wall : scheduleWallOf(endInstant, timeZone),
      allDay: false,
    },
  };
}

/**
 * The overlap contract (Decision 8): a span is in the window `[start, end)` (instants) when it starts
 * before the window's end and ends after its start; a zero-length span when its moment is in it.
 */
export function scheduleSpanOverlaps(
  span: Pick<ScheduleSpan, "start" | "end">,
  window: { readonly start: number; readonly end: number },
): boolean {
  if (span.end === span.start)
    return span.start >= window.start && span.start < window.end;
  return span.start < window.end && span.end > window.start;
}
