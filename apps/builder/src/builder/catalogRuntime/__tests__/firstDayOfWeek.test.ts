import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogCalendarGridSize } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { editContractFixture } from "./support/editContractFixture";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 `firstDayOfWeek` (Calendar · RangeCalendar · DatePicker · DateRangePicker — RAC passes it to
 * the CalendarGrid; a picker's to its calendar through RAC's calendar context): the week's first
 * column. Unset = the locale's own first day (RAC `useCalendarGrid` — en-US Sunday, de-DE Monday).
 * The Canvas grid reads the same first day (the calendar model — `_calendarGrid`) for its weekday
 * header, its day columns and its rows.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const measure: CatalogTextMeasure = (value, font) => ({
  width: value.length * font.fontSize * 0.5,
  exactWidth: value.length * font.fontSize * 0.5,
  minWidth: value.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function place(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:first-day-of-week" as EntryId<"project">,
        name: "Date locale",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `first-day-of-week-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      locale: "en-US",
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId:
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const part = (typeName: string) =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === typeName,
    )!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
    );
  const write = (props: Record<string, string>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
  return { root, part, html, write };
}

const text = (markup: string) => markup.replace(/<[^>]*>/g, "");
/** The DOM weekday header (RAC `CalendarGridHeader` cells). */
const weekdays = (markup: string) =>
  [...markup.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((match) => text(match[1]!));

describe("S2 firstDayOfWeek", () => {
  it("the Design panel offers it on the calendars and the pickers — unset = the locale's", () => {
    for (const type of [
      "Calendar",
      "RangeCalendar",
      "DatePicker",
      "DateRangePicker",
    ]) {
      const field = editContractFixture(type).fields.find(
        (candidate) => candidate.key === "firstDayOfWeek",
      );
      expect(
        field?.options?.map((option) => option.value),
        type,
      ).toEqual(["", "sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
    }
  });

  it("Calendar: the DOM header and the Canvas grid start the week on the same day", async () => {
    for (const type of ["calendar", "rangecalendar"]) {
      const { root, part, html, write } = await place(type);
      // The Canvas grid's model (ADR-256 Phase 9 — `calendarModel.ts`).
      const model = () =>
        JSON.parse(String(part("CalendarGrid").derivedProps?._calendarGrid)) as {
          weekdays: string[];
          rows: string[][];
        };
      // The Canvas weekday row is the DOM's, and the grid takes the model's rows (a month can take
      // 5 or 6 rows).
      const follows = () => {
        expect(model().weekdays).toEqual(weekdays(html()));
        const grid = part("CalendarGrid");
        expect(root.getGeometry([grid.id]).get(grid.id)?.height).toBe(
          catalogCalendarGridSize("M", 7, model().rows.length)!.height,
        );
      };
      // Unset, en-US: Sunday.
      expect(weekdays(html()).slice(0, 2)).toEqual(["S", "M"]);
      follows();
      write({ firstDayOfWeek: "wed" });
      expect(weekdays(html())[0]).toBe("W");
      follows();
      write({ firstDayOfWeek: "mon" });
      expect(weekdays(html()).slice(0, 2)).toEqual(["M", "T"]);
      // Every first day: the rows the grid takes (some days give the month another row).
      for (const day of ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]) {
        write({ firstDayOfWeek: day });
        follows();
      }
      // Unset again, de-DE: the locale's Monday.
      write({ firstDayOfWeek: "", locale: "de-DE" });
      expect(weekdays(html())[0]).toBe("M");
      follows();
    }
  });

  it("DatePicker: its calendar's Canvas grid follows the picker's first day", async () => {
    const { part, write } = await place("datepicker");
    const first = () =>
      (
        JSON.parse(String(part("CalendarGrid").derivedProps?._calendarGrid)) as {
          weekdays: string[];
        }
      ).weekdays[0];
    expect(first()).toBe("S");
    write({ firstDayOfWeek: "fri" });
    expect(first()).toBe("F");
  });
});
