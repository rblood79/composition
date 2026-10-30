import "fake-indexeddb/auto";
import { act as reactAct } from "react";
import { createRoot } from "react-dom/client";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogCalendarHeaderCommand,
  catalogCalendarHeaderMode,
} from "../calendarHeader";
import { I18nProvider } from "../../../i18n";
import { CatalogCalendarHeaderField } from "../../panels/properties/catalog/CatalogCalendarHeaderField";
import { renderCatalogDom } from "../domBinding";
import { CatalogWorkspaceProvider } from "../react";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 9 — a calendar's header as one Properties choice: the heading or RAC's month · year
 * pickers in its place (react-aria.adobe.com Calendar 「Month and year pickers」), one step each
 * way; switched-off pickers keep their props.
 */
const PROJECT = "project:project:calendar-header" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (name: string, definitionId: string): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open(definitionId: string, owned: boolean) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Calendar" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-calendar-header-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node("calendar", definitionId)],
      rootIds: [id("calendar")],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const recordOf = (type: string) =>
    [...root.domInputs.values()].find((record) => root.typeOf(record) === type);
  // The calendar's month frame filled: its blocks are the document's own nodes then.
  if (owned) {
    const frame = [...root.domInputs.values()].find(
      (record) =>
        root.typeOf(record) === "frame" &&
        CALENDARS.has(root.typeOf(root.domInputs.get(record.parentId)!)),
    )!;
    const at = workspace.positionOfRecord(frame.id)!.target;
    workspace.execute(
      insertNodes({
        parent:
          at.kind === "descendant"
            ? { kind: "descendant", ownerId: at.ownerId, address: at.address }
            : { kind: "node", id: at.id },
        entries: [node("note", "lib:definition:text")],
        rootIds: [id("note")],
        newId: workspace.newId,
      }),
    );
  }
  const header = () => {
    const record = recordOf("CalendarHeader")!;
    return record.children.map((child) =>
      root.typeOf(root.domInputs.get(child)!),
    );
  };
  const calendar = () =>
    workspace.positionOfRecord(recordOf(CALENDAR_TYPE[definitionId])!.id)!;
  const mode = () =>
    catalogCalendarHeaderMode(workspace.runtime.graph, calendar());
  const switchTo = (to: "heading" | "pickers") =>
    workspace.execute(
      catalogCalendarHeaderCommand(
        workspace.runtime.graph,
        calendar(),
        to,
        workspace.newId,
      ),
    );
  return { workspace, root, recordOf, header, mode, switchTo };
}

const CALENDARS: ReadonlySet<string> = new Set(["Calendar", "RangeCalendar"]);
const CALENDAR_TYPE: Record<string, string> = {
  "lib:definition:origin-component-calendar": "Calendar",
  "lib:definition:origin-component-rangecalendar": "RangeCalendar",
};

describe("ADR-256 Phase 9 — calendar header choice", () => {
  for (const definitionId of Object.keys(CALENDAR_TYPE))
    for (const owned of [false, true])
      it(`${CALENDAR_TYPE[definitionId]}${owned ? " (owned month blocks)" : ""}: heading ⇄ month · year pickers, one step each`, async () => {
        const { workspace, root, recordOf, header, mode, switchTo } =
          await open(definitionId, owned);
        expect(mode()).toBe("heading");
        expect(header()).toEqual(["Button", "CalendarHeading", "Button"]);
        // The calendar stays selected: the switch selects none of the parts it puts in.
        expect(
          catalogCalendarHeaderCommand(
            workspace.runtime.graph,
            workspace.positionOfRecord(
              recordOf(CALENDAR_TYPE[definitionId])!.id,
            )!,
            "pickers",
            workspace.newId,
          )(workspace.runtime.graph).selectAfter,
        ).toBe(undefined);

        switchTo("pickers");
        expect(mode()).toBe("pickers");
        // The reference's order: the pickers stand in the heading's place.
        expect(header()).toEqual([
          "Button",
          "CalendarMonthPicker",
          "CalendarYearPicker",
          "Button",
        ]);
        // One history step.
        workspace.undo();
        expect(mode()).toBe("heading");
        expect(header()).toEqual(["Button", "CalendarHeading", "Button"]);
        workspace.redo();
        expect(mode()).toBe("pickers");

        // A picker's own props stay while it is switched off.
        const picker = workspace.positionOfRecord(
          recordOf("CalendarMonthPicker")!.id,
        )!;
        workspace.execute(
          setFields({
            targets: [picker.target],
            props: { format: { kind: "set", value: "long" } },
          }),
        );
        switchTo("heading");
        expect(mode()).toBe("heading");
        expect(header()).toEqual(["Button", "CalendarHeading", "Button"]);
        switchTo("pickers");
        expect(header()).toEqual([
          "Button",
          "CalendarMonthPicker",
          "CalendarYearPicker",
          "Button",
        ]);
        expect(recordOf("CalendarMonthPicker")!.props.format).toBe("long");
        expect(root.typeOf(recordOf("CalendarHeader")!)).toBe("CalendarHeader");
      });

  it("the Calendar's Properties: one switch puts the pickers in; their format · visible years edit every shown picker", async () => {
    const { workspace, recordOf, header, mode } = await open(
      "lib:definition:origin-component-calendar",
      false,
    );
    const field = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogCalendarHeaderField elementId={recordOf("Calendar")!.id} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const view = within(field.container);
    const toggle = view.getByRole("switch", { name: "Month and Year Pickers" });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    // No picker fields while the heading shows.
    expect(view.queryByRole("button", { name: /Month Format/ })).toBe(null);
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(mode()).toBe("pickers");
    expect(header()).toEqual([
      "Button",
      "CalendarMonthPicker",
      "CalendarYearPicker",
      "Button",
    ]);
    expect(
      (
        view.getByRole("switch", {
          name: "Month and Year Pickers",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    // RAC's defaults: short month names, 20 years.
    const years = view.getByRole("textbox", { name: "Visible Years" });
    expect((years as HTMLInputElement).value).toBe("20");
    await act(async () => {
      fireEvent.click(view.getByRole("button", { name: /Month Format/ }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("option", { name: "Long" }));
    });
    expect(recordOf("CalendarMonthPicker")!.props.format).toBe("long");
    await act(async () => {
      fireEvent.change(years, { target: { value: "5" } });
      fireEvent.blur(years);
    });
    expect(recordOf("CalendarYearPicker")!.props.visibleYears).toBe(5);
    // Off: the heading is back, the picker fields go.
    await act(async () => {
      fireEvent.click(
        view.getByRole("switch", { name: "Month and Year Pickers" }),
      );
    });
    expect(header()).toEqual(["Button", "CalendarHeading", "Button"]);
    expect(view.queryByRole("textbox", { name: "Visible Years" })).toBe(null);
  });

  // Composition extension: RAC renders the pickers in source order; the builder shows them in the
  // calendar's locale order (year first in ko · ja · zh) — the Canvas and the DOM alike.
  it("the pickers follow the calendar's locale order (ko: year · month, en: month · year) on the Canvas and in the DOM", async () => {
    const { workspace, root, recordOf, switchTo } = await open(
      "lib:definition:origin-component-calendar",
      false,
    );
    switchTo("pickers");
    const setLocale = (locale: string) =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: id("calendar") }],
          props: { locale: { kind: "set", value: locale } },
        }),
      );
    const canvasOrder = () => {
      const month = recordOf("CalendarMonthPicker")!.id;
      const year = recordOf("CalendarYearPicker")!.id;
      const boxes = root.getGeometry([month, year]);
      return boxes.get(year)!.x < boxes.get(month)!.x
        ? "year-month"
        : "month-year";
    };
    const domOrder = () => {
      const host = document.body.appendChild(document.createElement("div"));
      const react = createRoot(host);
      reactAct(() =>
        react.render(
          renderCatalogDom(
            root,
            recordOf("Calendar")!.id,
          ) as React.ReactElement,
        ),
      );
      const header = host.querySelector(
        `[data-catalog-id="${recordOf("CalendarHeader")!.id}"]`,
      )!;
      const ids = [...header.querySelectorAll("[data-catalog-id]")]
        .map((element) => element.getAttribute("data-catalog-id"))
        .filter(
          (value): value is string =>
            value === recordOf("CalendarMonthPicker")!.id ||
            value === recordOf("CalendarYearPicker")!.id ||
            [...root.domInputs.values()].some(
              (record) =>
                record.id === value &&
                (root.typeOf(root.domInputs.get(record.parentId)!) ===
                  "CalendarMonthPicker" ||
                  root.typeOf(root.domInputs.get(record.parentId)!) ===
                    "CalendarYearPicker"),
            ),
        )
        .map((value) => {
          const record = root.domInputs.get(value)!;
          const type = root.typeOf(record);
          return type.endsWith("Picker")
            ? type
            : root.typeOf(root.domInputs.get(record.parentId)!);
        });
      reactAct(() => react.unmount());
      host.remove();
      return ids[0] === "CalendarYearPicker" ? "year-month" : "month-year";
    };

    setLocale("en-US");
    expect(canvasOrder()).toBe("month-year");
    expect(domOrder()).toBe("month-year");
    // A locale edit re-orders them (the calendar's dependents), the document order stays.
    setLocale("ko-KR");
    expect(canvasOrder()).toBe("year-month");
    expect(domOrder()).toBe("year-month");
    setLocale("ja-JP");
    expect(canvasOrder()).toBe("year-month");
    setLocale("de-DE");
    expect(canvasOrder()).toBe("month-year");
    expect(domOrder()).toBe("month-year");
  });

  // 사용자 2026-10-13 「M size 라면 30 이 맞지 않나」: the reference's picker is `<Select {...props}>`
  // — a Select at its default size, on the Canvas and in the DOM alike (the calendar's nav-button
  // sheet does not reach it). The calendar has no size (2026-10-13 — RAC · S2 take none).
  it("the pickers' Selects are M Selects — the Select's box on the Canvas, its data-size in the DOM", async () => {
    const { workspace, root, switchTo, recordOf } = await open(
      "lib:definition:origin-component-calendar",
      false,
    );
    switchTo("pickers");
    const selects = () =>
      [...root.canvasInputs.values()].filter(
        (record) =>
          root.typeOf(record) === "Select" &&
          !record.hidden &&
          root
            .typeOf(root.canvasInputs.get(record.parentId)!)
            .endsWith("Picker"),
      );
    const standalone = async (size: string) => {
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            {
              ...node(
                `select-${size}`,
                "lib:definition:origin-component-select",
              ),
              props: { size: { kind: "set", value: size } },
            } as NodeEntry,
          ],
          rootIds: [id(`select-${size}`)],
          newId: workspace.newId,
        }),
      );
      const record = [...root.canvasInputs.values()].find(
        (r) => r.sourceId === id(`select-${size}`),
      )!;
      return triggerHeight(record);
    };
    // (The trigger — a standalone Select's box also holds its Label.)
    const triggerHeight = (select: { children: readonly string[] }) => {
      const trigger = select.children.find(
        (child) => root.typeOf(root.canvasInputs.get(child)!) === "Button",
      )!;
      return root.getGeometry([trigger]).get(trigger)!.height;
    };
    const heights = () => selects().map(triggerHeight);
    const domSizes = () => {
      const host = document.body.appendChild(document.createElement("div"));
      const view = createRoot(host);
      reactAct(() =>
        view.render(
          renderCatalogDom(
            root,
            recordOf("Calendar")!.id,
          ) as React.ReactElement,
        ),
      );
      const sizes = [...host.querySelectorAll(".react-aria-Select")].map((e) =>
        e.getAttribute("data-size"),
      );
      reactAct(() => view.unmount());
      host.remove();
      return sizes;
    };
    expect(selects()).toHaveLength(2);
    expect(selects().map((r) => r.props.size)).toEqual(["M", "M"]);
    expect(heights()).toEqual(Array(2).fill(await standalone("M")));
    expect(domSizes()).toEqual(["M", "M"]);
  });

  // 사용자 2026-10-13 「month and year pickers 의 width 를 RAC 레퍼런스 방식에 맞춰」: the reference
  // (Calendar.md 「Month and year pickers」 — `header style={{display: 'flex', gap: 4}}`, starter
  // `Button.css` `flex-shrink: 0`, `Select.css` the trigger `width: 100%; min-width: 0` with an
  // ellipsized value): the nav Buttons keep their width and the two Selects share the rest equally.
  it("the pickers share the header's width equally; the nav Buttons keep theirs (gap 4)", async () => {
    const { root, switchTo, recordOf } = await open(
      "lib:definition:origin-component-calendar",
      false,
    );
    switchTo("pickers");
    const header = recordOf("CalendarHeader")!;
    const box = (rid: string) => root.getGeometry([rid]).get(rid)!;
    const parts = () => {
      const out: Array<{ type: string; x: number; width: number }> = [];
      for (const child of header.children) {
        const record = root.canvasInputs.get(child)!;
        if (record.hidden) continue;
        const type = root.typeOf(record);
        const item = type.endsWith("Picker") ? record.children[0]! : child;
        const geometry = box(item);
        // (A picker draws no box: its Select sits in the header's flow at the picker's place.)
        const x = type.endsWith("Picker")
          ? box(child).x + geometry.x
          : geometry.x;
        out.push({
          type: root.typeOf(root.canvasInputs.get(item)!),
          x,
          width: geometry.width,
        });
      }
      return out;
    };
    const row = parts();
    const width = box(header.id).width;
    expect(row.map((p) => p.type)).toEqual([
      "Button",
      "Select",
      "Select",
      "Button",
    ]);
    // (The nav Buttons are squares — their height, 2026-10-13.)
    const nav = 30;
    const select = (width - 2 * nav - 3 * 4) / 2;
    const round = (v: number) => Math.round(v * 10) / 10;
    expect(row.map((p) => round(p.width))).toEqual(
      [nav, select, select, nav].map(round),
    );
    expect(row.map((p) => round(p.x))).toEqual(
      [0, nav + 4, nav + 8 + select, nav + 12 + 2 * select].map(round),
    );
  });

  // 사용자 2026-10-13 「달력 안 select trigger left padding 을 8 로」: a Select's trigger ends `y` in
  // (the Button's paddingY — M 4), and the calendar's picker trigger starts `2y` in (8); a Select
  // elsewhere keeps the Button's start (12).
  it("a picker's trigger is padded y · y · y · 2y in the calendar; a Select elsewhere keeps the Button's start", async () => {
    const { workspace, root, switchTo } = await open(
      "lib:definition:origin-component-calendar",
      false,
    );
    switchTo("pickers");
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("select", "lib:definition:origin-component-select")],
        rootIds: [id("select")],
        newId: workspace.newId,
      }),
    );
    const sides = (v: Record<string, unknown>) => [
      v.paddingTop ?? v.paddingY,
      v.paddingRight ?? v.paddingX,
      v.paddingBottom ?? v.paddingY,
      v.paddingLeft ?? v.paddingX,
    ];
    const triggers = () =>
      [...root.canvasInputs.values()].filter((record) => {
        const select = root.canvasInputs.get(record.parentId);
        return (
          root.typeOf(record) === "Button" &&
          !!select &&
          root.typeOf(select) === "Select"
        );
      });
    const inPicker = (record: { parentId: string }) =>
      root
        .typeOf(
          root.canvasInputs.get(
            root.canvasInputs.get(record.parentId)!.parentId,
          )!,
        )
        .endsWith("Picker");
    // (ADR-295 Phase 3: the trigger's block padding is the Button's S2 centring padding — M 6; its
    //   start inset stays the 8 the user set.)
    const y = 6;
    expect(
      triggers()
        .filter(inPicker)
        .map((t) => sides(t.visual)),
    ).toEqual([
      [y, 4, y, 8],
      [y, 4, y, 8],
    ]);
    expect(
      triggers()
        .filter((t) => !inPicker(t))
        .map((t) => sides(t.visual)),
    ).toEqual([[y, 4, y, 12]]);
  });
});
