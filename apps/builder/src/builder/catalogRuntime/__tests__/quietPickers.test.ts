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
import { catalogQuietStyles } from "../../../../../../packages/shared/src/catalog/runtime/quietStyles";
import { renderCatalogDom } from "../domBinding";
import { catalogQuietOwnerPaint } from "../canvasBinding";
import { cssVarColor } from "../../../../../../packages/shared/src/catalog/runtime/rulePaint";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * RSP `isQuiet` on a Select and a DateRangePicker: their box is not an Input / DateInput part but
 * one their own rule styles when quiet (`quiet.true.nested` — the Select's trigger Button, the range
 * picker's Group). The DOM root carries `data-quiet` (before: never — the prop did not reach the
 * Select, and the range picker's component cleared the attribute), and the Canvas draws the same
 * declarations on that box: no fill or box border, square corners, an underline.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function place(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:quiet-pickers" as EntryId<"project">,
        name: "Quiet pickers",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `quiet-pickers-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
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
  const field = () =>
    [...root.canvasInputs.values()].find(
      (record) =>
        record.sourceId === FIELD &&
        root.typeOf(record) !== "Label" &&
        record.parentId &&
        root.canvasInputs.get(record.parentId)?.sourceId === BODY,
    )!;
  const box = (type: string) =>
    field()
      .children.map((id) => root.canvasInputs.get(id)!)
      .find((child) => root.typeOf(child) === type)!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!, {
        today: () => undefined,
      }),
    );
  const setQuiet = (value: boolean) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: { isQuiet: set(value) },
      }),
    );
  return { workspace, root, box, html, setQuiet };
}

/** The field root element (by its class) carries `data-quiet="true"`. */
const rootQuiet = (html: string, className: string) =>
  new RegExp(`<div[^>]*class="${className}"[^>]*>`)
    .exec(html)?.[0]
    .includes('data-quiet="true"') === true;

describe("quiet Select · DateRangePicker", () => {
  it("Select: the root carries data-quiet and the Canvas trigger draws the quiet box", async () => {
    const { box, html, setQuiet } = await place("select");
    const paint = () =>
      catalogQuietOwnerPaint(box("Button"), { width: 200, height: 32 });
    expect(paint()).toBeUndefined();
    expect(html()).not.toMatch(/data-quiet/);
    setQuiet(true);
    expect(rootQuiet(html(), "react-aria-Select")).toBe(true);
    // The trigger leaves the filled Button paint (`.button-base`, a later layer than the field
    // sheet) off while quiet: the Select sheet's quiet box is what shows.
    const trigger = /<button[^>]*>/.exec(html())![0];
    expect(trigger).toContain('data-quiet="true"');
    expect(trigger).not.toContain("button-base");
    expect(paint()).toEqual({
      visual: expect.objectContaining({
        fill: "transparent",
        borderWidth: 0,
        radius: 0,
      }),
      underline: {
        y: 31,
        height: 1,
        color: cssVarColor("var(--border)", "light"),
      },
    });
    expect(paint()!.visual).not.toHaveProperty("borderColor");
    setQuiet(false);
    expect(paint()).toBeUndefined();
    expect(html()).not.toMatch(/data-quiet/);
  });

  it("DateRangePicker: the root carries data-quiet and the Group takes the field rule's quiet box", async () => {
    const { box, html, setQuiet } = await place("daterangepicker");
    const quiet = () => {
      const group = box("SelectTrigger");
      return catalogQuietStyles(undefined, {
        ...group.props,
        ...group.derivedProps,
      });
    };
    expect(quiet()).toBeUndefined();
    setQuiet(true);
    expect(
      /<div[^>]*class="react-aria-DateRangePicker"[^>]*data-quiet="true"|<div[^>]*data-quiet="true"[^>]*class="react-aria-DateRangePicker"/.test(
        html(),
      ),
    ).toBe(true);
    expect(quiet()).toMatchObject({
      background: "transparent",
      "border-radius": "0",
      "border-bottom": "1px solid var(--border)",
    });
    setQuiet(false);
    expect(quiet()).toBeUndefined();
  });
});
