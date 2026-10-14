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
  insertNodes,
  resetDescendant,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogComponentCommands,
  catalogComponentRole,
  catalogComponentState,
} from "../componentActions";
import { catalogItemInsertChoices } from "../itemInsert";
import { CatalogLayerTreeStore } from "../layerTree";
import { catalogSlotPosition } from "../slots";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Component section: create a component from a node (an instance takes its
 * place), an instance's state (project or library, drawn instances), detach and dissolve — each
 * one history step.
 */
const PROJECT = "project:project:components" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  name: name === "card" ? "Card" : undefined,
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Components" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-components-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let n = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("card", "lib:definition:type-frame", [id("title")]),
        node("title", "lib:definition:text"),
        node("icon", "lib:definition:origin-component-iconbutton"),
      ],
      rootIds: [id("card"), id("icon")],
      newId: (kind) => `project:${kind}:k${++n}` as never,
    }),
  );
  const children = () => {
    const entry = workspace.runtime.graph.getEntry(BODY);
    return entry?.kind === "node" ? entry.children : [];
  };
  return { workspace, children };
}

describe("ADR-248 Phase 4e-4 Component section", () => {
  it("create → the node stays as the origin (ADR-260); dissolve → the instance keeps what it showed, the origin stays", async () => {
    const { workspace, children } = await open();
    const graph = workspace.runtime.graph;
    expect(catalogComponentState(graph, id("card"))).toEqual({});
    const revision = graph.revision;
    const { plan } = workspace.execute(
      catalogComponentCommands.create(id("card"), "Card", workspace.newId),
    );
    expect(graph.revision).toBe(revision + 1);
    expect(plan.selectAfter).toEqual([id("card")]);
    expect(children()[0]).toBe(id("card"));
    const state = catalogComponentState(graph, id("card"));
    expect(state.originOf).toMatchObject({
      name: "Card",
      project: true,
      instanceIds: [],
    });
    expect(state.instanceOf).toBeUndefined();
    expect(workspace.readModel.components()).toHaveLength(1);
    // An instance placed beside it.
    const definitionId = state.originOf!.definitionId as NodeEntry["definitionId"];
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("copy", definitionId)],
        rootIds: [id("copy")],
        newId: workspace.newId,
      }),
    );
    expect(catalogComponentState(graph, id("copy")).instanceOf).toMatchObject({
      instanceIds: [id("copy")],
    });

    workspace.execute(
      catalogComponentCommands.dissolve(definitionId, workspace.newId),
    );
    expect(workspace.readModel.components()).toHaveLength(0);
    expect(graph.getEntry(id("card"))).toMatchObject({
      definitionId: "lib:definition:type-frame",
    });
    const detached = graph.getEntry(id("copy"));
    expect(detached).toMatchObject({
      definitionId: "lib:definition:type-frame",
    });
    expect((detached as NodeEntry).children).toHaveLength(1);
    workspace.undo();
    workspace.undo();
    workspace.undo();
    expect(children()[0]).toBe(id("card"));
    expect(catalogComponentState(graph, id("card"))).toEqual({});
  });

  it("a library component instance detaches into owned nodes", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    // A built-in origin's instances are listed too (select instances, user 2026-10-01).
    expect(catalogComponentState(graph, id("icon")).instanceOf).toMatchObject({
      project: false,
      instanceIds: [id("icon")],
    });
    workspace.execute(
      catalogComponentCommands.detach(id("icon"), workspace.newId),
    );
    // The instance keeps its id and shows its template as owned nodes (root Button + children).
    const detached = graph.getEntry(id("icon")) as NodeEntry;
    expect(detached.definitionId).toBe("lib:definition:type-Button");
    expect(detached.children.length).toBeGreaterThan(0);
    expect(catalogComponentState(graph, id("icon")).instanceOf).toBeUndefined();
  });

  it("a placed ToggleButtonGroup holds its items as its own ToggleButton instances: id, detach, create (as the 「+」 one)", async () => {
    // (User 2026-10-14: "Toggle 1 · 2" showed no detach, no create component, no Attributes / ID —
    // they were template positions; the one "+" adds is an owned node. Placing a slot host now
    // makes its slots' contents its own nodes — 「slot 호스트 전부」.)
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("group", "lib:definition:origin-component-togglebuttongroup"),
        ],
        rootIds: [id("group")],
        newId: workspace.newId,
      }),
    );
    const group = graph.getEntry(id("group")) as NodeEntry;
    const fill = group.descendantOverrides.find(
      (item) => item.kind === "fillSlot",
    );
    expect(fill?.kind).toBe("fillSlot");
    const items = fill?.kind === "fillSlot" ? fill.childIds : [];
    expect(items).toHaveLength(2);
    for (const [index, item] of items.entries()) {
      const entry = graph.getEntry(item) as NodeEntry;
      expect(entry.definitionId).toBe(
        "lib:definition:origin-component-togglebutton",
      );
      expect(entry.props.children).toEqual({
        kind: "set",
        value: `Toggle ${index + 1}`,
      });
      // An owned node: the automatic HTML id (Attributes · ID), and the Component section's
      // instance with detach and create (owned-node actions).
      expect(entry.metadata?.htmlId).toBeTruthy();
      expect(catalogComponentState(graph, item).instanceOf).toMatchObject({
        definitionId: "lib:definition:origin-component-togglebutton",
        name: "ToggleButton",
        project: false,
      });
      expect(catalogComponentRole(graph, item)).toBe("instance");
    }
    // Layers: the group and its items carry the instance dot.
    const pageId = workspace.session.getSnapshot().pageId!;
    const store = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      pageId,
    );
    type Row = { id: string; role?: string; children?: readonly Row[] };
    const all = (rows: readonly Row[]): Row[] =>
      rows.flatMap((row) => [row, ...all(row.children ?? [])]);
    for (let pass = 0; pass < 4; pass += 1)
      store.setExpanded(new Set(all(store.getSnapshot()).map((row) => row.id)));
    const rows = all(store.getSnapshot());
    const groupRow = rows.find((row) => row.id.endsWith(`::${id("group")}`))!;
    expect(groupRow.role).toBe("instance");
    expect(groupRow.children!.map((row) => row.role)).toEqual([
      "instance",
      "instance",
    ]);
    store.dispose();
    // The group's "+" puts its new ToggleButton into the slot with the others: the Design panel's
    // slot list (`catalogSlotPosition`) shows three (user 2026-10-14 — it went after the slot).
    const [groupRecord] = workspace.root.recordsOfSource(id("group"));
    const [plus] = catalogItemInsertChoices(
      { graph, readModel: workspace.readModel, newId: workspace.newId },
      workspace.positionOfRecord(groupRecord!)!,
    );
    workspace.execute(plus!.build());
    const slotList = catalogSlotPosition(graph, { kind: "node", id: id("group") });
    expect(slotList?.fillIds).toHaveLength(3);
    expect(slotList?.fillIds?.slice(0, 2)).toEqual(items);
    expect((graph.getEntry(id("group")) as NodeEntry).children).toEqual([]);
    workspace.undo();
    // Detach an item: one step, it keeps its id and shows what it showed.
    const [first] = items;
    workspace.execute(catalogComponentCommands.detach(first!, workspace.newId));
    expect((graph.getEntry(first!) as NodeEntry).definitionId).toBe(
      "lib:definition:type-ToggleButton",
    );
    workspace.undo();
    expect((graph.getEntry(first!) as NodeEntry).definitionId).toBe(
      "lib:definition:origin-component-togglebutton",
    );
  });

  it("a ListBox's items are its own ListBoxItem instances as the 「+」 one", async () => {
    // (User 2026-10-14: a ListBox's first items differed from the one its "+" adds. Its rows now
    // repeat its first own item — `resolver.ts` fill-slot rows.)
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("list", "lib:definition:origin-component-listbox"),
        ],
        rootIds: [id("list")],
        newId: workspace.newId,
      }),
    );
    const pageId = workspace.session.getSnapshot().pageId!;
    const rowOf = (nodeId: NodeId) =>
      workspace.readModel
        .pageRows(pageId)
        .flatMap((row) => [row, ...workspace.readModel.childRows(row)])
        .find((row) => row.target.kind === "node" && row.target.id === nodeId)!;
    const listItems = workspace.readModel.childRows(rowOf(id("list")));
    expect(listItems.map((row) => row.target.kind)).toEqual([
      "node",
      "node",
      "node",
    ]);
    for (const row of listItems) {
      const target = row.target as { kind: "node"; id: NodeId };
      expect(catalogComponentState(graph, target.id).instanceOf).toMatchObject({
        project: false,
      });
      expect(
        (graph.getEntry(target.id) as NodeEntry).metadata?.htmlId,
      ).toBeTruthy();
    }
    // Its "+" adds the same kind of item, after them in the same list.
    const [listRecord] = workspace.root.recordsOfSource(id("list"));
    const plus = catalogItemInsertChoices(
      { graph, readModel: workspace.readModel, newId: workspace.newId },
      workspace.positionOfRecord(listRecord!)!,
    ).find((choice) => choice.type === "ListBoxItem");
    workspace.execute(plus!.build());
    const after = workspace.readModel.childRows(rowOf(id("list")));
    expect(after.map((row) => row.target.kind)).toEqual([
      "node",
      "node",
      "node",
      "node",
    ]);
    expect(new Set(after.map((row) => String(row.definitionId))).size).toBe(1);
    // A template row of a plain type (a Button origin's Text) is no instance.
    for (const child of workspace.readModel.childRows(rowOf(id("icon"))))
      expect(catalogComponentRole(graph, child.target)).toBeUndefined();
  });
  it.each([
    ["tabs", "Tab"],
    ["tree", "TreeItem"],
    ["menu", "MenuItem"],
    ["select", "ListBoxItem"],
    ["combobox", "ListBoxItem"],
  ])(
    "a placed %s's items are its own %s instances (a Menu's list, a picker's ListBox fill)",
    async (type, itemType) => {
      // (User 2026-10-14 「Tabs · Table · Tree · Menu · Select · ComboBox 도 동일하게」: the items
      // a collection starts with are the same kind as its "+" adds. A Table starts empty.)
      const { workspace } = await open();
      const graph = workspace.runtime.graph;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [node(type, `lib:definition:origin-component-${type}`)],
          rootIds: [id(type)],
          newId: workspace.newId,
        }),
      );
      const items = [...workspace.root.canvasInputs.values()].filter(
        (record) => workspace.root.typeOf(record) === itemType,
      );
      expect(items.length).toBeGreaterThan(1);
      for (const record of items) {
        const target = workspace.itemOfRecord(record.id)!.target;
        expect(target.kind).toBe("node");
        const entry = graph.getEntry((target as { id: NodeId }).id) as NodeEntry;
        expect(entry.metadata?.htmlId).toBeTruthy();
        expect(catalogComponentRole(graph, target)).toBe("instance");
        expect(catalogComponentState(graph, target).instanceOf).toMatchObject({
          project: false,
        });
      }
    },
  );
  it.each([
    ["card", "Content"],
    ["tabs", "TabList"],
    ["menu", "Menu"],
  ])(
    "a placed %s's %s holds its own items and its own style together (one override per address)",
    async (type, partType) => {
      // (2026-10-14: the position's `fillSlot` carries its field writes — a style edit there
      // used to replace the item list and leave the items unowned, refused.)
      const { workspace } = await open();
      const graph = workspace.runtime.graph;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [node(`${type}-host`, `lib:definition:origin-component-${type}`)],
          rootIds: [id(`${type}-host`)],
          newId: workspace.newId,
        }),
      );
      const part = () =>
        [...workspace.root.canvasInputs.values()].find(
          (record) => workspace.root.typeOf(record) === partType,
        )!;
      const target = workspace.itemOfRecord(part().id)!.target;
      expect(target.kind).toBe("descendant");
      const items = part().children.length;
      expect(items).toBeGreaterThan(0);
      workspace.execute(
        setFields({
          targets: [target],
          visual: { backgroundColor: { kind: "set", value: "#ff0000" } },
        }),
      );
      expect(part().visual.backgroundColor).toBe("#ff0000");
      expect(part().children.length).toBe(items);
      const descendant = target as Extract<typeof target, { kind: "descendant" }>;
      const listAt = () =>
        (graph.getEntry(descendant.ownerId) as NodeEntry).descendantOverrides.find(
          (item) =>
            JSON.stringify(item.address) === JSON.stringify(descendant.address),
        );
      expect(listAt()).toMatchObject({
        kind: "fillSlot",
        visual: { backgroundColor: { kind: "set", value: "#ff0000" } },
      });
      // Its "+" keeps the style; a reset drops the style and keeps the items.
      const plus = catalogItemInsertChoices(
        { graph, readModel: workspace.readModel, newId: workspace.newId },
        workspace.positionOfRecord(part().id)!,
      )[0];
      if (plus) {
        workspace.execute(plus.build());
        expect(part().visual.backgroundColor).toBe("#ff0000");
        expect(part().children.length).toBe(items + 1);
      }
      const after = part().children.length;
      workspace.execute(
        resetDescendant({
          ownerId: descendant.ownerId,
          address: descendant.address,
        }),
      );
      expect(part().visual.backgroundColor).not.toBe("#ff0000");
      expect(part().children.length).toBe(after);
      expect(listAt()?.kind).toBe("fillSlot");
      expect(listAt()).not.toHaveProperty("visual");
    },
  );
});
