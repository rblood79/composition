/**
 * ADR-323 Phase 3 — the EventCalendar's month · agenda model against written days (a 2026 wall
 * calendar: 11-01 is a Sunday, 11-30 a Monday), not the module's own output.
 */
import { describe, expect, it } from "vitest";

import { readScheduleSpan } from "../../../collections/scheduleSpan";
import {
  catalogEventCalendarAgendaWindow,
  catalogEventCalendarDayEvents,
  catalogEventCalendarMonth,
  catalogEventCalendarReference,
  catalogEventCalendarStep,
  catalogEventCalendarTitle,
  catalogEventCalendarViewOf,
  type CatalogEventCalendarInput,
} from "../eventCalendar";

const NOW = new Date("2026-11-28T03:00:00Z");
const seoul = (
  extra: Partial<CatalogEventCalendarInput> = {},
): CatalogEventCalendarInput => ({
  timeZone: "Asia/Seoul",
  locale: "en-US",
  ...extra,
});

describe("reference date · step", () => {
  it("no defaultDate = today in the component's zone (Seoul 11-28, −12:00 11-27)", () => {
    expect(catalogEventCalendarReference(seoul(), NOW)).toBe("2026-11-28");
    expect(catalogEventCalendarReference({ timeZone: "Etc/GMT+12" }, NOW)).toBe(
      "2026-11-27",
    );
    expect(
      catalogEventCalendarReference(
        seoul({ referenceDate: "2027-02-14" }),
        NOW,
      ),
    ).toBe("2027-02-14");
  });
  it("previous · next = the first of the month before · after, today = today", () => {
    const input = seoul({ referenceDate: "2026-01-31" });
    expect(catalogEventCalendarStep(input, 1, NOW)).toBe("2026-02-01");
    expect(catalogEventCalendarStep(input, -1, NOW)).toBe("2025-12-01");
    expect(catalogEventCalendarStep(input, 0, NOW)).toBe("2026-11-28");
  });
  it("a view key: agenda, anything else the month", () => {
    expect(catalogEventCalendarViewOf("agenda")).toBe("agenda");
    expect(catalogEventCalendarViewOf("week")).toBe("month");
    expect(catalogEventCalendarViewOf(undefined)).toBe("month");
  });
});

describe("catalogEventCalendarMonth", () => {
  it("en-US (weeks from Sunday): 5 weeks 11-01 ~ 12-05, outside days and today marked", () => {
    const month = catalogEventCalendarMonth(seoul(), undefined, NOW);
    expect(month.title).toBe("November 2026");
    expect(month.weekdays).toEqual([
      "Sun",
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
    ]);
    expect(month.weeks).toHaveLength(5);
    expect(month.weeks[0]![0]!.date).toBe("2026-11-01");
    expect(month.weeks[4]!.map((day) => day.day)).toEqual([
      "29",
      "30",
      "1",
      "2",
      "3",
      "4",
      "5",
    ]);
    expect(month.weeks[4]!.map((day) => day.outside)).toEqual([
      false,
      false,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(month.weeks.flat().filter((day) => day.today)).toEqual([
      expect.objectContaining({ date: "2026-11-28" }),
    ]);
    expect(month.weeks[0]![0]!.wall).toBe(Date.UTC(2026, 10, 1));
    expect(month.window).toEqual({ from: "2026-11-01", until: "2026-12-06" });
  });
  it("weeks from Monday: 6 weeks 10-26 ~ 12-06", () => {
    const month = catalogEventCalendarMonth(
      seoul({ firstDayOfWeek: "mon" }),
      undefined,
      NOW,
    );
    expect(month.weekdays[0]).toBe("Mon");
    expect(month.weeks).toHaveLength(6);
    expect(month.weeks[0]![0]).toMatchObject({
      date: "2026-10-26",
      outside: true,
    });
    expect(month.window).toEqual({ from: "2026-10-26", until: "2026-12-07" });
  });
  it("ko-KR: the title and the weekday names are the locale's", () => {
    const month = catalogEventCalendarMonth(
      seoul({ locale: "ko-KR" }),
      undefined,
      NOW,
    );
    expect(month.title).toBe("2026년 11월");
    expect(month.weekdays).toEqual(["일", "월", "화", "수", "목", "금", "토"]);
  });
  it("a calendar system: the same days, that calendar's year in the title", () => {
    const input = seoul({ calendarSystem: "buddhist" });
    expect(catalogEventCalendarTitle(input, undefined, NOW)).toContain("2569");
    expect(catalogEventCalendarMonth(input, undefined, NOW).window).toEqual({
      from: "2026-11-01",
      until: "2026-12-06",
    });
  });
  it("the agenda shows the reference month", () => {
    expect(catalogEventCalendarAgendaWindow(seoul(), NOW)).toEqual({
      from: "2026-11-01",
      until: "2026-12-01",
    });
  });
});

describe("catalogEventCalendarDayEvents", () => {
  const span = (start: string, end?: string) => {
    const read = readScheduleSpan(
      { start, end },
      { timeZone: "Asia/Seoul", defaultDurationMinutes: 30 },
    );
    if (!read.ok) throw new Error(read.reason);
    return read.span;
  };
  const events = [
    { row: "late", span: span("2026-11-23T15:00:00+09:00") },
    { row: "early", span: span("2026-11-23T09:00:00+09:00") },
    { row: "trip", span: span("2026-11-22", "2026-11-25") },
    {
      row: "overnight",
      span: span("2026-11-24T23:00:00+09:00", "2026-11-25T01:00:00+09:00"),
    },
    { row: "day", span: span("2026-11-23") },
    // (On 11-25 the overnight event began the day before — the all-day one still comes first.)
    { row: "holiday", span: span("2026-11-25") },
  ];
  it("days with events, each covering event: all-day first (longer first), then by start", () => {
    const days = catalogEventCalendarDayEvents(events, {
      from: "2026-11-23",
      until: "2026-11-27",
    });
    expect(
      days.map(({ date, events }) => [date, events.map(({ row }) => row)]),
    ).toEqual([
      ["2026-11-23", ["trip", "day", "early", "late"]],
      ["2026-11-24", ["trip", "overnight"]],
      ["2026-11-25", ["holiday", "overnight"]],
    ]);
  });
});
