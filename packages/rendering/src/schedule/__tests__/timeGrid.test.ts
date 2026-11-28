/**
 * ADR-323 G1 — the time-grid geometry against a written answer table (hard-coded minutes · indices,
 * not the module's own output). Wall ms = `Date.UTC` of the local date and time.
 */
import { describe, expect, it } from "vitest";

import {
  layoutScheduleDayBands,
  layoutScheduleTimeGrid,
  scheduleGridBanded,
  type ScheduleGridEvent,
} from "../timeGrid";

const DAY = 86_400_000;
const w = (m: number, d: number, h = 0, mi = 0) =>
  Date.UTC(2026, m - 1, d, h, mi);
const ev = (
  key: string,
  start: number,
  end: number,
  allDay?: boolean,
): ScheduleGridEvent => ({ key, start, end, ...(allDay ? { allDay } : {}) });
/** Mon 2026-11-23 … Sun 11-29. */
const WEEK = Array.from({ length: 7 }, (_, i) => w(11, 23) + i * DAY);
const pick = (items: readonly { key: string }[]) =>
  items.map((item) => {
    const { key, dayIndex, top, height, column, columns } =
      item as never as Record<string, unknown>;
    return [key, dayIndex, top, height, column, columns];
  });

describe("layoutScheduleTimeGrid", () => {
  it("overlap columns · minimum height · midnight cut · banded events", () => {
    const layout = layoutScheduleTimeGrid(
      [
        ev("b", w(11, 23, 9, 30), w(11, 23, 11)),
        ev("a", w(11, 23, 9), w(11, 23, 10)),
        ev("c", w(11, 23, 10), w(11, 23, 10, 30)),
        ev("d", w(11, 23, 12), w(11, 23, 12, 5)),
        ev("e", w(11, 24, 23), w(11, 25, 1)),
        ev("f", w(11, 26), w(11, 27), true),
        ev("g", w(11, 27, 8), w(11, 28, 8)),
      ],
      { days: WEEK },
    );
    expect(pick(layout.items)).toEqual([
      ["a", 0, 540, 60, 0, 2],
      ["b", 0, 570, 90, 1, 2],
      ["c", 0, 600, 30, 0, 2],
      ["d", 0, 720, 15, 0, 1],
      ["e", 1, 1380, 60, 0, 1],
      ["e", 2, 0, 60, 0, 1],
    ]);
    const e = layout.items.filter((item) => item.key === "e");
    expect(
      e.map((item) => [item.continuesBefore, item.continuesAfter]),
    ).toEqual([
      [false, true],
      [true, false],
    ]);
    expect(layout.banded).toEqual(["f", "g"]);
    expect(layout.hidden).toEqual([]);
  });

  it("20 events at the same time take 20 columns in key order", () => {
    const keys = Array.from(
      { length: 20 },
      (_, i) => `s${String(i).padStart(2, "0")}`,
    );
    const layout = layoutScheduleTimeGrid(
      keys
        .slice()
        .reverse()
        .map((key) => ev(key, w(11, 25, 10), w(11, 25, 11))),
      { days: WEEK },
    );
    expect(
      layout.items.map((item) => [item.key, item.column, item.columns]),
    ).toEqual(keys.map((key, i) => [key, i, 20]));
    expect(
      layout.items.every((item) => item.dayIndex === 2 && item.top === 600),
    ).toBe(true);
  });

  it("shown hours 08:00 ~ 18:00 — cut, hidden, minimum height kept inside", () => {
    const layout = layoutScheduleTimeGrid(
      [
        ev("p", w(11, 23, 6), w(11, 23, 7)),
        ev("q", w(11, 23, 7, 30), w(11, 23, 9)),
        ev("r", w(11, 23, 17, 30), w(11, 23, 19)),
        ev("s", w(11, 23, 18), w(11, 23, 19)),
        ev("t", w(11, 23, 17, 55), w(11, 23, 18)),
        ev("u", w(11, 23, 8), w(11, 23, 8)),
      ],
      { days: [w(11, 23)], dayStartMinutes: 480, dayEndMinutes: 1080 },
    );
    expect(pick(layout.items)).toEqual([
      ["q", 0, 0, 60, 0, 2],
      ["u", 0, 0, 15, 1, 2],
      ["r", 0, 570, 30, 0, 2],
      ["t", 0, 585, 15, 1, 2],
    ]);
    const q = layout.items.find((item) => item.key === "q")!;
    const r = layout.items.find((item) => item.key === "r")!;
    expect([q.continuesBefore, q.continuesAfter]).toEqual([true, false]);
    expect([r.continuesBefore, r.continuesAfter]).toEqual([false, true]);
    expect(layout.hidden).toEqual([
      { key: "p", dayIndex: 0, side: "before" },
      { key: "s", dayIndex: 0, side: "after" },
    ]);
  });

  it("days may skip (no weekend) — an event on a left-out day draws nothing", () => {
    const weekdays = WEEK.slice(0, 5);
    const layout = layoutScheduleTimeGrid(
      [
        ev("sat", w(11, 28, 9), w(11, 28, 10)),
        ev("fri", w(11, 27, 9), w(11, 27, 10)),
      ],
      { days: weekdays },
    );
    expect(pick(layout.items)).toEqual([["fri", 4, 540, 60, 0, 1]]);
  });

  it("the banded rule — all-day, or 24 hours and longer", () => {
    expect(scheduleGridBanded(ev("x", w(11, 23, 8), w(11, 24, 7, 59)))).toBe(
      false,
    );
    expect(scheduleGridBanded(ev("x", w(11, 23, 8), w(11, 24, 8)))).toBe(true);
    expect(scheduleGridBanded(ev("x", w(11, 23), w(11, 23), true))).toBe(true);
  });
});

describe("layoutScheduleDayBands", () => {
  /** Sun 2026-11-22 … Sat 12-05 — two rows of a month grid. */
  const ROWS = Array.from({ length: 14 }, (_, i) => w(11, 22) + i * DAY);
  const EVENTS = [
    ev("A", w(11, 21), w(12, 3), true),
    ev("B", w(11, 24), w(11, 26), true),
    ev("C", w(11, 25, 10), w(11, 25, 11)),
    ev("D", w(11, 25), w(11, 27), true),
  ];
  const bandRows = (bands: readonly Record<string, unknown>[]) =>
    bands.map((b) => [
      b.key,
      b.row,
      b.line,
      b.startIndex,
      b.span,
      b.continuesBefore,
      b.continuesAfter,
    ]);

  it("lines across a row · a band crossing rows · month-end", () => {
    const layout = layoutScheduleDayBands(EVENTS, { days: ROWS, rowLength: 7 });
    expect(bandRows(layout.bands as never)).toEqual([
      ["A", 0, 0, 0, 7, true, true],
      ["B", 0, 1, 2, 2, false, false],
      ["D", 0, 2, 3, 2, false, false],
      ["C", 0, 3, 3, 1, false, false],
      ["A", 1, 0, 7, 4, true, false],
    ]);
    expect(layout.lines).toEqual([4, 1]);
    expect(layout.more.every((n) => n === 0)).toBe(true);
  });

  it("maxLines 3 — a full day shows 2 lines and 「+2」, a band resumes after it", () => {
    const layout = layoutScheduleDayBands(EVENTS, {
      days: ROWS,
      rowLength: 7,
      maxLines: 3,
    });
    expect(bandRows(layout.bands as never)).toEqual([
      ["A", 0, 0, 0, 7, true, true],
      ["B", 0, 1, 2, 2, false, false],
      ["D", 0, 2, 4, 1, true, false],
      ["A", 1, 0, 7, 4, true, false],
    ]);
    expect(layout.more).toEqual([0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(layout.lines).toEqual([3, 1]);
  });

  it("a zero-length event covers its day · a week strip is one row", () => {
    const layout = layoutScheduleDayBands(
      [
        ev("z", w(11, 23, 12), w(11, 23, 12)),
        ev("y", w(11, 29), w(11, 30), true),
      ],
      { days: WEEK, rowLength: WEEK.length },
    );
    expect(bandRows(layout.bands as never)).toEqual([
      ["z", 0, 0, 0, 1, false, false],
      ["y", 0, 0, 6, 1, false, false],
    ]);
  });
});
