/**
 * ADR-323 Phase 1 — the date-axis geometry (breakdown §5.2): Gantt's time column — ticks (two tiers),
 * bars, milestones, summary bars, dependency lines. Canvas and the DOM read the same output (HC4) — a
 * pure function of numbers, no zone, no DOM.
 *
 * Times are **wall clock** ms (see `timeGrid.ts`). Every unit of the scale (a day, a week, a month, a
 * quarter, a year) is `unitWidth` px wide; a moment inside a unit sits at its share of the unit's
 * length — a 31-day month and a 28-day one are equally wide, as in a Gantt's header columns.
 *
 * Lazy: first-screen modules do not import this by value (`adr323ScheduleImports.static.test.ts`).
 */

const DAY_MS = 86_400_000;

export type DateAxisScale = "day" | "week" | "month" | "quarter" | "year";

export const DATE_AXIS_SCALES: readonly DateAxisScale[] = [
  "day",
  "week",
  "month",
  "quarter",
  "year",
];

/** The header's upper tier for each scale (`year` has none). */
const MAJOR_OF: Readonly<Record<DateAxisScale, DateAxisScale | undefined>> = {
  day: "month",
  week: "month",
  month: "year",
  quarter: "year",
  year: undefined,
};

function utc(year: number, month: number, day = 1): number {
  return new Date(0).setUTCFullYear(year, month, day);
}

/** The unit's start at or before `t`. */
function floorUnit(
  t: number,
  unit: DateAxisScale,
  firstDayOfWeek: number,
): number {
  const date = new Date(t);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  switch (unit) {
    case "day":
      return Math.floor(t / DAY_MS) * DAY_MS;
    case "week": {
      const day = Math.floor(t / DAY_MS) * DAY_MS;
      const back = (new Date(day).getUTCDay() - firstDayOfWeek + 7) % 7;
      return day - back * DAY_MS;
    }
    case "month":
      return utc(year, month);
    case "quarter":
      return utc(year, month - (month % 3));
    case "year":
      return utc(year, 0);
  }
}

/** The next unit's start after a unit start. */
function nextUnit(start: number, unit: DateAxisScale): number {
  const date = new Date(start);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  switch (unit) {
    case "day":
      return start + DAY_MS;
    case "week":
      return start + 7 * DAY_MS;
    case "month":
      return utc(year, month + 1);
    case "quarter":
      return utc(year, month + 3);
    case "year":
      return utc(year + 1, 0);
  }
}

function boundaries(
  start: number,
  end: number,
  unit: DateAxisScale,
  firstDayOfWeek: number,
): number[] {
  const out = [floorUnit(start, unit, firstDayOfWeek)];
  while (out[out.length - 1]! < end)
    out.push(nextUnit(out[out.length - 1]!, unit));
  if (out.length === 1) out.push(nextUnit(out[0]!, unit));
  return out;
}

export interface DateAxisOptions {
  /** The window in wall ms — widened to whole units. */
  readonly start: number;
  readonly end: number;
  readonly scale: DateAxisScale;
  /** Px per unit (the zoom). */
  readonly unitWidth: number;
  /** 0 = Sunday … 6 = Saturday — where a week starts (the locale's, `firstDayOfWeek`). */
  readonly firstDayOfWeek?: number;
}

export interface DateAxis {
  readonly scale: DateAxisScale;
  readonly unitWidth: number;
  readonly firstDayOfWeek: number;
  /** The unit starts, the last one the end (exclusive) — `units.length − 1` units. */
  readonly units: readonly number[];
  readonly start: number;
  readonly end: number;
  readonly width: number;
}

export function createDateAxis(options: DateAxisOptions): DateAxis {
  const firstDayOfWeek =
    ((Math.floor(options.firstDayOfWeek ?? 0) % 7) + 7) % 7;
  const units = boundaries(
    options.start,
    options.end,
    options.scale,
    firstDayOfWeek,
  );
  const unitWidth = Math.max(0, options.unitWidth);
  return {
    scale: options.scale,
    unitWidth,
    firstDayOfWeek,
    units,
    start: units[0]!,
    end: units[units.length - 1]!,
    width: (units.length - 1) * unitWidth,
  };
}

/** A moment's x (px). Outside the window it goes on at the first · last unit's rate. */
export function dateAxisX(axis: DateAxis, t: number): number {
  const { units, unitWidth } = axis;
  const last = units.length - 1;
  if (t <= units[0]!)
    return ((t - units[0]!) / (units[1]! - units[0]!)) * unitWidth;
  if (t >= units[last]!)
    return (
      axis.width +
      ((t - units[last]!) / (units[last]! - units[last - 1]!)) * unitWidth
    );
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (units[mid]! <= t) lo = mid;
    else hi = mid;
  }
  return (lo + (t - units[lo]!) / (units[lo + 1]! - units[lo]!)) * unitWidth;
}

export interface DateAxisTick {
  /** The unit's start (wall ms) — the label's date. */
  readonly start: number;
  readonly x: number;
  readonly width: number;
}

export interface DateAxisTicks {
  /** The upper tier, cut to the window. */
  readonly major: readonly DateAxisTick[];
  readonly minor: readonly DateAxisTick[];
}

export function dateAxisTicks(axis: DateAxis): DateAxisTicks {
  const minor: DateAxisTick[] = [];
  for (let i = 0; i < axis.units.length - 1; i++)
    minor.push({
      start: axis.units[i]!,
      x: i * axis.unitWidth,
      width: axis.unitWidth,
    });
  const majorUnit = MAJOR_OF[axis.scale];
  const major: DateAxisTick[] = [];
  if (majorUnit) {
    for (const start of boundaries(
      axis.start,
      axis.end,
      majorUnit,
      axis.firstDayOfWeek,
    )) {
      const from = Math.max(start, axis.start);
      const to = Math.min(nextUnit(start, majorUnit), axis.end);
      if (to <= from) continue;
      const x = dateAxisX(axis, from);
      major.push({ start, x, width: dateAxisX(axis, to) - x });
    }
  }
  return { major, minor };
}

/** Weekend shading — the `weekendDays` (0 = Sunday … 6, default Saturday · Sunday) of a day · week scale. */
export function dateAxisWeekends(
  axis: DateAxis,
  weekendDays: readonly number[] = [0, 6],
): readonly { readonly x: number; readonly width: number }[] {
  if (axis.scale !== "day" && axis.scale !== "week") return [];
  const out: { x: number; width: number }[] = [];
  for (let day = axis.start; day < axis.end; day += DAY_MS) {
    if (!weekendDays.includes(new Date(day).getUTCDay())) continue;
    const x = dateAxisX(axis, day);
    const right = dateAxisX(axis, day + DAY_MS);
    const prev = out[out.length - 1];
    if (prev && Math.abs(prev.x + prev.width - x) < 1e-9)
      prev.width = right - prev.x;
    else out.push({ x, width: right - x });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rows

export interface DateAxisRow {
  readonly key: string;
  /** Wall ms. */
  readonly start?: number;
  /** Wall ms, exclusive. None or equal to `start` = a milestone. */
  readonly end?: number;
  /** 0 ~ 100. */
  readonly progress?: number;
  readonly parentKey?: string | null;
  /** Predecessor keys — finish → start (사용자 결정 6 권고). */
  readonly predecessors?: readonly string[];
}

export interface DateAxisBar {
  readonly key: string;
  /** The row's index in the input (its line). */
  readonly index: number;
  readonly kind: "task" | "milestone" | "summary";
  /** Cut to `[0, width]`. A milestone's `x` is its moment and `width` 0. */
  readonly x: number;
  readonly width: number;
  /** The filled part from `x` (cut like the bar). */
  readonly progressWidth: number;
  /** The bar goes on past the window's start · end. */
  readonly clippedStart: boolean;
  readonly clippedEnd: boolean;
}

export interface DateAxisDependency {
  readonly from: string;
  readonly to: string;
  /** Px, the row's middle for y — not cut to the window (the consumer clips). */
  readonly points: readonly { readonly x: number; readonly y: number }[];
  /** The successor starts before its predecessor ends. */
  readonly violated: boolean;
}

export interface DateAxisRowsOptions {
  readonly rowHeight: number;
  /** The elbow's step out of a bar's end · into a bar's start (px). Default 8. */
  readonly gap?: number;
}

export interface DateAxisRowsLayout {
  /** Per input row; `null` = nothing in the window (no start, an end before the start, outside). */
  readonly bars: readonly (DateAxisBar | null)[];
  readonly dependencies: readonly DateAxisDependency[];
}

interface Span {
  start: number;
  end: number;
}

export function layoutDateAxisRows(
  axis: DateAxis,
  rows: readonly DateAxisRow[],
  options: DateAxisRowsOptions,
): DateAxisRowsLayout {
  const gap = options.gap ?? 8;
  const index = new Map<string, number>();
  rows.forEach((row, i) => index.set(row.key, i));
  const childrenOf = new Map<string, string[]>();
  for (const row of rows)
    if (row.parentKey != null && index.has(row.parentKey)) {
      const list = childrenOf.get(row.parentKey) ?? [];
      list.push(row.key);
      childrenOf.set(row.parentKey, list);
    }

  const ownSpan = (row: DateAxisRow): Span | undefined => {
    if (row.start === undefined || !Number.isFinite(row.start))
      return undefined;
    const end = row.end ?? row.start;
    if (!Number.isFinite(end) || end < row.start) return undefined;
    return { start: row.start, end };
  };
  // A summary row spans its descendants (an own span counts only when none has one).
  const spans = new Map<string, Span | undefined>();
  const spanOf = (key: string, seen: Set<string>): Span | undefined => {
    if (spans.has(key)) return spans.get(key);
    const row = rows[index.get(key)!]!;
    let span: Span | undefined;
    const children = childrenOf.get(key);
    if (children && !seen.has(key)) {
      seen.add(key);
      for (const child of children) {
        const s = spanOf(child, seen);
        if (!s) continue;
        span = span
          ? {
              start: Math.min(span.start, s.start),
              end: Math.max(span.end, s.end),
            }
          : { ...s };
      }
    }
    span ??= ownSpan(row);
    spans.set(key, span);
    return span;
  };

  const bars = rows.map((row, i): DateAxisBar | null => {
    const span = spanOf(row.key, new Set());
    if (!span) return null;
    const summary = childrenOf.has(row.key);
    const x1 = dateAxisX(axis, span.start);
    if (!summary && span.end === span.start) {
      if (x1 < 0 || x1 >= axis.width) return null;
      return {
        key: row.key,
        index: i,
        kind: "milestone",
        x: x1,
        width: 0,
        progressWidth: 0,
        clippedStart: false,
        clippedEnd: false,
      };
    }
    const x2 = dateAxisX(axis, span.end);
    if (x2 <= 0 || x1 >= axis.width) return null;
    const left = Math.max(0, x1);
    const right = Math.min(axis.width, x2);
    const progress = summary
      ? 0
      : Math.min(100, Math.max(0, row.progress ?? 0)) / 100;
    const filled = Math.min(axis.width, x1 + (x2 - x1) * progress);
    return {
      key: row.key,
      index: i,
      kind: summary ? "summary" : "task",
      x: left,
      width: right - left,
      progressWidth: Math.max(0, filled - left),
      clippedStart: x1 < 0,
      clippedEnd: x2 > axis.width,
    };
  });

  const half = options.rowHeight / 2;
  const dependencies: DateAxisDependency[] = [];
  rows.forEach((row, toIndex) => {
    const to = spans.get(row.key);
    if (!to || !row.predecessors) return;
    for (const fromKey of row.predecessors) {
      const fromIndex = index.get(fromKey);
      if (fromIndex === undefined || fromIndex === toIndex) continue;
      const from = spans.get(fromKey);
      if (!from) continue;
      const fx = dateAxisX(axis, from.end);
      const tx = dateAxisX(axis, to.start);
      const fy = fromIndex * options.rowHeight + half;
      const ty = toIndex * options.rowHeight + half;
      const points =
        tx - gap >= fx + gap
          ? [
              { x: fx, y: fy },
              { x: fx + gap, y: fy },
              { x: fx + gap, y: ty },
              { x: tx, y: ty },
            ]
          : (() => {
              // Back around: down (or up) to the row boundary, left past the successor's start.
              const between = fy + Math.sign(ty - fy) * half;
              return [
                { x: fx, y: fy },
                { x: fx + gap, y: fy },
                { x: fx + gap, y: between },
                { x: tx - gap, y: between },
                { x: tx - gap, y: ty },
                { x: tx, y: ty },
              ];
            })();
      dependencies.push({
        from: fromKey,
        to: row.key,
        points,
        violated: to.start < from.end,
      });
    }
  });
  return { bars, dependencies };
}
