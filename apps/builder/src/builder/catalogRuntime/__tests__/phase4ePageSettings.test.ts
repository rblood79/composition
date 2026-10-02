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
import {
  createLayout,
  createPage,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogPageCommands,
  catalogPageLayoutId,
  catalogPageLayouts,
  catalogGeneratedRoute,
  catalogPageRouteEdit,
  catalogParentPageOptions,
  catalogSettingsPage,
} from "../pageSettings";
import { catalogComponentCommands } from "../componentActions";
import { newCatalogProjectDocument } from "../project";
import { catalogVariableOwner } from "../stateVariables";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 page section: a page root edits its page — the reusable layout it uses
 * (applied and removed, content kept), its parent page (never itself or a descendant) and its
 * route (refused when malformed or taken) — each one history step.
 */
const PROJECT = "project:project:pages" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  children: NodeId[] = [],
  extra: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:type-frame",
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Pages" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-pages-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const graph = workspace.runtime.graph;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node("hero")],
      rootIds: [id("hero")],
      newId: workspace.newId,
    }),
  );
  const pages = () => {
    const project = graph.getEntry(PROJECT);
    return project?.kind === "project"
      ? project.pageIds.map((pageId) => graph.getEntry(pageId) as PageEntry)
      : [];
  };
  const addPage = (name: string, route: string, parentId?: EntryId<"page">) =>
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: `project:page:${name}` as EntryId<"page">,
          route,
          name,
          children: [],
          ...(parentId ? { parentId } : {}),
        },
      }),
    );
  return { workspace, graph, pages, addPage };
}

describe("ADR-248 Phase 4e-4 page section", () => {
  it("Generate from Title: the parent's route, then the name as a slug (none without Latin letters)", async () => {
    const { workspace, pages, addPage } = await open();
    addPage("docs", "/docs");
    const named = (id: string, name: string, parentId?: string) =>
      workspace.execute(
        createPage({
          page: {
            kind: "page",
            id: `project:page:${id}` as EntryId<"page">,
            route: `/${id}`,
            name,
            children: [],
            ...(parentId ? { parentId: parentId as EntryId<"page"> } : {}),
          },
        }),
      );
    named("start", "Getting Started!", "project:page:docs");
    named("intro", "소개");
    const route = (id: string) =>
      catalogGeneratedRoute(pages(), `project:page:${id}` as EntryId<"page">);
    expect(route("start")).toBe("/docs/getting-started");
    expect(route("docs")).toBe("/docs");
    expect(route("intro")).toBe("");
  });

  it("parent options leave out the page and its descendants; parent and route write the page", async () => {
    const { workspace, graph, pages, addPage } = await open();
    addPage("docs", "/docs");
    addPage("guide", "/docs/guide", "project:page:docs" as EntryId<"page">);
    const docs = "project:page:docs" as EntryId<"page">;
    expect(
      catalogParentPageOptions(pages(), docs).map((item) => item.page.id),
    ).toEqual([HOME]);
    expect(
      catalogParentPageOptions(pages(), HOME).map((item) => [
        item.page.id,
        item.depth,
      ]),
    ).toEqual([
      [docs, 0],
      ["project:page:guide", 1],
    ]);

    workspace.execute(catalogPageCommands.parent(HOME, docs));
    expect(graph.getEntry(HOME)).toMatchObject({ parentId: docs });
    workspace.execute(catalogPageCommands.parent(HOME, undefined));
    expect(graph.getEntry(HOME)).not.toHaveProperty("parentId");

    expect(catalogPageRouteEdit(pages(), HOME, "/docs")).toEqual({
      refused: "ROUTE_TAKEN",
    });
    expect(catalogPageRouteEdit(pages(), HOME, "a b")).toEqual({
      refused: "ROUTE_CHARACTERS",
    });
    expect(catalogPageRouteEdit(pages(), HOME, "/a//b")).toEqual({
      refused: "ROUTE_SLASHES",
    });
    const edit = catalogPageRouteEdit(pages(), HOME, "start");
    if (!("command" in edit)) throw new Error("refused");
    workspace.execute(edit.command);
    expect(graph.getEntry(HOME)).toMatchObject({ route: "/start" });
  });

  it("a layout wraps the page's content and removing it puts the content back; the body keeps its page", async () => {
    const { workspace, graph } = await open();
    expect(catalogSettingsPage(graph, BODY)).toBe(HOME);
    expect(catalogSettingsPage(graph, id("hero"))).toBe(undefined);
    workspace.execute(
      createLayout({
        name: "Shell",
        rootId: id("shell"),
        entries: [
          node("shell", [id("main")]),
          node("main", [], { slot: { name: "content", required: false } }),
        ],
        newId: workspace.newId,
      }),
    );
    const [layout] = catalogPageLayouts(graph);
    expect(layout).toMatchObject({ name: "Shell" });

    const revision = graph.revision;
    workspace.execute(
      catalogPageCommands.layout(HOME, layout.id, workspace.newId),
    );
    expect(graph.revision).toBe(revision + 1);
    expect(catalogPageLayoutId(graph, HOME)).toBe(layout.id);
    const [instance] = (graph.getEntry(HOME) as PageEntry).children;
    // The page root is now the layout instance; the body sits in its slot and still edits its page.
    expect(instance).not.toBe(BODY);
    expect(catalogSettingsPage(graph, instance as NodeId)).toBe(HOME);
    expect(catalogSettingsPage(graph, BODY)).toBe(HOME);
    expect(catalogVariableOwner(graph, BODY)).toBe(HOME);

    workspace.execute(
      catalogPageCommands.layout(HOME, undefined, workspace.newId),
    );
    expect(catalogPageLayoutId(graph, HOME)).toBe(undefined);
    expect((graph.getEntry(HOME) as PageEntry).children).toEqual([BODY]);
    workspace.undo();
    expect(catalogPageLayoutId(graph, HOME)).toBe(layout.id);
    // A page root that is an ordinary component instance is not a layout.
    workspace.undo();
    workspace.execute(
      catalogComponentCommands.create(BODY, "Frame", workspace.newId),
    );
    expect((graph.getEntry(HOME) as PageEntry).children).toHaveLength(1);
    expect(catalogPageLayoutId(graph, HOME)).toBe(undefined);
  });
});
