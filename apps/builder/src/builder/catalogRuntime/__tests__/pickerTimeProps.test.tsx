import "fake-indexeddb/auto";
import { fireEvent, render } from "@testing-library/react";
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
 * S2 DatePicker `hourCycle` and DatePicker · DateRangePicker `placeholderValue` (RAC props — the
 * DateField already takes both). `hourCycle` draws the time segments (12 → the day period) on
 * both sides; `placeholderValue` is the date the empty picker's calendar opens on (no Canvas
 * paint — the closed calendar is not drawn).
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });
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
        projectId: "project:project:picker-time-props" as EntryId<"project">,
        name: "Date locale",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `picker-time-props-${Math.random()}`),
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

describe("S2 picker hourCycle · placeholderValue", () => {
  it("the Design panel offers them", () => {
    for (const [type, keys] of [
      ["DatePicker", ["hourCycle", "placeholderValue"]],
      ["DateRangePicker", ["hourCycle", "placeholderValue"]],
    ] as const) {
      const fields = editContractFixture(type).fields.map((field) => field.key);
      for (const key of keys) expect(fields, `${type}.${key}`).toContain(key);
    }
  });

  it("DatePicker hourCycle: the Canvas segments and the DOM drop the day period at 24", async () => {
    const { root, part, html, write } = await place("datepicker");
    const segments = () => {
      const id = part("DateInput").id;
      root.getGeometry([id]);
      return (root.dateSegmentPaint(id)?.runs ?? [])
        .map((run) => run.text)
        .join("");
    };
    write({ granularity: "minute", hourCycle: "12" });
    expect(segments()).toMatch(/AM|PM/);
    expect(text(html())).toMatch(/AM|PM/);
    write({ hourCycle: "24" });
    expect(segments()).not.toMatch(/AM|PM/);
    expect(text(html())).not.toMatch(/AM|PM/);
  });

  for (const type of ["datepicker", "daterangepicker"])
    it(`${type} placeholderValue: the empty picker's calendar opens on that month`, async () => {
      const { root, write } = await place(type);
      write({ placeholderValue: "2030-03-15" });
      const view = render(
        renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
      );
      fireEvent.click(view.getAllByRole("button")[0]!);
      const heading = document.querySelector(
        ".react-aria-Popover .react-aria-CalendarHeading",
      );
      expect(heading?.textContent).toBe("March 2030");
      view.unmount();
    });

  // RAC throws on a date-only placeholder at a time granularity (`Invalid granularity minute for
  // value 2030-03-15`) — the Preview went blank. The placeholder takes the granularity's time.
  for (const type of ["datefield", "datepicker", "daterangepicker"])
    it(`${type}: a date-only placeholderValue at a time granularity still renders`, async () => {
      const { root, write } = await place(type);
      write({ granularity: "minute", placeholderValue: "2030-03-15" });
      const view = render(
        renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
      );
      expect(
        view.container.querySelector(".react-aria-DateInput"),
      ).not.toBeNull();
      view.unmount();
    });
});
