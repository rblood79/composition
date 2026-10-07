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
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { editContractFixture } from "./support/editContractFixture";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A date component's locale and calendar system (react-aria.adobe.com Calendar "International
 * calendars"): one value on the component root — the Canvas header title, the Canvas grid and the
 * DOM (RAC Calendar in its `I18nProvider`) read it; unset = the environment's locale. Before, the
 * template bound a fixed `ko-KR` to the Canvas grid only, so the grid, the header and the Preview
 * showed three formats.
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
        projectId: "project:project:date-locale" as EntryId<"project">,
        name: "Date locale",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `date-locale-${Math.random()}`),
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

describe("date locale — one value on the component, read by the Canvas and the DOM", () => {
  it("Calendar: header title, grid and DOM follow the Calendar's locale and calendar system", async () => {
    const { part, html, write } = await place("calendar");
    const canvas = () => ({
      title: part("CalendarHeader").derivedProps?.children,
      grid: {
        locale: part("CalendarGrid").derivedProps?.locale,
        calendarSystem: part("CalendarGrid").derivedProps?.calendarSystem,
      },
    });
    // The parts hold no locale of their own (the template bound a fixed `ko-KR` to them).
    for (const name of ["CalendarHeader", "CalendarGrid"])
      expect(part(name).props.locale).toBeUndefined();
    // Unset: the environment's locale on both sides.
    expect(canvas().grid).toEqual({ locale: "en-US", calendarSystem: "" });
    expect(text(html())).toContain(String(canvas().title));
    write({ locale: "ko-KR" });
    expect(canvas().grid).toEqual({ locale: "ko-KR", calendarSystem: "" });
    expect(canvas().title).toMatch(/년/);
    expect(text(html())).toContain(String(canvas().title));
    // (RAC's weekday header in the Calendar's locale.)
    expect(html()).toMatch(/>일</);
    write({ calendarSystem: "buddhist" });
    expect(canvas().grid).toEqual({
      locale: "ko-KR",
      calendarSystem: "buddhist",
    });
    expect(canvas().title).toMatch(/불기/);
    expect(text(html())).toContain(String(canvas().title));
  });

  it("DateField: its locale reaches the Canvas segments and the DOM alike", async () => {
    const { root, part, html, write } = await place("datefield");
    const segments = () => {
      const id = part("DateInput").id;
      root.getGeometry([id]);
      return (root.dateSegmentPaint(id)?.runs ?? [])
        .map((run) => run.text)
        .join("");
    };
    const dom = () =>
      text(
        /<div[^>]*class="react-aria-DateInput"[^>]*>.*?<\/div><\/div>|<div[^>]*class="react-aria-DateInput"[^>]*>.*?<\/div>/.exec(
          html(),
        )?.[0] ?? "",
      ).replace(/[⁦-⁩]/g, "");
    expect(dom()).toContain(segments());
    write({ locale: "de-DE" });
    expect(segments()).not.toBe("mm/dd/yyyy");
    expect({ dom: dom(), canvas: segments() }).toEqual({
      dom: segments(),
      canvas: segments(),
    });
  });

  it("the Properties panel offers the locale and the calendar system as choices", () => {
    for (const type of [
      "Calendar",
      "RangeCalendar",
      "DateField",
      "DatePicker",
      "DateRangePicker",
    ]) {
      const fields = editContractFixture(type).fields;
      const locale = fields.find((field) => field.key === "locale")!;
      const system = fields.find((field) => field.key === "calendarSystem")!;
      expect(locale.options?.map((option) => option.value)).toContain("ko-KR");
      expect(locale.options?.[0]?.value).toBe("");
      expect(system.options?.map((option) => option.value)).toContain(
        "buddhist",
      );
    }
    expect(
      editContractFixture("TimeField").fields.some(
        (field) => field.key === "locale",
      ),
    ).toBe(true);
  });
});
