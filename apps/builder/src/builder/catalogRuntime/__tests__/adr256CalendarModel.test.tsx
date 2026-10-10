// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarHeading,
} from "react-aria-components/Calendar";
import { Heading } from "react-aria-components/Heading";
import { I18nProvider } from "react-aria-components/I18nProvider";
import { describe, expect, it } from "vitest";
import {
  catalogCalendarGrid,
  catalogCalendarHeading,
  catalogCalendarMonthCount,
  catalogCalendarRangeTitle,
  catalogParseCalendarDay,
} from "../../../../../../packages/shared/src/catalog/runtime/calendarModel";

/**
 * ADR-256 Phase 9 — the Canvas calendar model against the installed RAC 1.21.0 (oracle: the
 * reference starter's month blocks mounted with the same props — heading, weekday row and the
 * visible day cells of each grid). A cell outside its month is hidden in the DOM
 * (`[data-outside-month] { display: none }`) — compared as an empty cell.
 */
const NOW = new Date(2026, 9, 11); // 2026-10-11 (Sunday)

function mountReference(props: Record<string, unknown>, locale: string) {
  const months = catalogCalendarMonthCount(props.visibleDuration);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <I18nProvider locale={locale}>
        <Calendar aria-label="c" {...(props as object)}>
          <Heading className="range-title" />
          {Array.from({ length: months }, (_, i) => (
            <div key={i} className="month">
              <CalendarHeading offset={{ months: i }} />
              <CalendarGrid offset={{ months: i }}>
                {(date) => <CalendarCell date={date} />}
              </CalendarGrid>
            </div>
          ))}
        </Calendar>
      </I18nProvider>,
    ),
  );
  const title = host.querySelector(".range-title")?.textContent ?? "";
  const blocks = [...host.querySelectorAll(".month")].map((block) => ({
    heading: block.querySelector("h2, h3")?.textContent ?? "",
    weekdays: [...block.querySelectorAll("thead th")].map(
      (th) => th.textContent ?? "",
    ),
    rows: [...block.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((td) => {
        const cell = td.querySelector(".react-aria-CalendarCell");
        if (!cell || cell.hasAttribute("data-outside-month")) return "";
        return cell.textContent ?? "";
      }),
    ),
    today: (() => {
      const rows = [...block.querySelectorAll("tbody tr")];
      for (let r = 0; r < rows.length; r++) {
        const cols = [...rows[r].children];
        for (let c = 0; c < cols.length; c++) {
          const cell = cols[c].querySelector(".react-aria-CalendarCell");
          if (
            cell?.hasAttribute("data-today") &&
            !cell.hasAttribute("data-outside-month")
          )
            return [r, c] as [number, number];
        }
      }
      return undefined;
    })(),
  }));
  act(() => root.unmount());
  host.remove();
  return { title, blocks };
}

function model(props: Record<string, unknown>, locale: string) {
  return Array.from(
    { length: catalogCalendarMonthCount(props.visibleDuration) },
    (_, i) => ({
      heading: catalogCalendarHeading(props, i, locale, NOW),
      ...catalogCalendarGrid(props, i, locale, NOW),
    }),
  );
}

const FOCUS = "2026-10-11";
const CASES: ReadonlyArray<[string, Record<string, unknown>]> = [
  ["Month 1", { visibleDuration: { months: 1 } }],
  ["Month 2", { visibleDuration: { months: 2 } }],
  ["Month 3", { visibleDuration: { months: 3 } }],
  ["Week 1", { visibleDuration: { weeks: 1 } }],
  ["Week 2", { visibleDuration: { weeks: 2 } }],
  ["Day 1", { visibleDuration: { days: 1 } }],
  ["Day 3", { visibleDuration: { days: 3 } }],
  ["Day 10", { visibleDuration: { days: 10 } }],
  ["Month 1 · mon", { visibleDuration: { months: 1 }, firstDayOfWeek: "mon" }],
  ["Month 2 · sat", { visibleDuration: { months: 2 }, firstDayOfWeek: "sat" }],
  ["Week 2 · mon", { visibleDuration: { weeks: 2 }, firstDayOfWeek: "mon" }],
  ["Month 1 · 6 weeks", { visibleDuration: { months: 1 }, weeksInMonth: 6 }],
  [
    "Month 2 · sun · 6 weeks",
    { visibleDuration: { months: 2 }, firstDayOfWeek: "sun", weeksInMonth: 6 },
  ],
  ["Week 2 · 6 weeks", { visibleDuration: { weeks: 2 }, weeksInMonth: 6 }],
  ["default value", { defaultValue: "2024-02-29" }],
  ["min bound", { visibleDuration: { months: 3 }, minValue: "2026-10-01" }],
];

describe("ADR-256 Phase 9 — Canvas calendar model = installed RAC", () => {
  for (const locale of ["en-US", "ko-KR"])
    it.each(CASES)(`${locale} %s`, (_name, props) => {
      const input = { defaultFocusedValue: FOCUS, ...props };
      // (RAC's focus: an explicit focused date keeps the DOM away from the test clock.)
      if ("defaultValue" in props)
        delete (input as Record<string, unknown>).defaultFocusedValue;
      const reference = mountReference(
        Object.fromEntries(
          Object.entries(input).map(([key, value]) => [
            key,
            typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
              ? parseIso(value)
              : value,
          ]),
        ),
        locale,
      );
      const ours = model(input, locale);
      expect(ours.map(({ today: _t, ...rest }) => rest)).toEqual(
        reference.blocks.map(({ today: _t, ...rest }) => rest),
      );
      expect(catalogCalendarRangeTitle(input, locale, NOW)).toBe(
        reference.title,
      );
    });

  it("marks today's cell where RAC does", () => {
    const today = new Date();
    const props = { visibleDuration: { months: 2 } };
    const reference = mountReference(props, "en-US");
    const ours = model(props, "en-US").map((block, i) => ({
      ...block,
      ...catalogCalendarGrid(props, i, "en-US", today),
    }));
    expect(ours.map((block) => block.today)).toEqual(
      reference.blocks.map((block) => block.today),
    );
  });
});

function parseIso(value: string) {
  // (RAC takes a DateValue — the same `parseDate` the model uses.)
  return catalogParseCalendarDay(value);
}
