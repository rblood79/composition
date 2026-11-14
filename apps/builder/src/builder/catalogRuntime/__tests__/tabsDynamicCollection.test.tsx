// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  editItems,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  ItemValue,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogCreationProps } from "../paletteInsert";
import { CatalogLayerTreeStore } from "../layerTree";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

it("one item list drives tabs and panels through add, edit, reorder, removal and reload", async () => {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:dynamic-tabs",
      name: "Dynamic tabs",
    }),
    library,
  );
  const storage = new CatalogStorage(
    indexedDB,
    `dynamic-tabs-${Math.random()}`,
  );
  await storage.create(graph.exportDocument(), library);
  const workspace = new CatalogWorkspace(graph, storage, {
    engine: await nodeLayoutEngine(),
    viewport: { width: 800, height: 600 },
    autosaveSchedule: () => {},
  });
  const id = "project:node:tabs" as const;
  const items: ItemValue[] = [
    { id: "a", title: "Alpha", content: "Alpha body" },
    { id: "b", title: "Beta", content: "Beta body" },
    { id: "c", title: "Gamma", content: "Gamma body" },
  ];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id,
          definitionId: "lib:definition:origin-component-tabs",
          children: [],
          props: {
            items: { kind: "set", value: items },
            defaultSelectedKey: { kind: "set", value: "b" },
          },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const layers = new CatalogLayerTreeStore(
    {
      graph,
      readModel: workspace.readModel,
      subscribeSteps: (listener) => workspace.runtime.subscribeSteps(listener),
      boundRows: (position) => workspace.boundRowsOf(position),
      subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
    },
    workspace.session.getSnapshot().pageId!,
  );
  layers.connect();
  layers.setExpanded(new Set(root.canvasInputs.keys()));
  const panelLayers = () =>
    layers
      .node(root.recordsOfSource(id)[0]!)!
      .children!.filter((child) => child.typeName === "TabPanel");
  const nodes = (type: string) => {
    const records = root.canvasInputs;
    const visit = (key: string): CatalogConsumerNode[] => {
      const node = records.get(key)!;
      return [node, ...node.children.flatMap(visit)];
    };
    return visit(root.recordsOfSource(id)[0]!).filter(
      (node) => root.typeOf(node) === type,
    );
  };
  const keys = () => nodes("Tab").map((node) => node.props.id);
  const html = () =>
    renderToStaticMarkup(renderCatalogDom(root, root.recordsOfSource(id)[0]!));
  const edit = (change: Parameters<typeof editItems>[0]["edit"]) =>
    workspace.execute(
      editItems({ target: { kind: "node", id }, key: "items", edit: change }),
    );
  try {
    expect(keys()).toEqual(["a", "b", "c"]);
    expect(root.rowRemainders().size).toBe(0);
    expect(
      workspace.boundRowsOf(
        workspace.positionOfRecord(root.recordsOfSource(id)[0]!)!,
      )?.more,
    ).toBeUndefined();
    expect(nodes("TabPanel").map((node) => node.props.itemId)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(html()).toContain("Beta body");
    expect(html()).not.toContain("Alpha body");
    const betaId = nodes("Tab").find((node) => node.props.id === "b")!.id;
    edit({ kind: "move", id: "b", index: 0 });
    expect(keys()).toEqual(["b", "a", "c"]);
    expect(nodes("Tab")[0]!.id).toBe(betaId);
    edit({
      kind: "update",
      id: "b",
      patch: { title: "Beta edited", content: "Body edited" },
    });
    expect(html()).toContain("Beta edited");
    expect(html()).toContain("Body edited");
    expect(panelLayers().map((node) => node.name)).toEqual([
      "Body edited",
      "Alpha body",
      "Gamma body",
    ]);
    edit({
      kind: "add",
      item: { id: "d", title: "Delta", content: "Delta body" },
    });
    expect(keys()).toEqual(["b", "a", "c", "d"]);
    expect(panelLayers()).toHaveLength(4);
    edit({ kind: "remove", id: "b" });
    expect(keys()).toEqual(["a", "c", "d"]);
    expect(nodes("TabPanel")).toHaveLength(3);
    expect(html()).toContain("Alpha body");
    workspace.undo();
    expect(keys()).toEqual(["b", "a", "c", "d"]);
    workspace.redo();
    await workspace.runtime.save();
    const saved = await storage.load(graph.projectId, library);
    expect(saved).toEqual(graph.exportDocument());
    const reloaded = new CatalogWorkspace(
      new CatalogGraph(saved!, library),
      storage,
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 800, height: 600 },
        autosaveSchedule: () => {},
      },
    );
    try {
      expect(
        renderToStaticMarkup(
          renderCatalogDom(
            reloaded.root,
            reloaded.root.recordsOfSource(id)[0]!,
          ),
        ),
      ).toContain("Alpha body");
      expect(
        [...reloaded.root.canvasInputs.values()]
          .filter((node) => reloaded.root.typeOf(node) === "Tab")
          .map((node) => node.props.id),
      ).toEqual(["a", "c", "d"]);
    } finally {
      reloaded.dispose();
    }
    for (const key of ["a", "c", "d"]) edit({ kind: "remove", id: key });
    expect(nodes("Tab")).toHaveLength(0);
    expect(nodes("TabPanel")).toHaveLength(0);
    expect(panelLayers()).toHaveLength(0);
    expect(html()).not.toContain('role="tabpanel"');
    expect(
      workspace.boundRowsOf(
        workspace.positionOfRecord(root.recordsOfSource(id)[0]!)!,
      ),
    ).toMatchObject({ rows: [], itemType: "TabPanel" });
    expect(
      workspace.boundRowsOf(
        workspace.positionOfRecord(nodes("TabList")[0]!.id)!,
      ),
    ).toMatchObject({ rows: [], itemType: "Tab" });
    edit({
      kind: "add",
      item: { id: "e", title: "Restored", content: "Restored body" },
    });
    expect(keys()).toEqual(["e"]);
    expect(html()).toContain("Restored body");
    for (const record of [
      root.recordsOfSource(id)[0]!,
      nodes("TabList")[0]!.id,
    ]) {
      const choices = catalogItemInsertChoices(
        { graph, readModel: workspace.readModel, newId: workspace.newId },
        workspace.positionOfRecord(record)!,
      );
      workspace.execute(choices[0]!.build());
    }
    expect(keys()).toHaveLength(3);
    expect(new Set(keys()).size).toBe(3);
    expect(nodes("TabPanel")).toHaveLength(3);
    const creation = catalogCreationProps(
      library,
      "lib:definition:origin-component-tabs",
      "Tabs",
    );
    expect(creation.items).toMatchObject({
      kind: "set",
      value: [{ id: "tab-1" }, { id: "tab-2" }, { id: "tab-3" }],
    });
  } finally {
    layers.dispose();
    workspace.dispose();
  }
});

it("external collection rows drive both destinations and refresh to empty", async () => {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:bound-tabs",
      name: "Bound tabs",
    }),
    library,
  );
  let rows: CatalogBoundRow[] = [
    { key: "x", values: { label: "External", content: "External body" } },
    { key: "y", values: { label: "Second", content: "Second body" } },
  ];
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `bound-tabs-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 800, height: 600 },
      autosaveSchedule: () => {},
      root: { rows: () => rows },
    },
  );
  const id = "project:node:tabs" as const;
  try {
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" },
        entries: [
          {
            kind: "node",
            id,
            definitionId: "lib:definition:origin-component-tabs",
            children: [],
            props: {
              items: {
                kind: "set",
                value: [{ id: "local", title: "Local", content: "Local body" }],
              },
            },
            binding: { collectionId: "data:collection:tabs", fieldMap: {} },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [id],
        newId: workspace.newId,
      }),
    );
    const html = () =>
      renderToStaticMarkup(
        renderCatalogDom(
          workspace.root,
          workspace.root.recordsOfSource(id)[0]!,
        ),
      );
    expect(html()).toContain("External body");
    expect(html()).not.toContain("Local");
    rows = [{ key: "z", values: { label: "Fresh", content: "Fresh body" } }];
    workspace.refreshRows();
    expect(html()).toContain("Fresh body");
    expect(html()).not.toContain("External");
    rows = [];
    workspace.refreshRows();
    expect(html()).not.toContain('role="tab"');
    expect(html()).not.toContain('role="tabpanel"');
  } finally {
    workspace.dispose();
  }
});
