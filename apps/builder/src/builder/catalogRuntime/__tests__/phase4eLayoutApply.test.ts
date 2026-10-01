import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  PageEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogCanvasMenuItems } from "../canvasMenu";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { catalogLayoutPresetCommand } from "../layoutPreset";
import { catalogDefinitionList, catalogNewLayoutCommand } from "../layouts";
import { catalogPageCommands, catalogPageContentTarget } from "../pageSettings";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { catalogMenuHost } from "../shortcuts";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e (user 2026-10-01): a layout applied to a page — the layout's slots sit right under
 * the page body (the body itself is the layout's instance, the same node), the page content fills
 * the slot whose role is `content` (not the first slot), Layers shows each slot's role, and an
 * insert or paste without a selection goes to that content slot. Removing gives the body back.
 */
const BODY = "project:node:home-body" as NodeId;
const CONTENT = "project:node:page-content" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:layout-apply" as EntryId<"project">,
        name: "Layout apply",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e-layout-apply-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const frame = (id: NodeId, name: string): NodeEntry => ({
    kind: "node",
    id,
    name,
    definitionId: "lib:definition:type-frame" as NodeEntry["definitionId"],
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [frame(CONTENT, "Page content")],
      rootIds: [CONTENT],
      newId: workspace.newId,
    }),
  );
  // A Holy Grail layout: header · sidebar · content · aside · footer (header first).
  workspace.execute(catalogNewLayoutCommand("Grail", workspace.newId));
  const [layout] = catalogDefinitionList(workspace.runtime.graph, "layout");
  const definition = workspace.runtime.graph.getEntry(layout!.id) as {
    templateRootId: NodeId;
  };
  workspace.execute(
    catalogLayoutPresetCommand(workspace.runtime.graph, {
      rootId: definition.templateRootId,
      presetKey: "holy-grail",
      mode: "replace",
      newId: workspace.newId,
    })!,
  );
  const pageId = workspace.session.getSnapshot().pageId!;
  return { workspace, layoutId: layout!.id, pageId };
}

const graphOf = (workspace: CatalogWorkspace) => workspace.runtime.graph;
const body = (workspace: CatalogWorkspace) =>
  graphOf(workspace).getEntry(BODY) as NodeEntry;
function layers(workspace: CatalogWorkspace, pageId: EntryId<"page">) {
  const store = new CatalogLayerTreeStore(
    {
      readModel: workspace.readModel,
      graph: workspace.runtime.graph,
      subscribeSteps: (listener) => workspace.runtime.subscribeSteps(listener),
    },
    pageId,
  );
  store.setExpanded(new Set(workspace.root.domInputs.keys()));
  const all = (nodes: readonly CatalogLayerNode[]): CatalogLayerNode[] =>
    nodes.flatMap((node) => [node, ...all(node.children ?? [])]);
  return all(store.getSnapshot());
}
/** The content slot's children (the page body instance's fillSlot). */
const filled = (workspace: CatalogWorkspace) => {
  const fill = body(workspace).descendantOverrides.find(
    (item) => item.kind === "fillSlot",
  );
  return fill?.kind === "fillSlot"
    ? {
        slot: (
          graphOf(workspace).getEntry(
            fill.address.templatePath.at(-1)!,
          ) as NodeEntry
        ).slot?.name,
        childIds: fill.childIds,
      }
    : undefined;
};

describe("ADR-248 4e layout applied to a page", () => {
  it("the slots sit under the page body and the content fills the content slot", async () => {
    const { workspace, layoutId, pageId } = await open();
    workspace.execute(
      catalogPageCommands.layout(pageId, layoutId, workspace.newId),
    );
    const page = graphOf(workspace).getEntry(pageId) as PageEntry;
    expect(page.children).toEqual([BODY]);
    expect(body(workspace).definitionId).toBe(layoutId);
    expect(filled(workspace)).toEqual({
      slot: "content",
      childIds: [CONTENT],
    });
    // Layers: Body ▸ the five slots (the preset names them) with their roles ▸ the page content inside "content".
    const rows = layers(workspace, pageId);
    const root = rows.find((row) => row.parentId === null)!;
    expect(root.body).toBe(true);
    expect(root.children!.map((row) => [row.name, row.slot])).toEqual([
      ["Header", "header"],
      ["Sidebar", "sidebar"],
      ["Content", "content"],
      ["Aside", "aside"],
      ["Footer", "footer"],
    ]);
    const content = root.children!.find((row) => row.slot === "content")!;
    expect(content.children!.map((row) => row.name)).toEqual(["Page content"]);
    workspace.dispose();
  });

  it("an insert or a paste without a selection goes to the content slot", async () => {
    const { workspace, layoutId, pageId } = await open();
    workspace.execute(
      catalogPageCommands.layout(pageId, layoutId, workspace.newId),
    );
    expect(catalogPageContentTarget(graphOf(workspace), BODY)).toMatchObject({
      kind: "descendant",
      ownerId: BODY,
    });
    const insert = catalogPaletteInsertCommand(
      {
        graph: graphOf(workspace),
        records: workspace.root.domInputs,
        selection: () => [],
        itemOfRecord: (identity) => workspace.itemOfRecord(identity),
        pageContent: () => catalogPageContentTarget(graphOf(workspace), BODY),
        newId: workspace.newId,
      },
      "Button",
    );
    expect(insert).toBeDefined();
    workspace.execute(insert!);
    expect(filled(workspace)!.childIds).toHaveLength(2);
    // Paste on the page background (the body record).
    const host = catalogMenuHost(workspace);
    host.clipboard.set({
      rootIds: [CONTENT],
      entries: [graphOf(workspace).getEntry(CONTENT) as NodeEntry],
    });
    const bodyRecord = workspace.root.recordsOfSource(BODY)[0];
    const paste = catalogCanvasMenuItems(host, "canvas-empty", bodyRecord).find(
      (item) => item.kind === "action" && item.id === "paste",
    );
    expect(paste?.kind).toBe("action");
    if (paste?.kind === "action") paste.run();
    expect(filled(workspace)!.childIds).toHaveLength(3);
    workspace.dispose();
  });

  it("removing the layout gives the page body its content back", async () => {
    const { workspace, layoutId, pageId } = await open();
    workspace.execute(
      catalogPageCommands.layout(pageId, layoutId, workspace.newId),
    );
    workspace.execute(
      catalogPageCommands.layout(pageId, undefined, workspace.newId),
    );
    expect(body(workspace)).toMatchObject({
      definitionId: "lib:definition:type-body",
      children: [CONTENT],
      descendantOverrides: [],
    });
    const rows = layers(workspace, pageId);
    expect(
      rows
        .find((row) => row.parentId === null)!
        .children!.map((row) => row.name),
    ).toEqual(["Page content"]);
    workspace.dispose();
  });
});
