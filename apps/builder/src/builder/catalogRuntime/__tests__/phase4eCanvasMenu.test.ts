import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogArrangeCommand } from "../shortcuts";
import type { ContextMenuItem } from "../../components/overlay/contextMenu/types";
import { catalogCanvasMenuItems, type CatalogMenuHost } from "../canvasMenu";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-3b Canvas context menu: items over the selection are the new commands (each
 * one history step); an item whose command would be refused is not listed; the page background
 * pastes into the page body.
 */
const PROJECT = "project:project:menu" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:m${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Menu" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-menu-${Math.random()}`),
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
        node("list", "lib:definition:type-frame", [id("a"), id("b"), id("c")]),
        node("a", "lib:definition:text"),
        node("b", "lib:definition:text"),
        node("c", "lib:definition:text"),
      ],
      rootIds: [id("list")],
      newId: allocator(),
    }),
  );
  const host: CatalogMenuHost = {
    graph: workspace.runtime.graph,
    get records() {
      return workspace.root.domInputs;
    },
    selection: () => workspace.session.getSnapshot().selection,
    execute: (command) => workspace.execute(command),
    newId: workspace.newId,
    clipboard: {
      get: () => workspace.clipboard,
      set: (value) => {
        workspace.clipboard = value;
      },
    },
  };
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0];
  const children = (name: string) => {
    const entry = workspace.runtime.graph.getEntry(id(name));
    return entry?.kind === "node" ? entry.children : [];
  };
  const ids = (items: ContextMenuItem[]) =>
    items.filter((item) => item.kind !== "separator").map((item) => item.id);
  const run = (items: ContextMenuItem[], itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (item?.kind !== "action") throw new Error(`no ${itemId}`);
    void item.run();
  };
  return { workspace, host, record, children, ids, run };
}

describe("ADR-248 Phase 4e-3b Canvas context menu", () => {
  it("lists the selection's commands; z-order moves among siblings; ungroup only for a container", async () => {
    const { workspace, host, record, children, ids, run } = await open();
    workspace.selectRecords([record("b")]);
    const items = catalogCanvasMenuItems(host, "canvas-element", record("b"));
    expect(ids(items)).toEqual([
      "copy",
      "duplicate",
      "bring-to-front",
      "bring-forward",
      "send-backward",
      "send-to-back",
      "group",
      "toggle-component-origin",
      "delete",
    ]);
    run(items, "bring-to-front");
    expect(children("list")).toEqual([id("a"), id("c"), id("b")]);
    workspace.undo();
    run(
      catalogCanvasMenuItems(host, "canvas-element", record("b")),
      "send-to-back",
    );
    expect(children("list")).toEqual([id("b"), id("a"), id("c")]);

    // The first sibling has nothing behind it; the frame (a container) can be ungrouped.
    expect(
      ids(catalogCanvasMenuItems(host, "canvas-element", record("b"))),
    ).not.toContain("send-backward");
    workspace.selectRecords([record("list")]);
    expect(
      ids(catalogCanvasMenuItems(host, "canvas-element", record("list"))),
    ).toContain("ungroup");
  });

  it("copy then paste inserts a copy after the element; group wraps it; delete removes it", async () => {
    const { workspace, host, record, children, ids, run } = await open();
    workspace.selectRecords([record("a")]);
    run(catalogCanvasMenuItems(host, "canvas-element", record("a")), "copy");
    expect(workspace.clipboard?.rootIds).toEqual([id("a")]);
    const withPaste = catalogCanvasMenuItems(
      host,
      "canvas-element",
      record("a"),
    );
    expect(ids(withPaste)).toContain("paste");
    run(withPaste, "paste");
    expect(children("list")).toHaveLength(4);
    expect(children("list")[0]).toBe(id("a"));
    expect(children("list")[1]).not.toBe(id("b"));

    workspace.selectRecords([record("c")]);
    run(catalogCanvasMenuItems(host, "canvas-element", record("c")), "group");
    const group = children("list")[3];
    expect(children("list")).not.toContain(id("c"));
    expect(workspace.runtime.graph.getEntry(group)).toMatchObject({
      definitionId: "lib:definition:type-frame",
      children: [id("c")],
    });

    workspace.selectRecords([record("b")]);
    run(catalogCanvasMenuItems(host, "canvas-element", record("b")), "delete");
    expect(workspace.runtime.graph.getEntry(id("b"))).toBeUndefined();

    // The page background pastes into the page body.
    const body = workspace.root.recordsOfSource(BODY)[0];
    const empty = catalogCanvasMenuItems(host, "canvas-empty", body);
    expect(ids(empty)).toEqual(["paste"]);
    run(empty, "paste");
    expect(children("home-body")).toHaveLength(2);
    // Off every page (no body under the pointer) there is nothing to do.
    expect(catalogCanvasMenuItems(host, "canvas-empty", undefined)).toEqual([]);
  });

  it("aligns absolutely placed elements from the Align submenu (items that would move), as one step", async () => {
    const { workspace, host, ids } = await open();
    const placed = (name: string, x: number, y: number): NodeEntry => ({
      ...node(name, "lib:definition:type-frame"),
      sizing: {
        width: { kind: "set", value: 40 },
        height: { kind: "set", value: 20 },
      },
      placement: { kind: "absolute", x, y },
    });
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [placed("p", 10, 10), placed("q", 100, 60), placed("r", 200, 30)],
        rootIds: [id("p"), id("q"), id("r")],
        newId: allocator(),
      }),
    );
    const records = ["p", "q", "r"].map(
      (name) => workspace.root.recordsOfSource(id(name))[0],
    );
    const withArrange: CatalogMenuHost = {
      ...host,
      arrange: (shortcut) => catalogArrangeCommand(workspace, shortcut),
    };
    workspace.selectRecords(records.slice(0, 2));
    const two = catalogCanvasMenuItems(withArrange, "canvas-element", records[0]);
    const align = two.find((item) => item.id === "align");
    expect(align?.kind).toBe("submenu");
    // Two elements: no distribution (it needs three).
    expect(align?.kind === "submenu" && ids(align.items)).toEqual([
      "align-left",
      "align-center",
      "align-right",
      "align-top",
      "align-middle",
      "align-bottom",
    ]);
    workspace.selectRecords(records);
    const three = catalogCanvasMenuItems(withArrange, "canvas-element", records[0]);
    const submenu = three.find((item) => item.id === "align");
    expect(submenu?.kind === "submenu" && ids(submenu.items)).toContain(
      "distribute-horizontal",
    );
    const left =
      submenu?.kind === "submenu" &&
      submenu.items.find((item) => item.id === "align-left");
    if (!left || left.kind !== "action") throw new Error("no align-left");
    const undo = workspace.runtime.historyLabels.undo.length;
    void left.run();
    expect(workspace.runtime.historyLabels.undo.length).toBe(undo + 1);
    const xs = ["p", "q", "r"].map((name) => {
      const entry = workspace.runtime.graph.getEntry(id(name));
      return entry?.kind === "node" && entry.placement?.kind === "absolute"
        ? entry.placement.x
        : null;
    });
    expect(xs).toEqual([10, 10, 10]);
    // Without the host's arrange there is no submenu (the old flow-only menu).
    expect(
      ids(catalogCanvasMenuItems(host, "canvas-element", records[0])),
    ).not.toContain("align");
  });

  it("component items: create, then on the instance go to origin · detach (dissolve offered)", async () => {
    const { workspace, host, record, ids, run } = await open();
    const shown: string[] = [];
    const withOrigin: CatalogMenuHost = {
      ...host,
      showDefinition: (definitionId) => shown.push(definitionId),
    };
    workspace.selectRecords([record("list")]);
    const before = catalogCanvasMenuItems(withOrigin, "canvas-element", record("list"));
    const create = before.find((item) => item.id === "toggle-component-origin");
    expect(create).toMatchObject({ labelKey: "componentAction.createComponent" });
    run(before, "toggle-component-origin");
    // An instance of the new component takes the node's place (the node is its template).
    const bodyEntry = workspace.runtime.graph.getEntry(BODY);
    const instanceId = (bodyEntry?.kind === "node" ? bodyEntry.children : [])[0];
    const instance = workspace.runtime.graph.getEntry(instanceId);
    expect(instance?.kind === "node" && instance.definitionId).toMatch(
      /^project:definition:/,
    );
    const instanceRecord = workspace.root.recordsOfSource(instanceId)[0];
    workspace.selectRecords([instanceRecord]);
    const after = catalogCanvasMenuItems(
      withOrigin,
      "canvas-element",
      instanceRecord,
    );
    expect(ids(after).filter((item) => /origin|instance/.test(item))).toEqual([
      "go-to-origin",
      "detach-instance",
      "toggle-component-origin",
    ]);
    expect(
      after.find((item) => item.id === "toggle-component-origin"),
    ).toMatchObject({ labelKey: "componentAction.detachComponent" });
    run(after, "go-to-origin");
    expect(shown).toEqual([
      instance?.kind === "node" ? instance.definitionId : "",
    ]);
    run(after, "detach-instance");
    const detachedBody = workspace.runtime.graph.getEntry(BODY);
    const detached = workspace.runtime.graph.getEntry(
      (detachedBody?.kind === "node" ? detachedBody.children : [])[0],
    );
    expect(detached?.kind === "node" && detached.definitionId).toBe(
      "lib:definition:type-frame",
    );
  });

  it("the page background also offers fit, 100 %, rulers and snapping (with the host's view)", async () => {
    const { workspace, host, ids, run } = await open();
    const calls: string[] = [];
    const view = {
      zoomToFit: () => calls.push("fit"),
      zoom100: () => calls.push("100"),
      rulers: false,
      toggleRulers: () => calls.push("rulers"),
      snap: true,
      toggleSnap: () => calls.push("snap"),
    };
    const body = workspace.root.recordsOfSource(BODY)[0];
    const items = catalogCanvasMenuItems({ ...host, view }, "canvas-empty", body);
    expect(ids(items)).toEqual([
      "zoom-to-fit",
      "zoom-100",
      "show-rulers",
      "snap-to-objects",
    ]);
    expect(items.find((item) => item.id === "show-rulers")).toMatchObject({
      labelKey: "contextMenu.showRulers",
      checked: false,
    });
    expect(items.find((item) => item.id === "snap-to-objects")).toMatchObject({
      checked: true,
    });
    run(items, "zoom-to-fit");
    run(items, "zoom-100");
    for (const item of items)
      if (item.kind === "toggle") void item.run();
    expect(calls).toEqual(["fit", "100", "rulers", "snap"]);
  });
});
