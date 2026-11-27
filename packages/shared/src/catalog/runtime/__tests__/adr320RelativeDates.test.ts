import { describe, expect, it } from "vitest";
import type { ViewCondition } from "../../document/types";
import { viewCompare } from "../../../collections/view/comparison";
import {
  catalogFilterItemsResolved,
  catalogLocalToday,
  catalogRelativeDateRange,
  catalogWeekStart,
} from "../filterRelativeDates";
import { catalogFilterChips } from "../filterWording";

/**
 * ADR-320 Phase 5 (G5 — 사용자 결정 7) — relative dates against a table written by hand from a
 * calendar: the day boundary (the viewer's local day), the week's first day (the locale's — Sunday
 * in en-US · ko-KR, Monday in de-DE), month ends (30 · 31 · February · a leap year) and the year's
 * turn.
 */
describe("ADR-320 Phase 5 — relative dates", () => {
  it("the week starts as the locale says", () => {
    expect(catalogWeekStart("en-US")).toBe(0);
    expect(catalogWeekStart("ko-KR")).toBe(0);
    expect(catalogWeekStart("de-DE")).toBe(1);
    expect(catalogWeekStart(undefined)).toBe(1);
  });

  it("the day is the viewer's local date — the same day from its first to its last moment", () => {
    expect(catalogLocalToday(new Date(2026, 10, 27, 0, 0, 0, 0))).toBe(
      "2026-11-27",
    );
    expect(catalogLocalToday(new Date(2026, 10, 27, 23, 59, 59, 999))).toBe(
      "2026-11-27",
    );
    expect(catalogLocalToday(new Date(2026, 10, 28, 0, 0, 0, 0))).toBe(
      "2026-11-28",
    );
  });

  // [token, today, locale, from, to] — read off a calendar.
  const table: [
    Parameters<typeof catalogRelativeDateRange>[0],
    string,
    string,
    string,
    string,
  ][] = [
    // (2026-11-27 is a Friday.)
    ["today", "2026-11-27", "en-US", "2026-11-27", "2026-11-27"],
    ["yesterday", "2026-11-27", "en-US", "2026-11-26", "2026-11-26"],
    ["thisWeek", "2026-11-27", "en-US", "2026-11-22", "2026-11-28"],
    ["lastWeek", "2026-11-27", "en-US", "2026-11-15", "2026-11-21"],
    ["thisWeek", "2026-11-27", "de-DE", "2026-11-23", "2026-11-29"],
    ["lastWeek", "2026-11-27", "de-DE", "2026-11-16", "2026-11-22"],
    // (On the week's first day itself — Sunday 2026-11-22.)
    ["thisWeek", "2026-11-22", "en-US", "2026-11-22", "2026-11-28"],
    ["thisWeek", "2026-11-22", "de-DE", "2026-11-16", "2026-11-22"],
    ["thisWeek", "2026-11-23", "de-DE", "2026-11-23", "2026-11-29"],
    // (Month ends.)
    ["thisMonth", "2026-11-27", "en-US", "2026-11-01", "2026-11-30"],
    ["lastMonth", "2026-11-27", "en-US", "2026-10-01", "2026-10-31"],
    ["thisMonth", "2026-03-31", "en-US", "2026-03-01", "2026-03-31"],
    ["lastMonth", "2026-03-31", "en-US", "2026-02-01", "2026-02-28"],
    ["lastMonth", "2024-03-01", "en-US", "2024-02-01", "2024-02-29"],
    ["yesterday", "2024-03-01", "en-US", "2024-02-29", "2024-02-29"],
    // (The year's turn — 2026-01-01 is a Thursday.)
    ["yesterday", "2026-01-01", "en-US", "2025-12-31", "2025-12-31"],
    ["lastMonth", "2026-01-01", "en-US", "2025-12-01", "2025-12-31"],
    ["thisWeek", "2026-01-01", "en-US", "2025-12-28", "2026-01-03"],
    ["lastWeek", "2026-01-01", "en-US", "2025-12-21", "2025-12-27"],
    ["thisYear", "2026-01-01", "en-US", "2026-01-01", "2026-12-31"],
    ["thisYear", "2026-12-31", "en-US", "2026-01-01", "2026-12-31"],
  ];
  for (const [name, today, locale, from, to] of table)
    it(`${name} on ${today} (${locale}) = ${from} – ${to}`, () => {
      expect(catalogRelativeDateRange(name, today, locale)).toEqual([from, to]);
    });

  const condition = (
    op: ViewCondition["op"],
    value: ViewCondition["value"],
  ): ViewCondition => ({
    id: "c",
    fields: [["data:field:f-day" as never]],
    op,
    value,
  });
  const clock = { today: "2026-11-27", locale: "en-US" };

  it("the comparisons read the days: equals = within, notEquals = outside, before · after = its ends", () => {
    expect(
      catalogFilterItemsResolved([condition("equals", "@thisWeek")], clock),
    ).toEqual([condition("between", ["2026-11-22", "2026-11-28"])]);
    expect(
      catalogFilterItemsResolved([condition("equals", "@today")], clock),
    ).toEqual([condition("between", ["2026-11-27", "2026-11-27"])]);
    expect(
      catalogFilterItemsResolved([condition("before", "@thisWeek")], clock),
    ).toEqual([condition("before", "2026-11-22")]);
    expect(
      catalogFilterItemsResolved([condition("after", "@thisWeek")], clock),
    ).toEqual([condition("after", "2026-11-28")]);
    expect(
      catalogFilterItemsResolved(
        [condition("between", ["@lastWeek", "@thisWeek"])],
        clock,
      ),
    ).toEqual([condition("between", ["2026-11-15", "2026-11-28"])]);
    expect(
      catalogFilterItemsResolved([condition("notEquals", "@today")], clock),
    ).toEqual([condition("notEquals", "2026-11-27")]);
    expect(
      catalogFilterItemsResolved([condition("notEquals", "@thisWeek")], clock),
    ).toEqual([
      {
        id: "c",
        op: "or",
        items: [
          { ...condition("before", "2026-11-22"), id: "c~before" },
          { ...condition("after", "2026-11-28"), id: "c~after" },
        ],
      },
    ]);
  });

  it("a token on a field that is no date stays a literal; a literal stays the same object", () => {
    const text = condition("equals", "@today");
    expect(
      catalogFilterItemsResolved([text], { ...clock, isDate: () => false })[0],
    ).toBe(text);
    const literal = condition("equals", "2026-11-27");
    expect(catalogFilterItemsResolved([literal], clock)[0]).toBe(literal);
  });

  it("rows on each side of the week's edges: in · out as the calendar says", () => {
    const [resolved] = catalogFilterItemsResolved(
      [condition("equals", "@thisWeek")],
      clock,
    ) as [ViewCondition];
    const passes = (day: string) =>
      viewCompare(resolved.op, day, resolved.value, { kind: "date" });
    expect(passes("2026-11-21")).toBe(false);
    expect(passes("2026-11-22")).toBe(true);
    expect(passes("2026-11-28T23:59:00")).toBe(true);
    expect(passes("2026-11-29")).toBe(false);
  });

  it("a chip says the token's name in the site's language", () => {
    const [chip] = catalogFilterChips(
      {
        id: "filter-scope",
        op: "and",
        items: [condition("equals", "@thisWeek")],
      },
      () => "Joined",
      "ko-KR",
    );
    expect(chip!.value).toBe("이번 주");
    const [range] = catalogFilterChips(
      {
        id: "filter-scope",
        op: "and",
        items: [condition("between", ["@lastMonth", "2026-11-27"])],
      },
      () => "Joined",
      "en-US",
    );
    expect(range!.value).toBe("Last month – 2026-11-27");
  });
});
