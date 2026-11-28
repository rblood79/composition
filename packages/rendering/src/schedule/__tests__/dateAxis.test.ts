/**
 * ADR-323 G1 — the date-axis geometry against a written answer table (hard-coded px, not the
 * module's own output). Wall ms = `Date.UTC` of the local date and time.
 */
import { describe, expect, it } from "vitest";

import {
  createDateAxis,
  dateAxisTicks,
  dateAxisWeekends,
  dateAxisX,
  layoutDateAxisRows,
} from "../dateAxis";

const w = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m - 1, d, h);
/** Px are floating — the answer is to 1e-6 (HC4 allows ±1 px). */
const round = (n: number) => Math.round(n * 1e6) / 1e6;
const ticks = (list: readonly { start: number; x: number; width: number }[]) =>
  list.map((t) => [new Date(t.start).toISOString().slice(0, 10), t.x, t.width]);

describe("createDateAxis · ticks", () => {
  it("day scale — month-end inside the window, weekend shading merged", () => {
    const axis = createDateAxis({
      start: w(2026, 11, 28),
      end: w(2026, 12, 3),
      scale: "day",
      unitWidth: 30,
    });
    expect(axis.width).toBe(150);
    const { major, minor } = dateAxisTicks(axis);
    expect(ticks(minor)).toEqual([
      ["2026-11-28", 0, 30],
      ["2026-11-29", 30, 30],
      ["2026-11-30", 60, 30],
      ["2026-12-01", 90, 30],
      ["2026-12-02", 120, 30],
    ]);
    expect(ticks(major)).toEqual([
      ["2026-11-01", 0, 90],
      ["2026-12-01", 90, 60],
    ]);
    expect(dateAxisWeekends(axis)).toEqual([{ x: 0, width: 60 }]);
    expect(dateAxisX(axis, w(2026, 11, 30, 18))).toBe(82.5);
  });

  it("week scale from Monday — the window widens to whole weeks, a month boundary mid-week", () => {
    const axis = createDateAxis({
      start: w(2026, 11, 25),
      end: w(2026, 12, 10),
      scale: "week",
      unitWidth: 70,
      firstDayOfWeek: 1,
    });
    expect([axis.start, axis.end, axis.width]).toEqual([
      w(2026, 11, 23),
      w(2026, 12, 14),
      210,
    ]);
    expect(dateAxisX(axis, w(2026, 11, 25, 12))).toBe(25);
    expect(ticks(dateAxisTicks(axis).major)).toEqual([
      ["2026-11-01", 0, 80],
      ["2026-12-01", 80, 130],
    ]);
    expect(
      dateAxisWeekends(axis)
        .slice(0, 2)
        .map(({ x, width }) => ({ x: round(x), width: round(width) })),
    ).toEqual([
      { x: 50, width: 20 },
      { x: 120, width: 20 },
    ]);
  });

  it("month scale — months of different lengths are equally wide", () => {
    const axis = createDateAxis({
      start: w(2026, 1, 15),
      end: w(2026, 3, 1),
      scale: "month",
      unitWidth: 62,
    });
    expect(axis.width).toBe(124);
    expect(dateAxisX(axis, w(2026, 2, 15))).toBe(93);
    expect(dateAxisX(axis, w(2026, 1, 16, 12))).toBe(31);
    expect(ticks(dateAxisTicks(axis).major)).toEqual([["2026-01-01", 0, 124]]);
    expect(dateAxisWeekends(axis)).toEqual([]);
  });

  it("quarter and year scales", () => {
    const quarter = createDateAxis({
      start: w(2026, 2, 10),
      end: w(2026, 8, 1),
      scale: "quarter",
      unitWidth: 90,
    });
    expect(ticks(dateAxisTicks(quarter).minor)).toEqual([
      ["2026-01-01", 0, 90],
      ["2026-04-01", 90, 90],
      ["2026-07-01", 180, 90],
    ]);
    const year = createDateAxis({
      start: w(2025, 6, 1),
      end: w(2027, 1, 1),
      scale: "year",
      unitWidth: 100,
    });
    expect(ticks(dateAxisTicks(year).minor)).toEqual([
      ["2025-01-01", 0, 100],
      ["2026-01-01", 100, 100],
    ]);
    expect(dateAxisTicks(year).major).toEqual([]);
    expect(dateAxisX(year, w(2026, 7, 2, 12))).toBe(150);
  });
});

describe("layoutDateAxisRows", () => {
  const axis = createDateAxis({
    start: w(2026, 11, 23),
    end: w(2026, 11, 30),
    scale: "day",
    unitWidth: 20,
  });
  const layout = layoutDateAxisRows(
    axis,
    [
      { key: "g" },
      {
        key: "t1",
        parentKey: "g",
        start: w(2026, 11, 23),
        end: w(2026, 11, 25),
        progress: 50,
      },
      {
        key: "t2",
        parentKey: "g",
        start: w(2026, 11, 26),
        end: w(2026, 11, 28),
        predecessors: ["t1"],
      },
      {
        key: "m",
        parentKey: "g",
        start: w(2026, 11, 28),
        predecessors: ["t2"],
      },
      {
        key: "late",
        start: w(2026, 11, 20),
        end: w(2026, 11, 24),
        progress: 100,
      },
      { key: "out", start: w(2026, 12, 1), end: w(2026, 12, 2) },
      {
        key: "v",
        start: w(2026, 11, 24),
        end: w(2026, 11, 26),
        predecessors: ["t2", "gone"],
      },
      { key: "bad", start: w(2026, 11, 25), end: w(2026, 11, 24) },
    ],
    { rowHeight: 40 },
  );
  const bar = (key: string) => {
    const b = layout.bars.find((item) => item?.key === key);
    return b
      ? [
          b.index,
          b.kind,
          b.x,
          b.width,
          b.progressWidth,
          b.clippedStart,
          b.clippedEnd,
        ]
      : null;
  };

  it("tasks · milestone · summary of the children · cut bars · nothing outside", () => {
    expect(bar("g")).toEqual([0, "summary", 0, 100, 0, false, false]);
    expect(bar("t1")).toEqual([1, "task", 0, 40, 20, false, false]);
    expect(bar("t2")).toEqual([2, "task", 60, 40, 0, false, false]);
    expect(bar("m")).toEqual([3, "milestone", 100, 0, 0, false, false]);
    expect(bar("late")).toEqual([4, "task", 0, 20, 20, true, false]);
    expect(layout.bars[5]).toBeNull();
    expect(bar("v")).toEqual([6, "task", 20, 40, 0, false, false]);
    expect(layout.bars[7]).toBeNull();
  });

  it("finish → start lines — straight elbow, back-around, a violated one, a missing key skipped", () => {
    expect(
      layout.dependencies.map((d) => [
        d.from,
        d.to,
        d.violated,
        d.points.map((p) => [p.x, p.y]),
      ]),
    ).toEqual([
      [
        "t1",
        "t2",
        false,
        [
          [40, 60],
          [48, 60],
          [48, 100],
          [60, 100],
        ],
      ],
      [
        "t2",
        "m",
        false,
        [
          [100, 100],
          [108, 100],
          [108, 120],
          [92, 120],
          [92, 140],
          [100, 140],
        ],
      ],
      [
        "t2",
        "v",
        true,
        [
          [100, 100],
          [108, 100],
          [108, 120],
          [12, 120],
          [12, 260],
          [20, 260],
        ],
      ],
    ]);
  });
});

describe("review fixes (ADR-323 Phase 1 판독)", () => {
  it("a moment past the window sits at the real units there — the progress end does not move with the window", () => {
    const task = {
      key: "t",
      start: w(2026, 1, 1),
      end: w(2026, 3, 1),
      progress: 50,
    };
    const both = createDateAxis({
      start: w(2026, 1, 1),
      end: w(2026, 3, 1),
      scale: "month",
      unitWidth: 310,
    });
    const january = createDateAxis({
      start: w(2026, 1, 1),
      end: w(2026, 2, 1),
      scale: "month",
      unitWidth: 310,
    });
    expect(january.width).toBe(310);
    const [inBoth] = layoutDateAxisRows(both, [task], { rowHeight: 20 }).bars;
    const [inJanuary] = layoutDateAxisRows(january, [task], {
      rowHeight: 20,
    }).bars;
    expect([inBoth!.width, inBoth!.progressWidth]).toEqual([620, 310]);
    expect([inJanuary!.width, inJanuary!.progressWidth]).toEqual([310, 310]);
    // 03-01 = two months on; 03-15 = two months and 14 / 31 of March.
    expect(dateAxisX(january, w(2026, 3, 1))).toBe(620);
    expect(round(dateAxisX(january, w(2026, 3, 15)))).toBe(760);
  });

  it("order is the moments when given — a fall-back hour's later end with an earlier wall time", () => {
    const axis = createDateAxis({
      start: w(2026, 11, 1),
      end: w(2026, 11, 2),
      scale: "day",
      unitWidth: 1440,
    });
    // 01:45 EDT (05:45Z) ~ 01:15 EST (06:15Z): 30 minutes, the wall end before the wall start.
    const fall = {
      start: w(2026, 11, 1, 1) + 45 * 60_000,
      startInstant: Date.UTC(2026, 10, 1, 5, 45),
    };
    const back = {
      end: w(2026, 11, 1, 1) + 15 * 60_000,
      endInstant: Date.UTC(2026, 10, 1, 6, 15),
    };
    const { bars, dependencies } = layoutDateAxisRows(
      axis,
      [
        { key: "bar", ...fall, ...back },
        {
          key: "p",
          start: w(2026, 11, 1),
          startInstant: Date.UTC(2026, 10, 1, 4),
          end: fall.start,
          endInstant: fall.startInstant,
        },
        {
          key: "q",
          start: back.end,
          startInstant: back.endInstant,
          end: w(2026, 11, 1, 3),
          endInstant: Date.UTC(2026, 10, 1, 8),
          predecessors: ["p"],
        },
        {
          key: "r",
          start: w(2026, 11, 1, 1) + 30 * 60_000,
          startInstant: Date.UTC(2026, 10, 1, 5, 30),
          end: w(2026, 11, 1, 3),
          endInstant: Date.UTC(2026, 10, 1, 8),
          predecessors: ["p"],
        },
      ],
      { rowHeight: 20 },
    );
    // A task drawn at no width (the repeated hour shares its place), not dropped, not a milestone.
    expect([bars[0]!.kind, bars[0]!.x, bars[0]!.width]).toEqual([
      "task",
      105,
      0,
    ]);
    expect(dependencies.map((d) => [d.to, d.violated])).toEqual([
      ["q", false],
      ["r", true],
    ]);
  });
});

describe("review fixes 2 (ADR-323 Phase 1 수리 검증)", () => {
  const nov1 = createDateAxis({
    start: w(2026, 11, 1),
    end: w(2026, 11, 2),
    scale: "day",
    unitWidth: 1440,
  });

  it("a real-length task at the window's start with no wall width stays — the doubled midnight (America/Havana 11-01)", () => {
    // 00:00 −04:00 (04:00Z) ~ 00:00 −05:00 (05:00Z): one real hour, both wall ends 00:00.
    const { bars } = layoutDateAxisRows(
      nov1,
      [
        {
          key: "t",
          start: w(2026, 11, 1),
          startInstant: Date.UTC(2026, 10, 1, 4),
          end: w(2026, 11, 1),
          endInstant: Date.UTC(2026, 10, 1, 5),
        },
        // A task ending exactly at the window's start is still outside (end exclusive).
        { key: "before", start: w(2026, 10, 31, 20), end: w(2026, 11, 1) },
      ],
      { rowHeight: 20 },
    );
    expect(bars[0] && [bars[0].kind, bars[0].x, bars[0].width]).toEqual([
      "task",
      0,
      0,
    ]);
    expect(bars[1]).toBeNull();
  });

  it("a summary bar does not depend on its children's order — fall-back day (America/New_York 11-01)", () => {
    const at = (h: number, mi: number) => w(2026, 11, 1, h) + mi * 60_000;
    const z = (h: number, mi: number) => Date.UTC(2026, 10, 1, h, mi);
    const A = {
      key: "A",
      parentKey: "P",
      start: at(1, 10),
      startInstant: z(5, 10),
      end: at(1, 20),
      endInstant: z(5, 20),
    };
    const B = {
      key: "B",
      parentKey: "P",
      start: at(1, 50),
      startInstant: z(5, 50),
      end: at(1, 55),
      endInstant: z(5, 55),
    };
    const C = {
      key: "C",
      parentKey: "P",
      start: at(1, 5),
      startInstant: z(6, 5),
      end: at(1, 15),
      endInstant: z(6, 15),
    };
    const summary = (children: readonly object[]) => {
      const bar = layoutDateAxisRows(
        nov1,
        [{ key: "P" }, ...(children as never[])],
        {
          rowHeight: 20,
        },
      ).bars[0]!;
      return [bar.kind, bar.x, bar.width];
    };
    // Earliest start A (01:10 EDT, x 70) · latest end C (01:15 EST, x 75).
    expect(summary([A, B, C])).toEqual(["summary", 70, 5]);
    expect(summary([B, C, A])).toEqual(["summary", 70, 5]);
    expect(summary([C, A, B])).toEqual(["summary", 70, 5]);
  });
});
