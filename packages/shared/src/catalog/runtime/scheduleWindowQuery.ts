/**
 * ADR-323 Phase 3 — the visible period's query (Decision 8 · breakdown §5.4.1, HC10): which rows an
 * EventCalendar reads for its window, without dropping one that crosses it.
 *
 * - **The overlap contract** is `scheduleSpanOverlaps` (`collections/scheduleSpan.ts`) — a span is
 *   in `[window start, window end)` when it starts before the end and its 「실제 끝」 is after the
 *   start. A single date field's `between` is never it: it drops a span crossing the whole window
 *   and takes one starting on the window's end day.
 * - **The query is a day superset** (`scheduleWindowConditions`): date comparisons are by day, and
 *   the day is the stored text's (`viewDay` — no zone), so it differs from the viewer's day by up
 *   to two days (offsets −12:00 ~ +14:00). The conditions take `SCHEDULE_QUERY_MARGIN_DAYS` more on
 *   each side; whichever zone a server reads the days in, it is inside them.
 * - **The precise filter** (`scheduleRowsInWindow`) runs the contract on the received rows with
 *   exact instants in the component's zone before the geometry — the superset's extra (the margin,
 *   the window end day's spans) leaves here.
 * - **Where it runs** (`scheduleWindowRequest`): a request carries the conditions only when it can
 *   carry all of them; else nothing is sent and the rows load whole to the cap (the session refuses
 *   past it — never a part).
 *
 * Reads no serializer (`view/serialize` brings the row intake) — the conditions are a view's, the
 * session joins them to the binding's view by `and` the way a Table state's are
 * (`catalogTableStateQueries`).
 */
import type {
  DataFieldId,
  ViewCondition,
  ViewConditionGroup,
} from "../document/types";
import { DEFAULT_QUERY_SUFFIXES } from "../../collections/view/querySuffixes";
import {
  readScheduleSpan,
  scheduleSpanOverlaps,
  scheduleWallDayStart,
  SCHEDULE_DAY_MS,
  type ScheduleSpan,
  type ScheduleSpanOptions,
  type ScheduleSpanRefusal,
} from "../../collections/scheduleSpan";

/**
 * The day superset's margin on each side (breakdown §5.4.1): a stored offset (−12:00 ~ +14:00)
 * and a viewing zone in the same range put the same moment's text day up to two days from the
 * viewer's day (26 hours). One constant — the conditions and G3's answer table read it.
 */
export const SCHEDULE_QUERY_MARGIN_DAYS = 2;

/** The id of the conditions' group in a view (the session joins it to the binding's by `and`). */
export const SCHEDULE_WINDOW_CONDITION = "schedule-window";

/** A visible period as wall days in the component's zone — `until` exclusive (`YYYY-MM-DD`). */
export interface ScheduleWindowDays {
  readonly from: string;
  readonly until: string;
}

/** The fields the conditions compare (the binding's `start` · `end` roles, as field ids). */
export interface ScheduleWindowFields {
  readonly start: DataFieldId;
  readonly end?: DataFieldId;
}

const DAY_TEXT = /^\d{4}-\d{2}-\d{2}$/;

function dayMs(day: string): number {
  if (!DAY_TEXT.test(day)) throw new Error(`not a day: ${day}`);
  return Date.parse(`${day}T00:00:00Z`);
}

/** `day` moved by `days` (`YYYY-MM-DD`). */
export function scheduleShiftDay(day: string, days: number): string {
  return new Date(dayMs(day) + days * SCHEDULE_DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/**
 * The default length in whole days, for the condition on a span without an end: a timed value
 * lasts `defaultDurationMinutes`, an all-day one a day — at least one day either way.
 */
export function scheduleDefaultLengthDays(defaultDurationMinutes: number) {
  return Math.max(1, Math.ceil(defaultDurationMinutes / 1440));
}

/**
 * The window's day superset as a view's conditions (breakdown §5.4.1). Date comparisons are
 * `before` · `after` (ends excluded) and `between` (both included):
 * - with an end role — `start before (until + margin + 1)` and ( `end after (from − margin − 1)` or
 *   ( `end notExists` and `start after (from − margin − 1 − default days)` ) );
 * - without one — `start between [from − margin − default days, until + margin]`.
 */
export function scheduleWindowConditions(
  fields: ScheduleWindowFields,
  window: ScheduleWindowDays,
  defaultDurationMinutes: number,
): ViewConditionGroup {
  const margin = SCHEDULE_QUERY_MARGIN_DAYS;
  const lengthDays = scheduleDefaultLengthDays(defaultDurationMinutes);
  const start = [fields.start] as const;
  const id = (name: string) => `${SCHEDULE_WINDOW_CONDITION}:${name}`;
  if (!fields.end) {
    const between: ViewCondition = {
      id: id("start"),
      fields: [start],
      op: "between",
      value: [
        scheduleShiftDay(window.from, -margin - lengthDays),
        scheduleShiftDay(window.until, margin),
      ],
    };
    return { id: SCHEDULE_WINDOW_CONDITION, op: "and", items: [between] };
  }
  const end = [fields.end] as const;
  const before = scheduleShiftDay(window.from, -margin - 1);
  return {
    id: SCHEDULE_WINDOW_CONDITION,
    op: "and",
    items: [
      {
        id: id("start"),
        fields: [start],
        op: "before",
        value: scheduleShiftDay(window.until, margin + 1),
      },
      {
        id: id("ends"),
        op: "or",
        items: [
          { id: id("end"), fields: [end], op: "after", value: before },
          {
            id: id("open"),
            op: "and",
            items: [
              { id: id("noEnd"), fields: [end], op: "notExists" },
              {
                id: id("openStart"),
                fields: [start],
                op: "after",
                value: scheduleShiftDay(before, -lengthDays),
              },
            ],
          },
        ],
      },
    ],
  };
}

/** How a collection's rows are served, as the request decision reads it. */
export interface ScheduleWindowService {
  /** The rows load from an endpoint. */
  readonly remote: boolean;
  /** The endpoint's query format (`querySerialization`), absent = none declared. */
  readonly format?: {
    readonly kind?: unknown;
    readonly suffixes?: Readonly<Record<string, unknown>>;
  };
}

/**
 * Where the window's conditions run (breakdown §5.4.1 table):
 * - `here` — the rows are all here (a local collection): the conditions · the precise filter run
 *   on them;
 * - `send` — a `body` format carries every condition (the 「또는」 group included), a `suffix`
 *   format the end-less configuration's `start` range (both `gte` · `lte` suffixes named);
 * - `loadWhole` — the request cannot carry them all (a `suffix` format with an end role cannot
 *   carry the 「또는」 — `OR_GROUP` — and dropping it would lose the rows without an end; a suffix
 *   table without both range suffixes; no format): nothing is sent, every page loads to the cap
 *   (`VIEW_LOCAL_LOAD_CAP`), the conditions and the precise filter run here.
 */
export function scheduleWindowRequest(
  service: ScheduleWindowService,
  hasEnd: boolean,
): "here" | "send" | "loadWhole" {
  if (!service.remote) return "here";
  const kind = service.format?.kind;
  if (kind === "body") return "send";
  if (kind !== "suffix" || hasEnd) return "loadWhole";
  const suffixes = service.format?.suffixes ?? DEFAULT_QUERY_SUFFIXES;
  return suffixes.gte !== undefined && suffixes.lte !== undefined
    ? "send"
    : "loadWhole";
}

/** The window's instants — its wall days' first moments in the zone. */
export function scheduleWindowInstants(
  window: ScheduleWindowDays,
  timeZone: string,
): { readonly start: number; readonly end: number } {
  return {
    start: scheduleWallDayStart(dayMs(window.from), timeZone),
    end: scheduleWallDayStart(dayMs(window.until), timeZone),
  };
}

export interface ScheduleWindowRow<Row> {
  readonly row: Row;
  readonly span: ScheduleSpan;
}

export interface ScheduleWindowRows<Row> {
  /** The rows in the window, in the order received, with their spans (the geometry's input). */
  readonly rows: readonly ScheduleWindowRow<Row>[];
  /** Rows refused by the reader (no start · unreadable · end before start), counted by reason. */
  readonly refused: Readonly<Partial<Record<ScheduleSpanRefusal, number>>>;
}

/**
 * The precise filter (Decision 8): each received row's span (`readScheduleSpan` — 「실제 끝」 in the
 * component's zone) kept when it overlaps the window's instants (`scheduleSpanOverlaps`).
 */
export function scheduleRowsInWindow<Row>(
  rows: readonly Row[],
  valuesOf: (row: Row) => {
    readonly start: unknown;
    readonly end?: unknown;
    readonly allDay?: unknown;
  },
  window: ScheduleWindowDays,
  options: ScheduleSpanOptions,
): ScheduleWindowRows<Row> {
  const instants = scheduleWindowInstants(window, options.timeZone);
  const kept: ScheduleWindowRow<Row>[] = [];
  const refused: Partial<Record<ScheduleSpanRefusal, number>> = {};
  for (const row of rows) {
    const read = readScheduleSpan(valuesOf(row), options);
    if (!read.ok) {
      refused[read.reason] = (refused[read.reason] ?? 0) + 1;
      continue;
    }
    if (scheduleSpanOverlaps(read.span, instants))
      kept.push({ row, span: read.span });
  }
  return { rows: kept, refused };
}
