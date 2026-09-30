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
});
