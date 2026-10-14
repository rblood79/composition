import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  applyLayout,
  createComponent,
  createLayout,
  duplicateNodes,
  insertNodes,
  setFields,
  setSlotDeclaration,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogCanvasGestures } from "../canvasGesture";
import { catalogCanvasMenuItems } from "../canvasMenu";
import { CatalogCanvasScene } from "../canvasScene";
import { pickTopmostRecord } from "../canvasPick";
import { catalogLayerDropCommand, CatalogLayerTreeStore } from "../layerTree";
import { newCatalogProjectDocument } from "../project";
import { catalogMenuHost, runCatalogShortcut } from "../shortcuts";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-261 Phase 1 (Decision 1): a drop · paste · reorder inside an instance writes to the record's
 * edit target — the instance's slot (`fillSlot`) — never to the origin's or the layout's template
 * node it was projected from (G0 live: ArrowDown · ⌘V wrote into the origin, a layout page's
 * ArrowDown into the layout template). A position projected from the origin is not moved (pen.dev),
 * and a template position without a slot takes nothing (user decision 2).
 */
const PROJECT = "project:project:adr261" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;
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
// No text measure here: each text gets a fixed 40 px height.
const text = (name: string): NodeEntry => ({
  ...node(name, "lib:definition:text"),
  props: { children: { kind: "set", value: name.toUpperCase() } },
  sizing: { height: { kind: "set", value: 40 } },
});
const FRAME = "lib:definition:type-frame";
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:t${++next}` as EntryId<K>;
};
const column = (...names: string[]) =>
  setFields({
    targets: names.map((name) => ({ kind: "node" as const, id: id(name) })),
    layout: {
      display: { kind: "set", value: "flex" },
      flexDirection: { kind: "set", value: "column" },
    },
  });

/** Body > A (origin: S slot · N frame holding t) · loose text L; I = a copy (instance) of A. */
async function open(options: { slotDefaults?: boolean } = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-261" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr261-drop-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const newId = allocator();
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("A", FRAME, [id("S"), id("N")]),
        node("S", FRAME, options.slotDefaults ? [id("c1"), id("c2")] : []),
        node("N", FRAME, [id("t")]),
        text("t"),
        text("L"),
        ...(options.slotDefaults ? [text("c1"), text("c2")] : []),
      ],
      rootIds: [id("A"), id("L")],
      newId,
    }),
  );
  workspace.execute(column("A", "S", "N"));
  workspace.execute(
    setSlotDeclaration({
      id: id("S"),
      slot: { name: "content", required: false },
    }),
  );
  workspace.execute(
    createComponent({ id: id("A"), name: "Card A", newId: workspace.newId }),
  );
  const I = workspace.execute(
    duplicateNodes({ ids: [id("A")], newId: workspace.newId }),
  ).plan.selectAfter![0] as NodeId;
  const slot = {
    kind: "descendant" as const,
    ownerId: I,
    address: { instances: [I], templatePath: [id("A"), id("S")] },
  };
  workspace.execute(
    insertNodes({
      parent: slot,
      entries: [text("b1"), text("b2")],
      rootIds: [id("b1"), id("b2")],
      newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const entry = (name: string) => JSON.stringify(graph.getEntry(id(name)));
  const fill = () => {
    const owner = graph.getEntry(I);
    const found =
      owner?.kind === "node"
        ? owner.descendantOverrides.find(
            (item) =>
              item.kind === "fillSlot" &&
              item.address.templatePath.at(-1) === id("S"),
          )
        : undefined;
    return found?.kind === "fillSlot" ? found.childIds : undefined;
  };
  /** The drawn record of a node: the one inside I (`inI`) or the page's own. */
  const record = (name: string, inI = false) => {
    const root = workspace.root;
    const under = (identity: string) => {
      for (
        let at = root.domInputs.get(identity)?.parentId;
        at;
        at = root.domInputs.get(at)?.parentId
      )
        if (root.domInputs.get(at)?.sourceId === I) return true;
      return false;
    };
    return root
      .recordsOfSource(id(name))
      .find((identity) => under(identity) === inI)!;
  };
  return { workspace, graph, I, entry, fill, record };
}

function gesturesOf(workspace: CatalogWorkspace) {
  const scene = new CatalogCanvasScene(workspace.root);
  const gestures = new CatalogCanvasGestures({
    get records() {
      return workspace.root.domInputs;
    },
    graph: workspace.runtime.graph,
    bounds: (record) => scene.stream.boundsMap.get(record),
    pick: (x, y) =>
      pickTopmostRecord(scene.stream, x, y, scene.stream.hitBoundsMap.keys()),
    selection: () => workspace.session.getSnapshot().selection,
    itemOfRecord: (record) => workspace.itemOfRecord(record),
    editingContext: () => workspace.session.getSnapshot().editingContext,
    selectRecords: (ids, options) => workspace.selectRecords(ids, options),
    breakpoint: () => workspace.session.getSnapshot().breakpoint,
    execute: (command) => {
      workspace.execute(command);
      scene.sync();
    },
    newId: workspace.newId,
  });
  const center = (record: string) => {
    const b = scene.stream.boundsMap.get(record)!;
    return [b.x + b.width / 2, b.y + b.height / 2] as const;
  };
  return { gestures, center };
}

describe("ADR-261 Phase 1 — drop · paste · reorder parent = the edit target", () => {
  it("ArrowDown on a slot child reorders the instance's fillSlot; the origin slot stays", async () => {
    const { workspace, entry, fill, record } = await open();
    const origin = entry("S");
    workspace.selectRecords([record("b1", true)]);
    expect(runCatalogShortcut(workspace, "arrowDown")).toBe(true);
    expect(fill()).toEqual([id("b2"), id("b1")]);
    expect(entry("S")).toBe(origin);
  });

  it("a position projected from the origin is not reordered inside the instance (pen.dev)", async () => {
    const { workspace, entry, record } = await open();
    const origin = entry("A");
    workspace.selectRecords([record("S", true)]);
    expect(runCatalogShortcut(workspace, "arrowDown")).toBe(false);
    expect(entry("A")).toBe(origin);
  });

  it("⌘C ⌘V after a slot child pastes into the slot; the origin slot stays", async () => {
    const { workspace, entry, fill, record } = await open();
    const origin = entry("S");
    workspace.selectRecords([record("b1", true)]);
    expect(runCatalogShortcut(workspace, "copy")).toBe(true);
    expect(runCatalogShortcut(workspace, "paste")).toBe(true);
    expect(fill()).toHaveLength(3);
    expect(fill()![0]).toBe(id("b1"));
    expect(entry("S")).toBe(origin);
  });

  it("z-order on a slot child reorders the slot; the origin slot stays", async () => {
    const { workspace, entry, fill, record } = await open();
    const origin = entry("S");
    workspace.selectRecords([record("b1", true)]);
    const front = catalogCanvasMenuItems(
      catalogMenuHost(workspace),
      "canvas-element",
      record("b1", true),
    ).find((item) => item.kind === "action" && item.id === "bring-to-front");
    expect(front?.kind).toBe("action");
    if (front?.kind === "action") await front.run();
    expect(fill()).toEqual([id("b2"), id("b1")]);
    expect(entry("S")).toBe(origin);
  });

  it("a Canvas drag into the instance's slot fills it; Alt copies there; the origin stays", async () => {
    const { workspace, entry, fill, record } = await open();
    const origin = entry("S");
    const { gestures, center } = gesturesOf(workspace);
    workspace.selectRecords([record("L")]);
    const [lx, ly] = center(record("L"));
    const [bx, by] = center(record("b2", true));
    expect(gestures.beginMove(lx, ly, record("L"))).toBe(true);
    gestures.update(bx, by + 15, 1);
    expect(gestures.finish()).toBe(true);
    expect(fill()).toEqual([id("b1"), id("b2"), id("L")]);
    expect(entry("S")).toBe(origin);

    workspace.selectRecords([record("b1", true)]);
    const [cx, cy] = center(record("b1", true));
    const [tx, ty] = center(record("L", true));
    expect(gestures.beginMove(cx, cy, record("b1", true), { copy: true })).toBe(
      true,
    );
    gestures.update(tx, ty + 15, 1);
    expect(gestures.finish()).toBe(true);
    expect(fill()).toHaveLength(4);
    expect(entry("S")).toBe(origin);
  });

  it("a drag over a template position without a slot writes neither the origin nor the instance (user decision 2)", async () => {
    const { workspace, graph, I, entry, record } = await open();
    const before = { A: entry("A"), N: entry("N") };
    const { gestures, center } = gesturesOf(workspace);
    workspace.selectRecords([record("L")]);
    const [lx, ly] = center(record("L"));
    const [tx, ty] = center(record("t", true));
    gestures.beginMove(lx, ly, record("L"));
    gestures.update(tx, ty, 1);
    gestures.finish();
    expect(entry("N")).toBe(before.N);
    expect(entry("A")).toBe(before.A);
    // Not the instance's own children either (review: the walk reached the instance root).
    expect(graph.ownerOf(id("L"))).toBe(BODY);
    expect((graph.getEntry(I) as NodeEntry).children).toEqual([]);
  });

  it("a Layers drop after a template row of an unfilled slot goes after it (ensureChildList order)", async () => {
    const { workspace, graph, I, record } = await open({ slotDefaults: true });
    const J = workspace.execute(
      duplicateNodes({ ids: [id("A")], newId: workspace.newId }),
    ).plan.selectAfter![0] as NodeId;
    expect(J).not.toBe(I);
    const tree = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      HOME,
    );
    const inJ = (name: string) =>
      workspace.root.recordsOfSource(id(name)).find((identity) => {
        for (
          let at = workspace.root.domInputs.get(identity)?.parentId;
          at;
          at = workspace.root.domInputs.get(at)?.parentId
        )
          if (workspace.root.domInputs.get(at)?.sourceId === J) return true;
        return false;
      })!;
    tree.setExpanded(
      new Set([
        workspace.root.recordsOfSource(BODY)[0],
        workspace.root.recordsOfSource(J)[0],
        inJ("S"),
      ]),
    );
    const move = catalogLayerDropCommand(
      tree,
      graph,
      [record("L")],
      inJ("c2"),
      "after",
      workspace.newId,
    );
    workspace.execute(move!);
    const fill = (graph.getEntry(J) as NodeEntry).descendantOverrides.find(
      (item) => item.kind === "fillSlot",
    );
    expect(fill?.kind === "fillSlot" && fill.childIds.at(-1)).toBe(id("L"));
    expect(fill?.kind === "fillSlot" && fill.childIds).toHaveLength(3);
  });

  it("a Layers drop reorders inside the slot; a non-slot template row takes nothing", async () => {
    const { workspace, graph, I, entry, fill, record } = await open();
    const tree = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      HOME,
    );
    tree.setExpanded(
      new Set([
        workspace.root.recordsOfSource(BODY)[0],
        workspace.root.recordsOfSource(I)[0],
        record("S", true),
      ]),
    );
    const origin = entry("S");
    const move = catalogLayerDropCommand(
      tree,
      graph,
      [record("b2", true)],
      record("b1", true),
      "before",
      workspace.newId,
    );
    expect(move).toBeDefined();
    workspace.execute(move!);
    expect(fill()).toEqual([id("b2"), id("b1")]);
    expect(entry("S")).toBe(origin);
    expect(
      catalogLayerDropCommand(
        tree,
        graph,
        [record("L")],
        record("N", true),
        "on",
        workspace.newId,
      ),
    ).toBeUndefined();
  });

  it("a layout page's content: ArrowDown reorders the body's fillSlot; the layout template stays", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({ projectId: PROJECT, name: "Layout" }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr261-layout-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    const graph = workspace.runtime.graph;
    const bodyDefinition = (graph.getEntry(BODY) as NodeEntry).definitionId;
    const shell = {
      ...node("shell", bodyDefinition, [id("C")]),
    };
    const content = {
      ...node("C", FRAME),
      slot: { name: "content", required: false },
    };
    workspace.execute(
      createLayout({
        name: "Shell",
        entries: [shell, content],
        rootId: id("shell"),
        newId: workspace.newId,
      }),
    );
    const project = graph.getEntry(graph.projectId) as ProjectEntry;
    const definitionId = project.definitionIds.find(
      (definition) =>
        (graph.getEntry(definition) as { templateRootId?: string })
          ?.templateRootId === id("shell"),
    )!;
    workspace.execute(
      applyLayout({ pageId: HOME, definitionId, newId: workspace.newId }),
    );
    const body = (graph.getEntry(HOME) as PageEntry).children[0] as NodeId;
    workspace.execute(
      insertNodes({
        parent: {
          kind: "descendant",
          ownerId: body,
          address: { instances: [body], templatePath: [id("shell"), id("C")] },
        },
        entries: [text("p1"), text("p2")],
        rootIds: [id("p1"), id("p2")],
        newId: allocator(),
      }),
    );
    const template = JSON.stringify(graph.getEntry(id("C")));
    workspace.selectRecords([workspace.root.recordsOfSource(id("p1"))[0]]);
    expect(runCatalogShortcut(workspace, "arrowDown")).toBe(true);
    const owner = graph.getEntry(body) as NodeEntry;
    const fill = owner.descendantOverrides.find(
      (item) => item.kind === "fillSlot",
    );
    expect(fill?.kind === "fillSlot" && fill.childIds).toEqual([
      id("p2"),
      id("p1"),
    ]);
    expect(JSON.stringify(graph.getEntry(id("C")))).toBe(template);
  });
});
