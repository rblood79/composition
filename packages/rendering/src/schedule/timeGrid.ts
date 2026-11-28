/**
 * ADR-323 Phase 1 — the time-grid geometry (breakdown §5.2): EventCalendar's week · day columns, its
 * all-day strip and its month cells. Canvas and the DOM read the same output (HC4) — a pure function
 * of numbers, no zone, no DOM.
 *
 * Times are **wall clock** ms (the zone's local date and time written as UTC — `scheduleWallOf` in
 * `@composition/shared` collections/scheduleSpan): a local midnight is a multiple of a day. Ends are
 * exclusive. Output positions are minutes (columns) and indices (bands) — the consumer scales them to
 * pixels.
 *
 * Lazy: first-screen modules do not import this by value (`adr323ScheduleImports.static.test.ts`).
 */

export const SCHEDULE_GRID_DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const DAY_MINUTES = 1_440;

export interface ScheduleGridEvent {
  readonly key: string;
  /** Wall ms. */
  readonly start: number;
  /** Wall ms, exclusive. Equal to `start` = zero length. */
  readonly end: number;
  readonly allDay?: boolean;
}

/** Whether an event goes to the all-day strip, not the columns: all-day, or 24 hours or longer. */
export function scheduleGridBanded(event: ScheduleGridEvent): boolean {
  return (
    event.allDay === true || event.end - event.start >= SCHEDULE_GRID_DAY_MS
  );
}

/** Whether `event` covers the wall day starting at `day`. */
function covers(event: ScheduleGridEvent, day: number): boolean {
  if (event.end <= event.start)
    return event.start >= day && event.start < day + SCHEDULE_GRID_DAY_MS;
  return event.start < day + SCHEDULE_GRID_DAY_MS && event.end > day;
}

// ---------------------------------------------------------------------------------------------
// Columns (week · day views)

export interface ScheduleTimeGridOptions {
  /** The columns' wall day starts (multiples of a day), ascending — weekends may be left out. */
  readonly days: readonly number[];
  /** The first shown minute of a day (0 = 00:00). */
  readonly dayStartMinutes?: number;
  /** The end of the shown day, exclusive (1,440 = 24:00). */
  readonly dayEndMinutes?: number;
  /** The least height an event takes — overlap is decided on what is drawn. Default 15. */
  readonly minEventMinutes?: number;
}

export interface ScheduleTimeGridItem {
  readonly key: string;
  readonly dayIndex: number;
  /** Minutes from the shown day's start. */
  readonly top: number;
  readonly height: number;
  /** The overlap column (0-based) and the column count of its overlapping group — width = 1 / columns. */
  readonly column: number;
  readonly columns: number;
  /** The event goes on before this piece (an earlier day, or above the shown hours). */
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
}

export interface ScheduleTimeGridLayout {
  /** In DOM order — day, then start, then column (Tab reaches them in time order). */
  readonly items: readonly ScheduleTimeGridItem[];
  /** Events for the all-day strip (`scheduleGridBanded`), in input order. */
  readonly banded: readonly string[];
  /** Pieces wholly outside the shown hours. */
  readonly hidden: readonly {
    readonly key: string;
    readonly dayIndex: number;
    readonly side: "before" | "after";
  }[];
}

interface Piece {
  key: string;
  dayIndex: number;
  top: number;
  height: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  column: number;
  columns: number;
}

/**
 * Overlap columns within one day (Phase 0 prototype `layoutDay`, fixed by the answer table): walk in
 * start order (longer first on a tie); a group is a run of pieces that overlap one another by chain;
 * a piece takes the group's first free column; the group's column count is every member's `columns`.
 */
function assignColumns(pieces: Piece[]): void {
  pieces.sort(
    (a, b) =>
      a.top - b.top ||
      b.top + b.height - (a.top + a.height) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
  let group: Piece[] = [];
  let ends: number[] = [];
  let groupEnd = -Infinity;
  const flush = () => {
    for (const piece of group) piece.columns = ends.length;
    group = [];
    ends = [];
  };
  for (const piece of pieces) {
    if (piece.top >= groupEnd) {
      flush();
      groupEnd = -Infinity;
    }
    const bottom = piece.top + piece.height;
    let column = ends.findIndex((end) => end <= piece.top);
    if (column < 0) {
      column = ends.length;
      ends.push(bottom);
    } else ends[column] = bottom;
    piece.column = column;
    group.push(piece);
    groupEnd = Math.max(groupEnd, bottom);
  }
  flush();
}

/** Week · day columns: timed events cut at midnights, placed by their wall minutes. */
export function layoutScheduleTimeGrid(
  events: readonly ScheduleGridEvent[],
  options: ScheduleTimeGridOptions,
): ScheduleTimeGridLayout {
  const dayStart = options.dayStartMinutes ?? 0;
  const dayEnd = options.dayEndMinutes ?? DAY_MINUTES;
  const shown = Math.max(0, dayEnd - dayStart);
  const minHeight = Math.min(options.minEventMinutes ?? 15, shown);
  const banded: string[] = [];
  const hidden: { key: string; dayIndex: number; side: "before" | "after" }[] =
    [];
  const byDay: Piece[][] = options.days.map(() => []);

  for (const event of events) {
    if (scheduleGridBanded(event)) {
      banded.push(event.key);
      continue;
    }
    options.days.forEach((day, dayIndex) => {
      if (!covers(event, day)) return;
      const from = Math.max(event.start, day);
      const to = Math.max(
        from,
        Math.min(event.end, day + SCHEDULE_GRID_DAY_MS),
      );
      const top = (from - day) / MINUTE_MS - dayStart;
      const bottom = (to - day) / MINUTE_MS - dayStart;
      if (bottom <= 0 && !(top === 0 && bottom === 0)) {
        hidden.push({ key: event.key, dayIndex, side: "before" });
        return;
      }
      if (top >= shown) {
        hidden.push({ key: event.key, dayIndex, side: "after" });
        return;
      }
      const clampedTop = Math.max(0, top);
      const clampedBottom = Math.min(shown, bottom);
      const height = Math.max(clampedBottom - clampedTop, minHeight);
      byDay[dayIndex]!.push({
        key: event.key,
        dayIndex,
        top: Math.min(clampedTop, shown - height),
        height,
        continuesBefore: event.start < day || top < 0,
        continuesAfter:
          event.end > day + SCHEDULE_GRID_DAY_MS || bottom > shown,
        column: 0,
        columns: 1,
      });
    });
  }

  const items: ScheduleTimeGridItem[] = [];
  for (const pieces of byDay) {
    assignColumns(pieces);
    pieces.sort((a, b) => a.top - b.top || a.column - b.column);
    items.push(...pieces);
  }
  return { items, banded, hidden };
}

// ---------------------------------------------------------------------------------------------
// Bands (the all-day strip · month cells)

export interface ScheduleDayBandOptions {
  /** The shown wall day starts, ascending, row after row. */
  readonly days: readonly number[];
  /** Days per row — 7 for a month, `days.length` for a week's strip. */
  readonly rowLength: number;
  /**
   * Lines a day shows. A day with more events shows `maxLines − 1` and a 「+N」 (`more`). Default:
   * no limit.
   */
  readonly maxLines?: number;
}

export interface ScheduleDayBand {
  readonly key: string;
  readonly row: number;
  readonly line: number;
  /** Index into `days` of the piece's first day. */
  readonly startIndex: number;
  /** Days the piece covers. */
  readonly span: number;
  /** The event starts before the piece (an earlier row, a hidden line, or before the shown days). */
  readonly continuesBefore: boolean;
  readonly continuesAfter: boolean;
}

export interface ScheduleDayBandLayout {
  /** Row by row, then line, then start. */
  readonly bands: readonly ScheduleDayBand[];
  /** Per day (index into `days`): the events it does not show (the 「+N」). */
  readonly more: readonly number[];
  /** Per row: the lines the row uses (with no limit, its height in lines). */
  readonly lines: readonly number[];
}

/**
 * Line assignment for multi-day bands: within a row, the events in start order (longer first, then
 * the earlier start, then key) take the first line free across all their days — a band keeps one
 * line across its row.
 */
export function layoutScheduleDayBands(
  events: readonly ScheduleGridEvent[],
  options: ScheduleDayBandOptions,
): ScheduleDayBandLayout {
  const { days } = options;
  const rowLength = Math.max(1, Math.floor(options.rowLength));
  const maxLines =
    options.maxLines === undefined ? Infinity : Math.max(1, options.maxLines);
  const bands: ScheduleDayBand[] = [];
  const more = days.map(() => 0);
  const lines: number[] = [];

  for (
    let rowStart = 0, row = 0;
    rowStart < days.length;
    rowStart += rowLength, row++
  ) {
    const rowEnd = Math.min(days.length, rowStart + rowLength);
    const placed: {
      event: ScheduleGridEvent;
      first: number;
      last: number;
      line: number;
    }[] = [];
    for (const event of events) {
      let first = -1;
      let last = -1;
      for (let i = rowStart; i < rowEnd; i++)
        if (covers(event, days[i]!)) {
          if (first < 0) first = i;
          last = i;
        }
      if (first >= 0) placed.push({ event, first, last, line: 0 });
    }
    placed.sort(
      (a, b) =>
        a.first - b.first ||
        b.last - b.first - (a.last - a.first) ||
        a.event.start - b.event.start ||
        (a.event.key < b.event.key ? -1 : a.event.key > b.event.key ? 1 : 0),
    );
    const taken: boolean[][] = [];
    for (const item of placed) {
      let line = 0;
      for (; ; line++) {
        const used = (taken[line] ??= []);
        let free = true;
        for (let i = item.first; i <= item.last; i++)
          if (used[i - rowStart]) {
            free = false;
            break;
          }
        if (free) break;
      }
      for (let i = item.first; i <= item.last; i++)
        taken[line]![i - rowStart] = true;
      item.line = line;
    }

    const count = new Array<number>(rowEnd - rowStart).fill(0);
    for (const item of placed)
      for (let i = item.first; i <= item.last; i++) count[i - rowStart]!++;
    const limit = count.map((n) => (n > maxLines ? maxLines - 1 : maxLines));

    const rowBands: ScheduleDayBand[] = [];
    let used = 0;
    for (const item of placed) {
      let pieceStart = -1;
      const close = (end: number) => {
        rowBands.push({
          key: item.event.key,
          row,
          line: item.line,
          startIndex: pieceStart,
          span: end - pieceStart + 1,
          continuesBefore: item.event.start < days[pieceStart]!,
          continuesAfter: item.event.end > days[end]! + SCHEDULE_GRID_DAY_MS,
        });
        pieceStart = -1;
      };
      for (let i = item.first; i <= item.last; i++) {
        if (item.line < limit[i - rowStart]!) {
          if (pieceStart < 0) pieceStart = i;
          used = Math.max(used, item.line + 1);
        } else {
          more[i]!++;
          if (pieceStart >= 0) close(i - 1);
        }
      }
      if (pieceStart >= 0) close(item.last);
    }
    rowBands.sort((a, b) => a.line - b.line || a.startIndex - b.startIndex);
    bands.push(...rowBands);
    lines.push(used);
  }
  return { bands, more, lines };
}
