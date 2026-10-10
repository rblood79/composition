// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "react-aria-components/Button";
import {
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarHeading,
} from "react-aria-components/Calendar";
import { I18nProvider } from "react-aria-components/I18nProvider";
import {
  CalendarMonthPicker,
  CalendarYearPicker,
} from "react-aria-components/Calendar";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { RangeCalendar } from "react-aria-components/RangeCalendar";
import { Select, SelectValue } from "react-aria-components/Select";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogCalendarGridSize } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import { renderCatalogDom } from "../domBinding";
import { catalogSlotInsertOptions } from "../slots";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 9 (G2) — a Calendar · RangeCalendar draws the reference starter's node tree in
 * RAC's calendar: `div.months > div.month (one per shown month) > header (Button[previous] on the
 * first block · CalendarHeading · Button[next] on the last) + CalendarGrid > CalendarCell`. Oracle:
 * the starter (react-aria.adobe.com Calendar.md, 2026-10-09) mounted on the installed RAC 1.21.0
 * with the same props — compared as a structure (tags · roles · aria · slot · text; ids, classes,
 * data and style left out — Decision 11).
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:calendar" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

function mount(element: React.ReactElement): HTMLElement {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  act(() => root.render(element));
  cleanups.push(() => {
    act(() => root.unmount());
    host.remove();
  });
  return host;
}

async function place(type: "calendar" | "rangecalendar") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-calendar" as EntryId<"project">,
        name: "Calendar",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-calendar-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1600, height: 900 },
      autosaveSchedule: () => {},
      locale: "en-US",
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId: `lib:definition:origin-component-${type}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const write = (props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ) as never,
      }),
    );
  const root = workspace.root;
  const render = () =>
    mount(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find((r) => r.sourceId === FIELD)!.id,
      ) as React.ReactElement,
    );
  return { workspace, root, write, render };
}

/** The reference starter (`Calendar.tsx` · `RangeCalendar.tsx` of the vanilla starter). */
function Starter({
  range,
  ...props
}: { range: boolean } & Record<string, unknown>) {
  const visible = props.visibleDuration as { months?: number } | undefined;
  const months = visible?.months || 1;
  const Root = (range ? RangeCalendar : Calendar) as React.ElementType;
  return (
    <I18nProvider locale="en-US">
      <Root {...props}>
        <div className="months">
          {Array.from({ length: months }, (_, i) => (
            <div key={i} className="month">
              <header>
                {i === 0 && (
                  <Button slot="previous">
                    <svg />
                  </Button>
                )}
                <CalendarHeading offset={{ months: i }} />
                {i === months - 1 && (
                  <Button slot="next">
                    <svg />
                  </Button>
                )}
              </header>
              <CalendarGrid offset={{ months: i }}>
                {(date) => <CalendarCell date={date} />}
              </CalendarGrid>
            </div>
          ))}
        </div>
      </Root>
    </I18nProvider>
  );
}

const ARIA = /^(role|aria-[a-z-]+|slot|tabindex|disabled|type)$/;
/** A structure of an element (tags · roles · aria · slot · text; ids · classes · data · style out). */
function shape(element: Element): unknown {
  // (The catalog Icon draws a `div.react-aria-Icon > svg` — the reference's glyph is the svg alone,
  // 사용자 결정 2026-10-09 「ADR-256 Icon div 유지」.)
  if (element.classList.contains("react-aria-Icon")) return "svg";
  if (element.tagName === "svg") return "svg";
  const attrs = [...element.attributes]
    .filter((attr) => ARIA.test(attr.name))
    // (aria references name generated ids — compared by presence.)
    .map((attr) =>
      /^aria-(labelledby|describedby|controls|owns)$/.test(attr.name)
        ? `${attr.name}`
        : `${attr.name}=${attr.value}`,
    )
    .sort();
  const kids = [...element.childNodes]
    .map((child) =>
      child.nodeType === 3
        ? (child.textContent ?? "").trim() || null
        : child.nodeType === 1
          ? shape(child as Element)
          : null,
    )
    .filter((child) => child !== null);
  return { tag: element.tagName.toLowerCase(), attrs, kids };
}
const calendarOf = (host: HTMLElement, range: boolean) =>
  host.querySelector(
    range ? ".react-aria-RangeCalendar" : ".react-aria-Calendar",
  )!;

describe("ADR-256 Phase 9 — Calendar node tree (G2)", () => {
  for (const range of [false, true])
    it.each([1, 2, 3])(
      `${range ? "RangeCalendar" : "Calendar"} — %i month(s) = the reference starter`,
      async (months) => {
        const { write, render } = await place(
          range ? "rangecalendar" : "calendar",
        );
        write({ visibleDuration: { months } });
        const ours = calendarOf(render(), range);
        const reference = calendarOf(
          mount(
            <Starter
              range={range}
              aria-label={range ? "Range Calendar" : "Calendar"}
              visibleDuration={{ months }}
            />,
          ),
          range,
        );
        expect(shape(ours)).toEqual(shape(reference));
        expect(ours.querySelectorAll("table")).toHaveLength(months);
      },
    );

  it("days · weeks views: one block, RAC's day range heading and rows", async () => {
    const { write, render } = await place("calendar");
    for (const visibleDuration of [{ days: 3 }, { weeks: 2 }]) {
      write({ visibleDuration });
      const ours = calendarOf(render(), false);
      const reference = calendarOf(
        mount(
          <Starter
            range={false}
            aria-label="Calendar"
            visibleDuration={visibleDuration}
          />,
        ),
        false,
      );
      expect(shape(ours)).toEqual(shape(reference));
    }
  });

  it("paging: next moves the shown months (visible · single)", async () => {
    const { write, render } = await place("calendar");
    const month = (offset: number) => {
      const now = new Date();
      return new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(new Date(now.getFullYear(), now.getMonth() + offset, 1));
    };
    for (const [pageBehavior, step] of [
      ["visible", 2],
      ["single", 1],
    ] as const) {
      write({ visibleDuration: { months: 2 }, pageBehavior });
      const host = render();
      const headings = () =>
        [...host.querySelectorAll(".react-aria-CalendarHeading")].map(
          (heading) => heading.textContent,
        );
      expect(headings()).toEqual([month(0), month(1)]);
      act(() => host.querySelector<HTMLElement>('[slot="next"]')!.click());
      expect(headings(), pageBehavior).toEqual([month(step), month(step + 1)]);
    }
  });

  it("selecting a date and a range works through the cell template", async () => {
    const calendar = await place("calendar");
    const host = calendar.render();
    const cell = (day: string) =>
      [
        ...host.querySelectorAll<HTMLElement>(
          ".react-aria-CalendarCell:not([data-outside-month])",
        ),
      ].find((element) => element.textContent === day)!;
    act(() => cell("15").click());
    expect(cell("15").hasAttribute("data-selected")).toBe(true);
    const range = await place("rangecalendar");
    const rangeHost = range.render();
    const rangeCell = (day: string) =>
      [
        ...rangeHost.querySelectorAll<HTMLElement>(
          ".react-aria-CalendarCell:not([data-outside-month])",
        ),
      ].find((element) => element.textContent === day)!;
    act(() => rangeCell("12").click());
    act(() => rangeCell("16").click());
    expect(
      [
        ...rangeHost.querySelectorAll(
          ".react-aria-CalendarCell[data-selected]",
        ),
      ].map((element) => element.textContent),
    ).toEqual(["12", "13", "14", "15", "16"]);
  });

  /** The reference's Month and year pickers (Calendar.md 「Month and year pickers」). */
  function PickerStarter({ range }: { range: boolean }) {
    const Root = (range ? RangeCalendar : Calendar) as React.ElementType;
    const PickerSelect = (props: Record<string, unknown>) => (
      <Select {...props}>
        <Button>
          <SelectValue />
          <svg />
        </Button>
        <Popover>
          <ListBox items={props.items as never}>
            {(item: { formatted: string }) => (
              <ListBoxItem>{item.formatted}</ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </Select>
    );
    return (
      <I18nProvider locale="en-US">
        <Root aria-label={range ? "Range Calendar" : "Calendar"}>
          <div className="months">
            <div className="month">
              <header>
                <Button slot="previous">
                  <svg />
                </Button>
                <CalendarMonthPicker>
                  {(props) => <PickerSelect {...props} />}
                </CalendarMonthPicker>
                <CalendarYearPicker>
                  {(props) => <PickerSelect {...props} />}
                </CalendarYearPicker>
                <Button slot="next">
                  <svg />
                </Button>
              </header>
              <CalendarGrid>
                {(date) => <CalendarCell date={date} />}
              </CalendarGrid>
            </div>
          </div>
        </Root>
      </I18nProvider>
    );
  }

  /** The header's heading swapped for the month · year pickers (the insert list's origins). */
  async function withPickers(type: "calendar" | "rangecalendar") {
    const placed = await place(type);
    const { workspace, root } = placed;
    const heading = [...root.domInputs.values()].find(
      (record) => root.typeOf(record) === "CalendarHeading",
    )!;
    const header = [...root.domInputs.values()].find(
      (record) => root.typeOf(record) === "CalendarHeader",
    )!;
    workspace.execute(
      removeTargets({
        targets: [workspace.positionOfRecord(heading.id)!.target],
      }),
    );
    const headerTarget = workspace.positionOfRecord(header.id)!.target;
    const options = catalogSlotInsertOptions(
      workspace.runtime.graph,
      headerTarget,
    ).map((option) => option.type);
    expect(options).toEqual(
      expect.arrayContaining([
        "CalendarHeading",
        "CalendarMonthPicker",
        "CalendarYearPicker",
      ]),
    );
    for (const [index, kind] of [
      [1, "month"],
      [2, "year"],
    ] as const) {
      const id = workspace.newId("node") as NodeId;
      workspace.execute(
        insertNodes({
          parent:
            headerTarget.kind === "descendant"
              ? {
                  kind: "descendant",
                  ownerId: headerTarget.ownerId,
                  address: headerTarget.address,
                }
              : { kind: "node", id: headerTarget.id },
          index,
          entries: [
            {
              kind: "node",
              id,
              definitionId: `lib:definition:origin-component-calendar${kind}picker`,
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            } as NodeEntry,
          ],
          rootIds: [id],
          newId: workspace.newId,
        }),
      );
    }
    return placed;
  }

  for (const range of [false, true])
    it(`${range ? "RangeCalendar" : "Calendar"}: month · year pickers in the header = the reference's`, async () => {
      const { render } = await withPickers(range ? "rangecalendar" : "calendar");
      const ours = calendarOf(render(), range);
      const reference = calendarOf(mount(<PickerStarter range={range} />), range);
      expect(shape(ours)).toEqual(shape(reference));
    });

  it("picking a month and a year moves the grid (RAC's picker render props)", async () => {
    const { render, root } = await withPickers("calendar");
    const host = render();
    const now = new Date();
    const triggers = () =>
      [...host.querySelectorAll<HTMLElement>("header .react-aria-Select button")];
    expect(triggers().map((trigger) => trigger.textContent)).toEqual([
      new Intl.DateTimeFormat("en-US", { month: "short" }).format(now),
      String(now.getFullYear()),
    ]);
    // The Canvas trigger values are the same (the pickers' focused month · year).
    expect(
      [...root.canvasInputs.values()]
        .filter((record) => root.typeOf(record) === "SelectValue")
        .map((record) => record.derivedProps?.children),
    ).toEqual(triggers().map((trigger) => trigger.textContent));
    // Open the month picker and choose March: the grid shows March.
    act(() => triggers()[0]!.click());
    const march = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (option) => option.textContent === "Mar",
    )!;
    expect(march).toBeDefined();
    act(() => march.click());
    expect(triggers()[0]!.textContent).toBe("Mar");
    const grid = host.querySelector(".react-aria-CalendarGrid")!;
    expect(grid.getAttribute("aria-label")).toMatch(/March/);
  });

  it("판독 R1: a node put beside the month blocks (the frame becomes a filled slot) keeps the blocks repeating", async () => {
    const { workspace, root, write, render } = await place("calendar");
    write({ visibleDuration: { months: 2 } });
    const frame = [...root.domInputs.values()].find(
      (record) =>
        root.typeOf(record) === "frame" &&
        root.typeOf(root.domInputs.get(record.parentId)!) === "Calendar",
    )!;
    const target = workspace.positionOfRecord(frame.id)!.target;
    const id = workspace.newId("node") as NodeId;
    workspace.execute(
      insertNodes({
        parent:
          target.kind === "descendant"
            ? { kind: "descendant", ownerId: target.ownerId, address: target.address }
            : { kind: "node", id: target.id },
        entries: [
          {
            kind: "node",
            id,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "note" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: [id],
        newId: workspace.newId,
      }),
    );
    const months = [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record) === "CalendarMonth",
    );
    expect(months.map((month) => month.monthIndex)).toEqual([0, 1]);
    const host = render();
    expect(host.querySelectorAll(".month")).toHaveLength(2);
    expect(host.querySelectorAll('[slot="next"]')).toHaveLength(1);
  });

  it("판독 M1: the month blocks are not data rows — Layers keeps them as positions it can open", async () => {
    const { workspace, root, write } = await place("calendar");
    write({ visibleDuration: { months: 2 } });
    const frame = [...root.domInputs.values()].find(
      (record) =>
        root.typeOf(record) === "frame" &&
        root.typeOf(root.domInputs.get(record.parentId)!) === "Calendar",
    )!;
    const months = frame.children.map((id) => root.domInputs.get(id)!);
    expect(months.map((month) => month.rowIndex)).toEqual([undefined, undefined]);
    expect(workspace.boundRowsOf(workspace.positionOfRecord(frame.id)!)).toBeUndefined();
  });

  it("a week row with no day shown (weeksInMonth past the month) is its tds' padding only — the DOM's height", async () => {
    // October 2026 from Monday takes 5 weeks: the 6th row is all outside the month, which RAC's
    // sheet hides (`[data-outside-month] { display: none }`) — the row is 4px in the DOM.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 12));
    try {
      const { root, write } = await place("calendar");
      write({ firstDayOfWeek: "mon", weeksInMonth: 6 });
      const grid = [...root.canvasInputs.values()].find(
        (record) => root.typeOf(record) === "CalendarGrid",
      )!;
      const model = JSON.parse(String(grid.derivedProps?._calendarGrid)) as {
        rows: string[][];
      };
      expect(model.rows).toHaveLength(6);
      expect(model.rows[5]!.every((cell) => cell === "")).toBe(true);
      expect(root.getGeometry([grid.id]).get(grid.id)?.height).toBe(
        catalogCalendarGridSize("M", 7, 6, 1)!.height,
      );
      expect(catalogCalendarGridSize("M", 7, 6, 1)!.height).toBe(
        catalogCalendarGridSize("M", 7, 5)!.height + 4,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
