import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogActionBarModel, catalogActionBarState } from "../actionBar";
import * as commands from "../../../../../../packages/shared/src/catalog/commands";
import { catalogCanvasMenuItems } from "../canvasMenu";
import {
  catalogMenuHost,
  catalogArrangeCommand,
  CATALOG_ARRANGE_SHORTCUTS,
} from "../shortcuts";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e: the Contextual Action Bar over the catalog selection — its anchor page, the
 * page-body-only case and its items (the Canvas menu's under the bar policy).
 */
const PROJECT = "project:project:bar" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const placed = (name: string, x: number, y: number): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {
    width: { kind: "set", value: 40 },
    height: { kind: "set", value: 20 },
  },
  descendantOverrides: [],
  placement: { kind: "absolute", x, y },
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Bar" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-bar-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let next = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [placed("p", 10, 10), placed("q", 100, 60)],
      rootIds: [id("p"), id("q")],
      newId: <K extends EntryKind>(kind: K) =>
        `project:${kind}:b${++next}` as EntryId<K>,
    }),
  );
  const record = (name: string) =>
    workspace.root.recordsOfSource(name === "body" ? BODY : id(name))[0];
  const bar = () => {
    const snapshot = workspace.session.getSnapshot();
    const state = catalogActionBarState(
      workspace.runtime.graph,
      workspace.root.domInputs,
      snapshot.selection,
      snapshot.pageId,
    );
    return {
      state,
      model: catalogActionBarModel(catalogMenuHost(workspace), state),
    };
  };
  return { workspace, record, bar };
}

describe("ADR-248 Phase 4e catalog action bar", () => {
  it("does not plan hidden deletion for the bar but preserves overflow deletion and history", async () => {
    const { workspace, record, bar } = await open();
    workspace.selectRecords([record("p"), record("q")]);
    const remove = vi.spyOn(commands, "removeTargets");
    const children = () => {
      const body = workspace.runtime.graph.getEntry(BODY);
      if (body?.kind !== "node") throw new Error("Body missing");
      return body.children;
    };
    try {
      expect(bar().model?.items.map((item) => item.id)).toEqual([
        "align",
        "group",
        "duplicate",
      ]);
      expect(remove).not.toHaveBeenCalled();
      const menu = catalogCanvasMenuItems(
        catalogMenuHost(workspace),
        "canvas-element",
        record("p"),
      );
      const deletion = menu.find((item) => item.id === "delete");
      expect(remove).toHaveBeenCalledTimes(1);
      expect(deletion?.kind).toBe("action");
      const depth = workspace.runtime.historyDepth.undo;
      if (deletion?.kind === "action") deletion.run();
      expect(children()).toEqual([]);
      expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
      workspace.undo();
      expect(children()).toEqual([id("p"), id("q")]);
      workspace.redo();
      expect(children()).toEqual([]);
    } finally {
      remove.mockRestore();
      workspace.dispose();
    }
  });

  it("reads large selection geometry once per menu and skips an empty selection", async () => {
    const { workspace, bar } = await open();
    const entries = Array.from({ length: 300 }, (_, i) =>
      placed(`many${i}`, i * 2, i * 3),
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries,
        rootIds: entries.map((e) => e.id),
        newId: workspace.newId,
      }),
    );
    workspace.selectRecords(
      entries.map((e) => workspace.root.recordsOfSource(e.id)[0]),
    );
    const geometry = vi.spyOn(workspace.root, "getGeometry");
    expect(bar().model?.items[0].id).toBe("align");
    expect(geometry).toHaveBeenCalledTimes(1);
    expect(geometry.mock.calls[0][0]).toHaveLength(300);
    geometry.mockClear();
    workspace.selectRecords([]);
    expect(bar().model).toBeNull();
    expect(geometry).not.toHaveBeenCalled();
    geometry.mockRestore();
    workspace.dispose();
  });

  it("refreshes all prepared arrange actions after resize, selection changes and undo", async () => {
    const { workspace, record } = await open();
    const check = () => {
      const prepared = catalogMenuHost(workspace).arrangeItems!();
      for (const id of CATALOG_ARRANGE_SHORTCUTS) {
        const single = catalogArrangeCommand(workspace, id);
        expect(prepared[id]?.(workspace.runtime.graph)).toEqual(
          single?.(workspace.runtime.graph),
        );
      }
      return prepared;
    };
    workspace.selectRecords([record("p"), record("q")]);
    const geometry = vi.spyOn(workspace.root, "getGeometry");
    expect(catalogArrangeCommand(workspace, "distributeH")).toBeUndefined();
    expect(geometry).not.toHaveBeenCalled();
    geometry.mockRestore();
    const original = check().alignRight!(workspace.runtime.graph);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("q") }],
        sizing: {
          width: { kind: "set", value: 120 },
          height: { kind: "set", value: 20 },
        },
      }),
    );
    expect(check().alignRight!(workspace.runtime.graph)).not.toEqual(original);
    workspace.undo();
    expect(check().alignRight!(workspace.runtime.graph)).toEqual(original);
    workspace.selectRecords([record("p")]);
    expect(check().alignRight).toBeUndefined();
    workspace.dispose();
  });

  it("anchors below the selection's page; one element shows the single context", async () => {
    const { workspace, record, bar } = await open();
    workspace.selectRecords([record("p")]);
    const { state, model } = bar();
    expect(state).toMatchObject({
      selectedIds: [record("p")],
      pageSelection: false,
      selectedPageId: workspace.session.getSnapshot().pageId,
      resolved: true,
    });
    expect(model?.context).toBe("single");
    expect(model?.items.map((item) => item.id)).toEqual([
      "duplicate",
      "toggle-component-origin",
    ]);
  });

  it("two placed elements show the multi context (align first); a page body alone shows none", async () => {
    const { workspace, record, bar } = await open();
    workspace.selectRecords([record("p"), record("q")]);
    const multi = bar().model;
    expect(multi?.context).toBe("multi");
    expect(multi?.items[0].id).toBe("align");
    workspace.selectRecords([record("body")]);
    const page = bar();
    expect(page.state.pageSelection).toBe(true);
    expect(page.model).toBeNull();
    workspace.selectRecords([]);
    expect(bar().model).toBeNull();
  });

  it("two elements in the page flow (nothing to align) still show the multi context", async () => {
    // ADR-248 4e-6-56: the catalog menu offers align only when it would move something; the bar
    // took "has align" as its multi signal, so two flow children showed no bar (the old menu
    // always offered align for 2+).
    const { workspace, bar } = await open();
    let next = 0;
    const flow = (name: string): NodeEntry => ({
      ...placed(name, 0, 0),
      placement: undefined,
    });
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [flow("f1"), flow("f2")],
        rootIds: [id("f1"), id("f2")],
        newId: <K extends EntryKind>(kind: K) =>
          `project:${kind}:f${++next}` as EntryId<K>,
      }),
    );
    workspace.selectRecords([
      workspace.root.recordsOfSource(id("f1"))[0],
      workspace.root.recordsOfSource(id("f2"))[0],
    ]);
    const { model } = bar();
    expect(model?.context).toBe("multi");
    expect(model?.items.map((item) => item.id)).toEqual(["group", "duplicate"]);
  });

  it("a selection that is not in the document (an undo took it) shows no items", async () => {
    const { workspace, record, bar } = await open();
    workspace.selectRecords([record("p")]);
    const { state } = bar();
    const host = catalogMenuHost(workspace);
    expect(catalogActionBarModel(host, state)).not.toBeNull();
    expect(
      catalogActionBarModel(host, { ...state, resolved: false }),
    ).toBeNull();
  });
});
