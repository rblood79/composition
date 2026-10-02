import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogLeafRecords,
  catalogSlotMarks,
} from "../../workspace/canvas/catalog/catalogChrome";
import { CatalogCanvasScene } from "../canvasScene";
import { catalogComponentRole } from "../componentActions";
import { catalogDefinitionList, catalogNewLayoutCommand } from "../layouts";
import { catalogPageCommands, catalogPageContentTarget } from "../pageSettings";
import {
  catalogPaletteDefinitionId,
  catalogPaletteInsertCommand,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e-8 Canvas chrome: the editing role colors (an instance of a component, the origin the
 * definition view shows), the group hover's leaves, and the slot marks — every declared slot in
 * the definition view, an empty one on the pages.
 */
const BODY = "project:node:home-body" as NodeId;
const node = (
  id: string,
  definitionId: string,
  children: string[] = [],
): NodeEntry => ({
  kind: "node",
  id: id as NodeId,
  definitionId: definitionId as NodeEntry["definitionId"],
  children: children as NodeId[],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:chrome" as EntryId<"project">,
        name: "Chrome",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e8-chrome-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  return workspace;
}

describe("ADR-248 4e-8 Canvas chrome", () => {
  it("roles: a component instance, none for a primitive, the origin in the definition view", async () => {
    const workspace = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node(
            "project:node:btn",
            catalogPaletteDefinitionId(
              workspace.runtime.graph.library,
              "Button",
            ),
          ),
          node("project:node:txt", "lib:definition:text"),
        ],
        rootIds: ["project:node:btn", "project:node:txt"] as NodeId[],
        newId: workspace.newId,
      }),
    );
    const graph = workspace.runtime.graph;
    expect(catalogComponentRole(graph, "project:node:btn" as NodeId)).toBe(
      "instance",
    );
    expect(
      catalogComponentRole(graph, "project:node:txt" as NodeId),
    ).toBeUndefined();
    workspace.execute(catalogNewLayoutCommand("Shell", workspace.newId));
    const [layout] = catalogDefinitionList(graph, "layout");
    const root = (graph.getEntry(layout!.id) as { templateRootId: NodeId })
      .templateRootId;
    // A layout is not a component: its root is no origin.
    expect(catalogComponentRole(graph, root, layout!.id)).toBeUndefined();
  });

  it("group hover leaves: the leaf records under a record; a leaf is its own", () => {
    const records = new Map([
      ["a", { children: ["b", "c"] }],
      ["b", { children: ["d", "e"] }],
      ["c", { children: [] }],
      ["d", { children: [] }],
      ["e", { children: [] }],
    ]);
    expect(catalogLeafRecords(records, "a")).toEqual(["d", "e", "c"]);
    expect(catalogLeafRecords(records, "c")).toEqual(["c"]);
  });

  it("slot marks: the empty slot of a layout on a page (instance color), gone once it holds content; the definition view marks every slot (origin)", async () => {
    const workspace = await open();
    workspace.execute(catalogNewLayoutCommand("Shell", workspace.newId));
    const graph = workspace.runtime.graph;
    const [layout] = catalogDefinitionList(graph, "layout");
    const pageId = workspace.session.getSnapshot().pageId!;
    workspace.execute(
      catalogPageCommands.layout(pageId, layout!.id, workspace.newId),
    );
    const scene = new CatalogCanvasScene(workspace.root);
    const marks = () => {
      scene.sync();
      return catalogSlotMarks(
        workspace,
        scene.stream.boundsMap,
        scene.stream.hitBoundsMap,
      );
    };
    expect(marks()).toEqual([
      expect.objectContaining({ empty: true, role: "instance" }),
    ]);
    // Page content in the slot: no mark.
    workspace.execute(
      catalogPaletteInsertCommand(
        {
          graph,
          records: workspace.root.domInputs,
          selection: () => [],
          itemOfRecord: (identity) => workspace.itemOfRecord(identity),
          pageContent: () => catalogPageContentTarget(graph, BODY),
          newId: workspace.newId,
        },
        "Button",
      )!,
    );
    expect(marks()).toEqual([]);
    workspace.showDefinition(layout!.id as never);
    const viewScene = new CatalogCanvasScene(workspace.root);
    viewScene.sync();
    expect(
      catalogSlotMarks(
        workspace,
        viewScene.stream.boundsMap,
        viewScene.stream.hitBoundsMap,
      ),
    ).toEqual([expect.objectContaining({ empty: true, role: "origin" })]);
  });
});
