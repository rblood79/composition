import { describe, expect, it } from "vitest";
import type {
  EntryId,
  InteractionEntry,
  NodeEntry,
  PageEntry,
  ProjectEntry,
  ThemeEntry,
  TokenEntry,
} from "../../document/types";
import { resolveCatalogNode } from "../../resolution/resolver";
import {
  addRecord,
  applyLayout,
  createLayout,
  createPage,
  createTheme,
  deleteLayout,
  duplicatePage,
  duplicateTheme,
  removePage,
  removeRecords,
  removeTheme,
  reorderPages,
  setActiveTheme,
  setNodeInteractions,
  setThemeToken,
  updatePage,
} from "../project";
import {
  allocator,
  children,
  code,
  graphOf,
  node,
  PAGE,
  pageView,
  PROJECT,
  run,
  snapshot,
  text,
  undo,
  view,
} from "./fixture";

/**
 * ADR-248 Phase 4b project commands (pages, layouts, themes/tokens, variables, interactions):
 * one history for all of them, inverses restore, and removals take their dependent records.
 */
const project = (graph: ReturnType<typeof graphOf>) =>
  graph.getEntry(PROJECT) as ProjectEntry;
const page = (id: string, route: string, patch: Partial<PageEntry> = {}) =>
  ({
    kind: "page",
    id: id as EntryId<"page">,
    route,
    name: route,
    children: [],
    ...patch,
  }) as PageEntry;

describe("ADR-248 Phase 4b project commands", () => {
  it("creates, edits, orders, duplicates and removes pages", () => {
    const graph = graphOf([text("a", "A")], ["a"]);
    const newId = allocator();
    const created = run(
      graph,
      createPage({
        page: page("project:page:about", "/about", {
          children: ["project:node:b"],
        }),
        entries: [text("b", "B")],
      }),
    );
    expect(project(graph).pageIds).toEqual([PAGE, "project:page:about"]);
    expect(
      code(() =>
        updatePage({ id: "project:page:about", fields: { route: "/" } })(graph),
      ),
    ).toBe("ROUTE_TAKEN");
    run(
      graph,
      updatePage({
        id: "project:page:about",
        fields: { name: "About", parentId: PAGE },
      }),
    );
    expect(graph.getEntry("project:page:about")).toMatchObject({
      name: "About",
      parentId: PAGE,
    });
    run(graph, reorderPages({ ids: ["project:page:about", PAGE] }));
    expect(project(graph).pageIds).toEqual(["project:page:about", PAGE]);
    const copy = run(
      graph,
      duplicatePage({
        id: "project:page:about",
        route: "/about-2",
        name: "About 2",
        newId,
      }),
    );
    const copyId = project(graph).pageIds[1];
    const copied = graph.getEntry(copyId) as PageEntry;
    expect(copied.route).toBe("/about-2");
    expect(copied.children).toHaveLength(1);
    expect(copied.children[0]).not.toBe("project:node:b");
    expect(view(resolveCatalogNode(graph, copied.children[0]))).toEqual(
      view(resolveCatalogNode(graph, "project:node:b")),
    );
    undo(graph, copy.result.inverse);
    expect(project(graph).pageIds).toEqual(["project:page:about", PAGE]);
    expect(created.result.impact.structural).toBe(true);
  });

  it("removing a page takes its nodes, its variables and navigation to it; child pages move up", () => {
    const graph = graphOf(
      [text("a", "A"), node("button", "lib:definition:section")],
      ["a", "button"],
    );
    run(
      graph,
      createPage({
        page: page("project:page:about", "/about", {
          children: ["project:node:b"],
        }),
        entries: [text("b", "B")],
      }),
    );
    run(
      graph,
      createPage({
        page: page("project:page:team", "/about/team", {
          parentId: "project:page:about",
        }),
      }),
    );
    run(
      graph,
      addRecord({
        entry: {
          kind: "stateVariable",
          id: "project:stateVariable:tab",
          ownerId: "project:page:about",
          name: "tab",
          valueType: "number",
          defaultValue: 0,
        },
      }),
    );
    run(
      graph,
      addRecord({
        entry: {
          kind: "interaction",
          id: "project:interaction:go",
          ownerId: "project:node:button",
          trigger: "press",
          action: { opcode: "navigate", pageId: "project:page:about" },
        },
      }),
    );
    const before = snapshot(graph);
    const removed = run(graph, removePage({ id: "project:page:about" }));
    for (const id of [
      "project:page:about",
      "project:node:b",
      "project:stateVariable:tab",
      "project:interaction:go",
    ])
      expect(graph.getEntry(id)).toBeUndefined();
    expect(
      (graph.getEntry("project:page:team") as PageEntry).parentId,
    ).toBeUndefined();
    expect(project(graph)).toMatchObject({
      pageIds: [PAGE, "project:page:team"],
      stateVariableIds: [],
      interactionIds: [],
    });
    undo(graph, removed.result.inverse);
    expect(snapshot(graph)).toBe(before);
    run(graph, removePage({ id: "project:page:about" }));
    run(graph, removePage({ id: "project:page:team" }));
    expect(code(() => removePage({ id: PAGE })(graph))).toBe("LAST_PAGE");
  });

  it("applies a reusable layout: the page body is one instance, its content fills the slot", () => {
    const graph = graphOf([text("a", "A"), text("b", "B")], ["a", "b"]);
    const shown = pageView(graph);
    const newId = allocator();
    run(
      graph,
      createLayout({
        name: "Shell",
        rootId: "project:node:shell",
        entries: [
          node("shell", "lib:definition:section", {
            children: ["project:node:header", "project:node:main"],
          }),
          text("header", "Header"),
          node("main", "lib:definition:section", {
            slot: { name: "content", required: false },
          }),
        ],
        newId,
      }),
    );
    const layoutId = project(graph).definitionIds[0];
    const initial = snapshot(graph);
    const applied = run(
      graph,
      applyLayout({ pageId: PAGE, definitionId: layoutId, newId }),
    );
    const [instanceId] = children(graph, PAGE);
    const resolved = view(resolveCatalogNode(graph, instanceId)) as {
      children: Array<{ children: Array<{ children: unknown[] }> }>;
    };
    const shell = resolved.children[0];
    expect(shell.children[0]).toMatchObject({
      props: { children: "Header" },
    });
    expect(shell.children[1].children).toEqual(shown);
    undo(graph, applied.result.inverse);
    expect(snapshot(graph)).toBe(initial);
    // Removing the layout gives the content back to the page.
    run(graph, applyLayout({ pageId: PAGE, definitionId: layoutId, newId }));
    run(graph, applyLayout({ pageId: PAGE, definitionId: undefined, newId }));
    expect(pageView(graph)).toEqual(shown);
    run(graph, applyLayout({ pageId: PAGE, definitionId: layoutId, newId }));
    run(graph, deleteLayout({ definitionId: layoutId }));
    expect(pageView(graph)).toEqual(shown);
    expect(project(graph).definitionIds).toEqual([]);
    expect(graph.getEntry("project:node:shell")).toBeUndefined();
    expect(
      code(() =>
        createLayout({
          name: "No slot",
          rootId: "project:node:bare",
          entries: [node("bare", "lib:definition:section")],
          newId,
        })(graph),
      ),
    ).toBe("LAYOUT_SLOT_REQUIRED");
  });

  it("themes: create, token set/update/remove, duplicate, activate, remove", () => {
    const graph = graphOf([text("a", "A")], ["a"]);
    const newId = allocator();
    const theme: ThemeEntry = {
      kind: "theme",
      id: "project:theme:light",
      name: "Light",
      tokenIds: [],
      preset: {
        tint: "blue",
        neutral: "gray",
        radius: "md",
        darkMode: "light",
      },
    };
    run(graph, createTheme({ theme, activate: true }));
    expect(project(graph).activeThemeId).toBe(theme.id);
    run(
      graph,
      setThemeToken({
        themeId: theme.id,
        name: "typography.base-size",
        value: { tokenType: "number", value: 16 },
        newId,
      }),
    );
    const [tokenId] = (graph.getEntry(theme.id) as ThemeEntry).tokenIds;
    run(
      graph,
      setThemeToken({
        themeId: theme.id,
        name: "typography.base-size",
        value: { tokenType: "number", value: 18 },
        newId,
      }),
    );
    expect((graph.getEntry(tokenId) as TokenEntry).value).toBe(18);
    expect((graph.getEntry(theme.id) as ThemeEntry).tokenIds).toEqual([
      tokenId,
    ]);
    run(
      graph,
      duplicateTheme({ id: theme.id, name: "Dark", newId, activate: true }),
    );
    const darkId = project(graph).activeThemeId!;
    expect(darkId).not.toBe(theme.id);
    const darkTokens = (graph.getEntry(darkId) as ThemeEntry).tokenIds;
    expect(darkTokens).toHaveLength(1);
    expect(darkTokens[0]).not.toBe(tokenId);
    run(
      graph,
      setThemeToken({
        themeId: theme.id,
        name: "typography.base-size",
        value: null,
        newId,
      }),
    );
    expect(graph.getEntry(tokenId)).toBeUndefined();
    expect(project(graph).tokenIds).toEqual(darkTokens);
    run(graph, setActiveTheme({ id: theme.id }));
    run(graph, removeTheme({ id: theme.id }));
    expect(project(graph)).toMatchObject({
      themeIds: [darkId],
      activeThemeId: darkId,
    });
  });

  it("replaces a node's interaction list; removing a variable removes what sets it", () => {
    const graph = graphOf(
      [node("button", "lib:definition:section")],
      ["button"],
    );
    run(
      graph,
      addRecord({
        entry: {
          kind: "stateVariable",
          id: "project:stateVariable:open",
          ownerId: "project:node:button",
          name: "open",
          valueType: "boolean",
          defaultValue: false,
        },
      }),
    );
    const rule = (id: string, op: "toggle" | "reset"): InteractionEntry => ({
      kind: "interaction",
      id: id as EntryId<"interaction">,
      ownerId: "project:node:button",
      trigger: "press",
      action: {
        opcode: "setState",
        variableId: "project:stateVariable:open",
        op,
      },
    });
    run(
      graph,
      setNodeInteractions({
        ownerId: "project:node:button",
        entries: [
          rule("project:interaction:one", "toggle"),
          rule("project:interaction:two", "toggle"),
        ],
      }),
    );
    const before = snapshot(graph);
    const replaced = run(
      graph,
      setNodeInteractions({
        ownerId: "project:node:button",
        entries: [rule("project:interaction:two", "reset")],
      }),
    );
    expect(graph.getEntry("project:interaction:one")).toBeUndefined();
    expect(
      (graph.getEntry("project:interaction:two") as InteractionEntry).action,
    ).toMatchObject({ op: "reset" });
    expect(project(graph).interactionIds).toEqual(["project:interaction:two"]);
    undo(graph, replaced.result.inverse);
    expect(snapshot(graph)).toBe(before);
    run(graph, removeRecords({ ids: ["project:stateVariable:open"] }));
    expect(project(graph)).toMatchObject({
      stateVariableIds: [],
      interactionIds: [],
    });
    expect((graph.getEntry("project:node:button") as NodeEntry).kind).toBe(
      "node",
    );
  });
});
