import { describe, expect, it } from "vitest";
import { parseDate, Time } from "@internationalized/date";
import { safeParseDateString } from "../../../state/dateValue";
import {
  catalogCalendarDayOf,
  catalogCalendarOverride,
  catalogCalendarValue,
  catalogDateStartValue,
  catalogDateValue,
  catalogTimeValue,
} from "../dateValueRead";

/**
 * ADR-309 G1 (b) — one reader. The Phase 0 table's 「유지」 inputs read as before (the DOM date
 * reader was already `parseDateValue` — `safeParseDateString`); its 「변경」 rows read as the DOM
 * does (breakdown §6 Phase 0).
 */
const KEPT = [
  "2026-11-12",
  "2026-11-12T10:30",
  "2026-11-12T10:30:15",
  "2026-11-12T10:30:15.250",
  "2026-11-12T01:30:00Z",
  "2026-11-12T10:30:00+09:00",
  "2026-11-12T10:30[Asia/Seoul]",
  "10:30",
  "",
  "garbage",
  "2026-13-40",
  " 2026-11-12 ",
  "2026-11-12junk",
];

describe("ADR-309 — the date family's one reader", () => {
  it("(b) a date prop reads as the DOM read it before (`safeParseDateString`)", () => {
    for (const input of KEPT)
      expect(String(catalogDateValue(input) ?? null), input).toBe(
        String(safeParseDateString(input)),
      );
  });

  it("a date-only value at a time granularity is that day at midnight (R3)", () => {
    for (const granularity of ["hour", "minute", "second"])
      expect(String(catalogDateValue("2026-11-12", granularity))).toBe(
        "2026-11-12T00:00:00",
      );
    expect(String(catalogDateValue("2026-11-12", "day"))).toBe("2026-11-12");
    expect(String(catalogDateValue("2026-11-12T10:30", "minute"))).toBe(
      "2026-11-12T10:30:00",
    );
  });

  it("변경 — a TimeField reads the time of a date and time (was hour 2026, shown 23:30)", () => {
    const time = catalogTimeValue("2026-11-12T10:30") as Time;
    expect([time.hour, time.minute]).toEqual([10, 30]);
    expect(String(catalogTimeValue("10:30:15"))).toBe("10:30:15");
    expect(catalogTimeValue("2026-11-12")).toBeUndefined();
    expect(catalogTimeValue("garbage")).toBeUndefined();
  });

  it("변경 — the Canvas calendar's day reads as the DOM: spaces read, junk not, an instant's UTC day", () => {
    expect(String(catalogCalendarDayOf(" 2026-11-12 "))).toBe("2026-11-12");
    expect(catalogCalendarDayOf("2026-11-12junk")).toBeUndefined();
    expect(String(catalogCalendarDayOf("2026-11-12T02:00:00+09:00"))).toBe(
      "2026-11-11",
    );
    expect(String(catalogCalendarDayOf("2026-11-12T10:30"))).toBe("2026-11-12");
  });

  it("the start value — `value` when there is one (a cleared `null` too), else `defaultValue`", () => {
    expect(catalogDateStartValue({ defaultValue: "2026-11-12" })).toBe(
      "2026-11-12",
    );
    expect(
      catalogDateStartValue({
        value: "2026-11-14",
        defaultValue: "2026-11-12",
      }),
    ).toBe("2026-11-14");
    expect(
      catalogDateStartValue({ value: null, defaultValue: "2026-11-12" }),
    ).toBeNull();
  });

  it("a Calendar value in its selection mode — read and written as ISO, never joined", () => {
    expect(
      (
        catalogCalendarValue(
          ["2026-11-12", "x", "2026-11-14"],
          "multiple",
        ) as readonly unknown[]
      ).map(String),
    ).toEqual(["2026-11-12", "2026-11-14"]);
    expect(
      String(catalogCalendarValue(["2026-11-14", "2026-11-12"], "single")),
    ).toBe("2026-11-14");
    expect(
      (catalogCalendarValue("2026-11-12", "multiple") as unknown[]).map(String),
    ).toEqual(["2026-11-12"]);
    expect(catalogCalendarValue(null, "multiple")).toBeNull();
    expect(catalogCalendarValue([], "multiple")).toBeNull();
    expect(catalogCalendarValue(null, "single")).toBeNull();
    expect(
      catalogCalendarOverride(
        [parseDate("2026-11-12"), parseDate("2026-11-14")],
        "multiple",
      ),
    ).toEqual(["2026-11-12", "2026-11-14"]);
    expect(catalogCalendarOverride(parseDate("2026-11-12"), "single")).toBe(
      "2026-11-12",
    );
    expect(catalogCalendarOverride(null, "multiple")).toEqual([]);
    expect(catalogCalendarOverride(null, "single")).toBeNull();
  });
});
