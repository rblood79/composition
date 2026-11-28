/**
 * ADR-323 G1 — reading date-axis values in a time zone (사용자 결정 7) against written instants
 * (`Date.parse` of hand-converted UTC texts — not the reader's own output), and the reader → geometry
 * seam on daylight-saving days.
 */
import { layoutScheduleTimeGrid } from "@composition/rendering/schedule/timeGrid";
import { describe, expect, it } from "vitest";

import {
  readScheduleInstant,
  readScheduleSpan,
  resolveScheduleTimeZone,
  scheduleSpanOverlaps,
  scheduleWallDayStart,
  type ScheduleSpanOptions,
} from "../scheduleSpan";

const at = Date.parse;
const wall = (m: number, d: number, h = 0, mi = 0, y = 2026) =>
  Date.UTC(y, m - 1, d, h, mi);
const opts = (timeZone: string, extra: Partial<ScheduleSpanOptions> = {}) => ({
  timeZone,
  defaultDurationMinutes: 30,
  ...extra,
});
const span = (
  values: { start: unknown; end?: unknown; allDay?: unknown },
  options: ScheduleSpanOptions,
) => {
  const result = readScheduleSpan(values, options);
  if (!result.ok) throw new Error(result.reason);
  return result.span;
};

describe("resolveScheduleTimeZone (사용자 결정 7 — 둘 다)", () => {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  it("a known IANA zone is the component's", () => {
    expect(resolveScheduleTimeZone("Asia/Seoul")).toBe("Asia/Seoul");
    expect(resolveScheduleTimeZone(" Pacific/Kiritimati ")).toBe(
      "Pacific/Kiritimati",
    );
    expect(resolveScheduleTimeZone("Etc/GMT+12")).toBe("Etc/GMT+12");
  });
  it("empty · unknown · not text = the browser's zone", () => {
    expect(resolveScheduleTimeZone(undefined)).toBe(browser);
    expect(resolveScheduleTimeZone("")).toBe(browser);
    expect(resolveScheduleTimeZone("Mars/Olympus")).toBe(browser);
    expect(resolveScheduleTimeZone(9)).toBe(browser);
  });
});

describe("readScheduleSpan", () => {
  it("a day only value is all-day — the zone's midnight to the next (Seoul +09:00)", () => {
    expect(span({ start: "2026-11-23" }, opts("Asia/Seoul"))).toEqual({
      start: at("2026-11-22T15:00:00Z"),
      end: at("2026-11-23T15:00:00Z"),
      wallStart: wall(11, 23),
      wallEnd: wall(11, 24),
      allDay: true,
    });
  });

  it("day only start · end — the end day is exclusive; the same day is one day, or zero for a milestone", () => {
    const long = span({ start: "2026-11-21", end: "2026-12-02" }, opts("UTC"));
    expect([long.wallStart, long.wallEnd]).toEqual([wall(11, 21), wall(12, 2)]);
    const same = { start: "2026-11-25", end: "2026-11-25" };
    expect(span(same, opts("UTC")).wallEnd).toBe(wall(11, 26));
    const milestone = span(same, opts("UTC", { keepZeroLength: true }));
    expect([milestone.start, milestone.end]).toEqual([
      at("2026-11-25T00:00:00Z"),
      at("2026-11-25T00:00:00Z"),
    ]);
  });

  it("a time without offset is read in the zone; no end = start + the default length", () => {
    expect(span({ start: "2026-11-23T09:00:00" }, opts("Asia/Seoul"))).toEqual({
      start: at("2026-11-23T00:00:00Z"),
      end: at("2026-11-23T00:30:00Z"),
      wallStart: wall(11, 23, 9),
      wallEnd: wall(11, 23, 9, 30),
      allDay: false,
    });
  });

  it("the date line (G3's two boundaries) — the stored offset's day is two days from the shown day", () => {
    // Shown Kiritimati (+14:00) 11-23 00:05 = stored 11-21 22:05 −12:00.
    const kiritimati = span(
      { start: "2026-11-21T22:05:00-12:00", end: "2026-11-21T22:15:00-12:00" },
      opts("Pacific/Kiritimati"),
    );
    expect([
      kiritimati.start,
      kiritimati.wallStart,
      kiritimati.wallEnd,
    ]).toEqual([
      at("2026-11-22T10:05:00Z"),
      wall(11, 23, 0, 5),
      wall(11, 23, 0, 15),
    ]);
    // Shown Etc/GMT+12 (−12:00) 11-29 23:45 = stored 12-01 01:45 +14:00.
    const gmt12 = span(
      { start: "2026-12-01T01:45:00+14:00", end: "2026-12-01T01:55:00+14:00" },
      opts("Etc/GMT+12"),
    );
    expect([gmt12.start, gmt12.wallStart]).toEqual([
      at("2026-11-30T11:45:00Z"),
      wall(11, 29, 23, 45),
    ]);
  });

  it("an all-day role over times — whole days, a timed end inside a day ends that day", () => {
    const s = span(
      {
        start: "2026-11-23T10:00:00",
        end: "2026-11-24T12:00:00",
        allDay: true,
      },
      opts("UTC"),
    );
    expect([s.wallStart, s.wallEnd, s.allDay]).toEqual([
      wall(11, 23),
      wall(11, 25),
      true,
    ]);
    const midnight = span(
      {
        start: "2026-11-23T10:00:00",
        end: "2026-11-25T00:00:00",
        allDay: true,
      },
      opts("UTC"),
    );
    expect(midnight.wallEnd).toBe(wall(11, 25));
  });

  it("refusals — no start · bad start · a time only · bad end · end before start", () => {
    const reason = (values: { start: unknown; end?: unknown }) => {
      const result = readScheduleSpan(values, opts("UTC"));
      return result.ok ? "ok" : result.reason;
    };
    expect(reason({ start: null })).toBe("noStart");
    expect(reason({ start: "" })).toBe("noStart");
    expect(reason({ start: "soon" })).toBe("badStart");
    expect(reason({ start: "10:00" })).toBe("badStart");
    expect(reason({ start: "2026-11-23", end: "later" })).toBe("badEnd");
    expect(
      reason({ start: "2026-11-23T10:00:00", end: "2026-11-23T09:59:00" }),
    ).toBe("reversed");
    expect(reason({ start: "2026-11-23", end: "2026-11-22" })).toBe("reversed");
    expect(reason({ start: "2026-11-23T10:00:00", end: "" })).toBe("ok");
  });

  it("a Date and epoch ms are instants", () => {
    expect(
      readScheduleInstant(new Date("2026-11-23T00:00:00Z"), "Asia/Seoul"),
    ).toEqual({
      instant: at("2026-11-23T00:00:00Z"),
      wall: wall(11, 23, 9),
      dateOnly: false,
    });
    expect(readScheduleInstant(at("2026-11-23T00:00:00Z"), "UTC")?.wall).toBe(
      wall(11, 23),
    );
    expect(readScheduleInstant(Number.NaN, "UTC")).toBeUndefined();
    expect(readScheduleInstant(new Date("x"), "UTC")).toBeUndefined();
  });
});

describe("daylight-saving days (America/New_York) — reader → time grid", () => {
  const NY = "America/New_York";
  it("spring forward 2026-03-08: 01:30 ~ 03:30 lasts one hour, is drawn 01:30 ~ 03:30", () => {
    const s = span(
      { start: "2026-03-08T01:30:00", end: "2026-03-08T03:30:00" },
      opts(NY),
    );
    expect([s.start, s.end]).toEqual([
      at("2026-03-08T06:30:00Z"),
      at("2026-03-08T07:30:00Z"),
    ]);
    // 02:30 does not exist — it is read as 03:30 (the clock's later side).
    const gap = span({ start: "2026-03-08T02:30:00" }, opts(NY));
    expect([gap.start, gap.wallStart]).toEqual([
      at("2026-03-08T07:30:00Z"),
      wall(3, 8, 3, 30),
    ]);
    const layout = layoutScheduleTimeGrid(
      [
        { key: "s", start: s.wallStart, end: s.wallEnd },
        { key: "gap", start: gap.wallStart, end: gap.wallEnd },
      ],
      { days: [wall(3, 8)] },
    );
    expect(
      layout.items.map((i) => [i.key, i.top, i.height, i.column, i.columns]),
    ).toEqual([
      ["s", 90, 120, 0, 1],
      ["gap", 210, 30, 0, 1],
    ]);
  });

  it("fall back 2026-11-01: the repeated 01:30 — an hour long, drawn at the minimum height", () => {
    const s = span(
      { start: "2026-11-01T01:30:00-04:00", end: "2026-11-01T01:30:00-05:00" },
      opts(NY),
    );
    expect(s.end - s.start).toBe(3_600_000);
    expect([s.wallStart, s.wallEnd]).toEqual([
      wall(11, 1, 1, 30),
      wall(11, 1, 1, 30),
    ]);
    const [item] = layoutScheduleTimeGrid(
      [{ key: "s", start: s.wallStart, end: s.wallEnd }],
      {
        days: [wall(11, 1)],
      },
    ).items;
    expect([item!.top, item!.height]).toEqual([90, 15]);
    // A day only value on that day is still the day's midnight to the next (25 hours).
    const day = span({ start: "2026-11-01" }, opts(NY));
    expect(day.end - day.start).toBe(25 * 3_600_000);
  });

  it("a midnight that does not exist (America/Santiago 2026-09-06) — the day starts at 01:00", () => {
    expect(scheduleWallDayStart(wall(9, 6), "America/Santiago")).toBe(
      at("2026-09-06T04:00:00Z"),
    );
  });
});

describe("scheduleSpanOverlaps — the overlap contract (Decision 8)", () => {
  const window = {
    start: at("2026-11-23T00:00:00Z"),
    end: at("2026-11-30T00:00:00Z"),
  };
  const fits = (start: string, end: string) =>
    scheduleSpanOverlaps({ start: at(start), end: at(end) }, window);
  it("crossing the window in, starting on its end out, ending on its start out", () => {
    expect(fits("2026-11-21T00:00:00Z", "2026-12-02T00:00:00Z")).toBe(true);
    expect(fits("2026-11-30T00:00:00Z", "2026-11-30T01:00:00Z")).toBe(false);
    expect(fits("2026-11-22T23:00:00Z", "2026-11-23T00:00:00Z")).toBe(false);
    expect(fits("2026-11-22T23:00:00Z", "2026-11-23T00:01:00Z")).toBe(true);
  });
  it("a zero-length span — in at the window's start, out at its end", () => {
    expect(fits("2026-11-23T00:00:00Z", "2026-11-23T00:00:00Z")).toBe(true);
    expect(fits("2026-11-30T00:00:00Z", "2026-11-30T00:00:00Z")).toBe(false);
  });
});
