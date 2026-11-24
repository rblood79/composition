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
  renameNode,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  CATALOG_FRAME_ELEMENT_TYPES,
  catalogFrameElementType,
} from "../../../../../../packages/shared/src/catalog/document/frameElementType";
import { catalogCanvasMenuItems } from "../canvasMenu";
import { catalogMenuHost } from "../shortcuts";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { catalogFrameNameAt, catalogFrameShownName } from "../frameName";

/**
 * A frame's HTML element (사용자 결정 2026-11-24 — the Section · Nav components' replacement): the frame
 * keeps its look and layout, its `elementType` picks the element the Preview · Publish DOM writes.
 * Layers shows what the frame is: its own name, else its element when it is not a `div`, else
 * 「Frame」; a group made of the selection is a frame named 「Group」.
 */
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const frame = (name: string): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:type-frame",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:frame-element" as EntryId<"project">,
        name: "Frame element",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `frame-element-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [frame("a"), frame("b")],
      rootIds: [id("a"), id("b")],
      newId: workspace.newId,
    }),
  );
  const store = new CatalogLayerTreeStore(
    {
      readModel: workspace.readModel,
      graph: workspace.runtime.graph,
      subscribeSteps: (listener) => workspace.runtime.subscribeSteps(listener),
      boundRows: (position) => workspace.boundRowsOf(position),
      subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
      collectionRowHidden: (position, parentType) =>
        workspace.collectionRowHidden(position, parentType),
    },
    workspace.session.getSnapshot().pageId!,
  );
  store.connect();
  store.setExpanded(new Set(workspace.root.domInputs.keys()));
  /** The page body's rows by name. */
  const names = () =>
    (store.getSnapshot()[0]?.children ?? []).map((node) => node.name);
  const element = (name: string, value: string) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id(name) }],
        props: { elementType: { kind: "set", value } },
        label: "Edit properties",
      }),
    );
  const record = (name: string) =>
    [...workspace.root.canvasInputs.values()].find(
      (item) => item.sourceId === id(name),
    )!.id;
  return { library, workspace, names, element, record };
}

describe("frame element type", () => {
  it("the frame definition accepts the element types an app's sections use", async () => {
    const { library, workspace } = await open();
    try {
      expect(
        library.definitions.get("lib:definition:type-frame")?.accepts
          .elementType,
      ).toBe("string");
      expect(CATALOG_FRAME_ELEMENT_TYPES).toEqual([
        "div",
        "main",
        "section",
        "header",
        "footer",
        "nav",
        "article",
        "aside",
      ]);
      // (Anything else — another tag, a script — is a `div`.)
      expect(catalogFrameElementType({ elementType: "nav" })).toBe("nav");
      expect(catalogFrameElementType({ elementType: "script" })).toBe("div");
      expect(catalogFrameElementType({})).toBe("div");
    } finally {
      workspace.dispose();
    }
  });

  it("Layers names a frame by its own name, then its element, then 「Frame」", async () => {
    const { workspace, names, element } = await open();
    try {
      expect(names()).toEqual(["Frame", "Frame"]);
      element("a", "nav");
      expect(names()).toEqual(["nav", "Frame"]);
      // (A `div` is what every frame is — it says nothing.)
      element("a", "div");
      expect(names()).toEqual(["Frame", "Frame"]);
      element("a", "section");
      workspace.execute(renameNode({ id: id("a"), name: "Hero" }));
      expect(names()).toEqual(["Hero", "Frame"]);
      workspace.execute(renameNode({ id: id("a"), name: "" }));
      expect(names()).toEqual(["section", "Frame"]);
      workspace.undo();
      expect(names()).toEqual(["Hero", "Frame"]);
    } finally {
      workspace.dispose();
    }
  });

  it("grouping the selection makes a frame named 「Group」", async () => {
    const { workspace, names, record } = await open();
    try {
      workspace.selectRecords([record("a"), record("b")]);
      const group = catalogCanvasMenuItems(
        catalogMenuHost(workspace),
        "canvas-element",
        record("a"),
      ).find((item) => item.id === "group");
      expect(group?.kind).toBe("action");
      if (group?.kind === "action") group.run();
      const body = workspace.runtime.graph.getEntry(BODY);
      if (body?.kind !== "node") throw new Error("Body missing");
      expect(body.children).toHaveLength(1);
      const made = workspace.runtime.graph.getEntry(body.children[0]!);
      expect(made?.kind === "node" && made.name).toBe("Group");
      expect(made?.kind === "node" && made.definitionId).toBe(
        "lib:definition:type-frame",
      );
      expect(names()).toEqual(["Group"]);
      // (The group is a frame: its element reads under its name once the name is cleared.)
      workspace.execute(
        renameNode({ id: body.children[0] as NodeId, name: "" }),
      );
      expect(names()).toEqual(["Frame"]);
    } finally {
      workspace.dispose();
    }
  });

  // 사용자 보고 2026-11-24: 「button 2개를 group화 후 tag를 nav로 변경시 nav로 나타나지않고 group로
  //   유지된다」 — the name the group command gives is a default like 「Frame」, not the author's.
  it("a group set to an element is named by the element — 「Group」 only while it is a div", async () => {
    const { workspace, names, record } = await open();
    try {
      workspace.selectRecords([record("a"), record("b")]);
      const group = catalogCanvasMenuItems(
        catalogMenuHost(workspace),
        "canvas-element",
        record("a"),
      ).find((item) => item.id === "group");
      if (group?.kind === "action") group.run();
      const graph = workspace.runtime.graph;
      const body = graph.getEntry(BODY);
      if (body?.kind !== "node") throw new Error("Body missing");
      const groupId = body.children[0] as NodeId;
      const target = { kind: "node" as const, id: groupId };
      const element = (value: string) =>
        workspace.execute(
          setFields({
            targets: [target],
            props: { elementType: { kind: "set", value } },
            label: "Edit properties",
          }),
        );
      expect(names()).toEqual(["Group"]);
      element("nav");
      expect(names()).toEqual(["nav"]);
      expect(catalogFrameShownName(graph, target)).toBe("nav");
      // (The node keeps its name: back to a `div` it reads 「Group」 again.)
      element("div");
      expect(names()).toEqual(["Group"]);
      expect(catalogFrameShownName(graph, target)).toBe("Group");
      // (A name the author gave stays over the element.)
      element("nav");
      workspace.execute(renameNode({ id: groupId, name: "Top menu" }));
      expect(names()).toEqual(["Top menu"]);
      expect(catalogFrameShownName(graph, target)).toBe("Top menu");
    } finally {
      workspace.dispose();
    }
  });

  // 리뷰 round 1 m1 (2026-11-24): a frame inside an instance takes its element from the instance's
  // patch — the name is the element of that position, not the template's declared value.
  it("a frame inside an instance is named by the element the instance gives it (Layers · panel title)", async () => {
    const { workspace, library } = await open();
    try {
      const CALENDAR = id("calendar");
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            {
              ...frame("calendar"),
              definitionId: "lib:definition:origin-component-calendar",
            } as NodeEntry,
          ],
          rootIds: [CALENDAR],
          newId: workspace.newId,
        }),
      );
      expect(
        library.definitions.has("lib:definition:origin-component-calendar"),
      ).toBe(true);
      const store = new CatalogLayerTreeStore(
        {
          readModel: workspace.readModel,
          graph: workspace.runtime.graph,
          subscribeSteps: (listener) =>
            workspace.runtime.subscribeSteps(listener),
          boundRows: (position) => workspace.boundRowsOf(position),
          subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
          collectionRowHidden: (position, parentType) =>
            workspace.collectionRowHidden(position, parentType),
        },
        workspace.session.getSnapshot().pageId!,
      );
      store.connect();
      store.setExpanded(new Set(workspace.root.domInputs.keys()));
      const inner = (): CatalogLayerNode | undefined => {
        const find = (
          nodes: readonly CatalogLayerNode[],
        ): CatalogLayerNode | undefined => {
          for (const node of nodes) {
            if (
              node.typeName === "frame" &&
              node.position.target.kind === "descendant" &&
              node.position.target.ownerId === CALENDAR
            )
              return node;
            const found = find(node.children ?? []);
            if (found) return found;
          }
          return undefined;
        };
        return find(store.getSnapshot());
      };
      const row = inner();
      expect(row).toBeDefined();
      const rowId = row!.id;
      const target = row!.position.target;
      const byId = (): CatalogLayerNode | undefined => {
        const find = (
          nodes: readonly CatalogLayerNode[],
        ): CatalogLayerNode | undefined => {
          for (const node of nodes) {
            if (node.id === rowId) return node;
            const found = find(node.children ?? []);
            if (found) return found;
          }
          return undefined;
        };
        return find(store.getSnapshot());
      };
      const before = row!.name;
      expect(catalogFrameNameAt(workspace.runtime.graph, target)).toBe("Frame");
      workspace.execute(
        setFields({
          targets: [target],
          props: { elementType: { kind: "set", value: "header" } },
          label: "Edit properties",
        }),
      );
      // (A slot's role stays the row's name — only a row that read 「Frame」 follows the element.)
      expect(byId()?.name).toBe(before === "Frame" ? "header" : before);
      expect(catalogFrameNameAt(workspace.runtime.graph, target)).toBe(
        "header",
      );
      workspace.undo();
      expect(byId()?.name).toBe(before);
      expect(catalogFrameNameAt(workspace.runtime.graph, target)).toBe("Frame");
      store.dispose();
    } finally {
      workspace.dispose();
    }
  });

  // 리뷰 round 2 m3 (2026-11-24): a slot frame's role is its name before its element — the Layers
  // row and the Design panel title read the same order (name → slot → element → 「Frame」).
  it("a slot frame keeps its slot name over its element — the same in Layers and the panel title", async () => {
    const { workspace } = await open();
    try {
      const POPOVER = id("popover");
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            {
              ...frame("popover"),
              definitionId: "lib:definition:origin-component-popover",
            } as NodeEntry,
          ],
          rootIds: [POPOVER],
          newId: workspace.newId,
        }),
      );
      const store = new CatalogLayerTreeStore(
        {
          readModel: workspace.readModel,
          graph: workspace.runtime.graph,
          subscribeSteps: (listener) =>
            workspace.runtime.subscribeSteps(listener),
          boundRows: (position) => workspace.boundRowsOf(position),
          subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
          collectionRowHidden: (position, parentType) =>
            workspace.collectionRowHidden(position, parentType),
        },
        workspace.session.getSnapshot().pageId!,
      );
      store.connect();
      const rows = (): CatalogLayerNode[] => {
        // (Every row: an overlay body is closed on the Canvas but listed in Layers.)
        const all: CatalogLayerNode[] = [];
        const expand = new Set<string>();
        for (let pass = 0; pass < 8; pass += 1) {
          all.length = 0;
          const walk = (nodes: readonly CatalogLayerNode[]) => {
            for (const node of nodes) {
              all.push(node);
              expand.add(node.id);
              walk(node.children ?? []);
            }
          };
          walk(store.getSnapshot());
          store.setExpanded(new Set(expand));
        }
        return all;
      };
      const slotRow = rows().find(
        (node) => node.typeName === "frame" && node.slot === "content",
      );
      expect(slotRow).toBeDefined();
      const target = slotRow!.position.target;
      const graph = workspace.runtime.graph;
      expect(slotRow!.name).toBe("content");
      expect(catalogFrameShownName(graph, target)).toBe("content");
      workspace.execute(
        setFields({
          targets: [target],
          props: { elementType: { kind: "set", value: "header" } },
          label: "Edit properties",
        }),
      );
      // (The element is in effect — the name is still the slot's.)
      expect(catalogFrameNameAt(graph, target)).toBe("header");
      expect(rows().find((node) => node.id === slotRow!.id)?.name).toBe(
        "content",
      );
      expect(catalogFrameShownName(graph, target)).toBe("content");
      store.dispose();
    } finally {
      workspace.dispose();
    }
  });
});
