import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  deleteLayout,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogComponentCommands } from "../componentActions";
import {
  catalogDefinitionList,
  catalogNewLayoutCommand,
  catalogNextLayoutName,
} from "../layouts";
import { catalogPageCommands, catalogPageLayoutId } from "../pageSettings";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e Navigator layouts: a new layout is a body with one content slot; applied to a page it
 * holds the page's content; the layout edit view's edits reach the page; deleting it gives the
 * content back.
 */
const BODY = "project:node:home-body" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:layouts" as EntryId<"project">,
        name: "Layouts",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e-layouts-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  const pageId = (
    project?.kind === "project" ? project.pageIds[0] : ""
  ) as EntryId<"page">;
  return { workspace, graph, pageId };
}

const heading = (id: string, text: string): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeId,
  definitionId: "lib:definition:heading",
  children: [],
  props: { children: { kind: "set", value: text } },
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

describe("ADR-248 4e Navigator layouts", () => {
  it("a new layout (body + content slot) applies to a page, its edits reach the page, delete gives the content back", async () => {
    const { workspace, graph, pageId } = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [heading("hello", "Page content")],
        rootIds: ["project:node:hello" as NodeId],
        newId: workspace.newId,
      }),
    );
    expect(catalogNextLayoutName(graph, "Layout")).toBe("Layout");
    workspace.execute(catalogNewLayoutCommand("Layout", workspace.newId));
    expect(catalogNextLayoutName(graph, "Layout")).toBe("Layout 2");
    const [layout] = catalogDefinitionList(graph);
    expect(layout).toMatchObject({ name: "Layout", usage: "layout" });

    workspace.execute(
      catalogPageCommands.layout(pageId, layout.id, workspace.newId),
    );
    expect(catalogPageLayoutId(graph, pageId)).toBe(layout.id);
    const texts = () =>
      [...workspace.root.domInputs.values()]
        .map((record) => record.props.children)
        .filter((text): text is string => typeof text === "string");
    expect(texts()).toContain("Page content");

    // The layout edit view: a heading above the slot reaches the page.
    workspace.showDefinition(layout.id);
    const definition = graph.getEntry(layout.id);
    const root =
      definition?.kind === "definition" ? definition.templateRootId! : BODY;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: root },
        entries: [heading("banner", "Site banner")],
        rootIds: ["project:node:banner" as NodeId],
        index: 0,
        newId: workspace.newId,
      }),
    );
    workspace.showDefinition(undefined);
    expect(texts()).toEqual(
      expect.arrayContaining(["Site banner", "Page content"]),
    );

    workspace.execute(deleteLayout({ definitionId: layout.id }));
    expect(catalogDefinitionList(graph)).toEqual([]);
    expect(catalogPageLayoutId(graph, pageId)).toBeUndefined();
    expect(texts()).toContain("Page content");
    expect(texts()).not.toContain("Site banner");
    workspace.dispose();
  });

  it("lists layouts before components", async () => {
    const { workspace, graph } = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [heading("title", "T")],
        rootIds: ["project:node:title" as NodeId],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      catalogComponentCommands.create(
        "project:node:title" as NodeId,
        "Title",
        workspace.newId,
      ),
    );
    workspace.execute(catalogNewLayoutCommand("Shell", workspace.newId));
    expect(
      catalogDefinitionList(graph).map((item) => [item.name, item.usage]),
    ).toEqual([
      ["Shell", "layout"],
      ["Title", "component"],
    ]);
    workspace.dispose();
  });
});
