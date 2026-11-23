import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setDataEntries } from "../../../../../../packages/shared/src/catalog/commands/data";
import { catalogBindingRef } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogBuilderBoundRows } from "../catalogDataRead";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogCanvasNodeData } from "../canvasBinding";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import {
  catalogColumnEditableCommand,
  catalogColumnEditableOn,
} from "../tableEditableCell";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 체크리스트 §9.3 (6-6) — a Column's 「Editable」 on a Table placed from the palette (the Table
 * origin's instance — its header and body are its template's places, the binding the instance's)
 * and the Builder's Canvas with its rows: each data row draws its value and the edit button's box,
 * never the editing Form. A Table not bound to data has no switch (no row to write).
 */
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;
const COLLECTION = "data:collection:users" as DataBindingRef["collectionId"];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function open(bind: boolean) {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:editable" as EntryId<"project">,
      name: "Editable",
    }),
    library,
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `s2-editable-cell-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rowSample: true,
        rows: (binding, kind, ownerId, _instancePath, slices) =>
          catalogBuilderBoundRows(graph, binding, kind, ownerId, slices),
      },
    },
  );
  workspace.execute(
    setDataEntries({
      puts: [
        {
          kind: "collection",
          id: COLLECTION,
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-type", key: "type", type: "string" },
            { id: "f-status", key: "status", type: "number" },
          ],
          mockData: [
            { id: "p1", name: "Bora", type: "B", status: 2 },
            { id: "p2", name: "Chan", type: "A", status: 1 },
          ],
          useMockData: true,
        } as never,
      ],
    }),
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: TABLE,
          definitionId: catalogPaletteDefinitionId(library, "Table"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [TABLE],
      newId: workspace.newId,
    }),
  );
  if (bind)
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: TABLE }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );
  await settle();
  const typeOf = (record: { definitionId: string }) =>
    workspace.root.typeOf(record as never);
  const records = () => [...workspace.root.canvasInputs.values()];
  /** The first data Column (`name` once bound — the starter's first otherwise). */
  const column = () => {
    const record = records().find(
      (each) =>
        typeOf(each) === "Column" &&
        (each.props.key === "name" || !bind) &&
        !each.children.some((child) => {
          const part = workspace.root.canvasInputs.get(child);
          return part && part.props.slot === "selection";
        }),
    )!;
    return workspace.positionOfRecord(record.id)!.target as never;
  };
  return { workspace, typeOf, records, column };
}

describe("S2 §9.3 EditableCell — a palette Table on the Builder's Canvas", () => {
  it("switches a bound palette Table's Column; the Canvas draws each row's value and the button's box, not the Form", async () => {
    const t = await open(true);
    const graph = t.workspace.runtime.graph;
    // (The header is the Table origin's template place; the binding is its instance's.)
    expect(catalogColumnEditableOn(graph, t.column())).toBe(false);
    t.workspace.execute(
      catalogColumnEditableCommand(graph, t.column(), true, t.workspace.newId, {
        edit: (label) => `Edit ${label}`,
      }),
    );
    await settle();
    expect(catalogColumnEditableOn(t.workspace.runtime.graph, t.column())).toBe(
      true,
    );
    const rows = t
      .records()
      .filter(
        (record) => record.rowIndex !== undefined && t.typeOf(record) === "Row",
      );
    expect(rows).toHaveLength(2);
    const texts = t
      .records()
      .filter((record) => t.typeOf(record) === "Text")
      .map((record) => record.props.children);
    expect(texts).toEqual(expect.arrayContaining(["Bora", "Chan"]));
    const root = t.workspace.root;
    const forms = t.records().filter((record) => t.typeOf(record) === "Form");
    expect(forms.length).toBeGreaterThanOrEqual(2);
    expect(
      forms.every(
        (form) =>
          !root.getGeometry([form.id]).get(form.id) ||
          catalogCanvasNodeData(root, form.id).visible === false,
      ),
    ).toBe(true);
    const buttons = t
      .records()
      .filter(
        (record) =>
          t.typeOf(record) === "ActionButton" && record.props.slot === "edit",
      );
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const button of buttons) {
      expect(catalogCanvasNodeData(root, button.id).visible).toBe(false);
      expect(
        root.getGeometry([button.id]).get(button.id)!.width,
      ).toBeGreaterThan(0);
    }
  }, 120_000);

  it("has no switch on a Table not bound to data", async () => {
    const t = await open(false);
    expect(
      catalogColumnEditableOn(t.workspace.runtime.graph, t.column()),
    ).toBeUndefined();
  }, 120_000);
});
