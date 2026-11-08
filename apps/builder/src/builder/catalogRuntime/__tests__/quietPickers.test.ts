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
import { renderCatalogDom } from "../domBinding";
import { catalogCanvasNodeData, catalogQuietOwnerPaint } from "../canvasBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * RSP `isQuiet` on a Select: its box is not an Input / DateInput part but its trigger Button, which
 * the Select rule styles when quiet (`quiet.true.nested`). The DOM root carries `data-quiet`
 * (before: never — the prop did not reach the Select), and the Canvas draws the quiet trigger with
 * no fill or box border. `71922bd0f` (S2 Picker): the trigger is painted from the Button rule's
 * picker tree (`pickerNodeData`), not `catalogQuietStyles` (`_pickerTrigger` is excluded there), and
 * the quiet underline shows only on keyboard focus — none at rest. A DateRangePicker takes no
 * `isQuiet` (S2 has none — 2026-10-07).
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
      renderCatalogDom(root, root.recordsOfSource(FIELD)[0]!),
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
    const { box, html, setQuiet, root } = await place("select");
    const paint = () =>
      catalogQuietOwnerPaint(box("Button"), { width: 200, height: 32 });
    const trigger = () => catalogCanvasNodeData(root, box("Button").id).box!;
    const alpha = () => Array.from(trigger().fillColor ?? [])[3];
    expect(paint()).toBeUndefined();
    expect(alpha()).toBe(1);
    expect(html()).not.toMatch(/data-quiet/);
    setQuiet(true);
    expect(rootQuiet(html(), "react-aria-Select")).toBe(true);
    // The trigger leaves the filled Button paint (`.button-base`, a later layer than the field
    // sheet) off while quiet: the Select sheet's quiet box is what shows.
    const button = /<button[^>]*>/.exec(html())![0];
    expect(button).toContain('data-quiet="true"');
    expect(button).not.toContain("button-base");
    // The Canvas trigger: no fill, no box border, no resting underline (no quiet owner paint).
    expect(paint()).toBeUndefined();
    expect(alpha()).toBe(0);
    expect(trigger().strokeWidth ?? 0).toBe(0);
    setQuiet(false);
    expect(paint()).toBeUndefined();
    expect(alpha()).toBe(1);
    expect(html()).not.toMatch(/data-quiet/);
  });

  it("DateRangePicker takes no isQuiet (S2 has none): the prop is not on its edit contract", async () => {
    const { setQuiet } = await place("daterangepicker");
    expect(() => setQuiet(true)).toThrow();
  });
});
