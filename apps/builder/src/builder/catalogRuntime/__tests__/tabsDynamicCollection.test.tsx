// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import {
  duplicateNodes,
  insertNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogCreationProps } from "../paletteInsert";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-310 G2 — Tabs items are nodes (A2): a Tab and its TabPanel, paired by key. 「+」 adds both in
 * one step, a delete · duplicate of a Tab takes its panel along, and the saved document holds no
 * `items` list (contract 65's array is gone).
 */
it("ADR-310 G2: Tab + TabPanel nodes — add, undo, delete, duplicate keep every panel paired", async () => {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:node-tabs",
      name: "Node tabs",
    }),
    library,
  );
  const storage = new CatalogStorage(indexedDB, `node-tabs-${Math.random()}`);
  await storage.create(graph.exportDocument(), library);
  const workspace = new CatalogWorkspace(graph, storage, {
    engine: await nodeLayoutEngine(),
    viewport: { width: 800, height: 600 },
    autosaveSchedule: () => {},
  });
  const id = "project:node:tabs" as const;
  const definitionId = "lib:definition:origin-component-tabs" as const;
  const creation = catalogCreationProps(library, definitionId, "Tabs");
  expect(creation).not.toHaveProperty("items");
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id,
          definitionId,
          children: [],
          props: creation,
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
  const keys = () => nodes("Tab").map((node) => String(node.props.id));
  const panels = () =>
    nodes("TabPanel").map((node) => String(node.props.itemId));
  /** Every TabPanel has its Tab, every Tab its TabPanel (the same keys, once each). */
  const paired = () => {
    expect([...panels()].sort()).toEqual([...keys()].sort());
    expect(new Set(keys()).size).toBe(keys().length);
  };
  /** The document position of the Tab with a key (the Tab record's own node). */
  const tabNode = (key: string) =>
    workspace.positionOfRecord(
      nodes("Tab").find((node) => String(node.props.id) === key)!.id,
    )!.target;
  try {
    expect(keys()).toEqual(["tab-1", "tab-2"]);
    paired();
    // The placed Tabs holds its tab list and panels as its own nodes (the origin's root slot).
    for (const record of [
      ...nodes("Tab"),
      ...nodes("TabPanel"),
      ...nodes("TabList"),
    ])
      expect(workspace.positionOfRecord(record.id)!.target.kind).toBe("node");
    const steps = () => workspace.history.getSnapshot().labels.length;
    // 「+」 on the TabList: a Tab and its TabPanel in one step.
    const add = catalogItemInsertChoices(
      { graph, readModel: workspace.readModel, newId: workspace.newId },
      workspace.positionOfRecord(nodes("TabList")[0]!.id)!,
    ).find((choice) => choice.type === "Tab")!;
    const before = steps();
    workspace.execute(add.build());
    expect(steps()).toBe(before + 1);
    expect(keys()).toHaveLength(3);
    paired();
    // One Undo removes both.
    workspace.undo();
    expect(keys()).toEqual(["tab-1", "tab-2"]);
    expect(panels()).toHaveLength(2);
    workspace.redo();
    expect(keys()).toHaveLength(3);
    paired();
    // Duplicating a Tab copies its panel with the copy's new key.
    workspace.execute(
      duplicateNodes({
        ids: [(tabNode("tab-1") as { id: NodeId }).id],
        newId: workspace.newId,
      }),
    );
    expect(keys()).toHaveLength(4);
    paired();
    workspace.undo();
    expect(keys()).toHaveLength(3);
    paired();
    workspace.redo();
    // Deleting a Tab takes its panel.
    workspace.execute(removeTargets({ targets: [tabNode("tab-2")] }));
    expect(keys()).not.toContain("tab-2");
    expect(panels()).not.toContain("tab-2");
    paired();
    workspace.undo();
    expect(keys()).toContain("tab-2");
    paired();
    workspace.redo();
    // The saved document holds no Tabs `items`, and a reload shows the same pairs.
    await workspace.runtime.save();
    const saved = await storage.load(graph.projectId, library);
    expect(saved).toEqual(graph.exportDocument());
    expect(JSON.stringify(saved)).not.toContain('"items"');
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
      const of = (type: string) =>
        [...reloaded.root.canvasInputs.values()].filter(
          (node) => reloaded.root.typeOf(node) === type,
        );
      expect(
        of("Tab")
          .map((node) => String(node.props.id))
          .sort(),
      ).toEqual([...keys()].sort());
      expect(
        of("TabPanel")
          .map((node) => String(node.props.itemId))
          .sort(),
      ).toEqual([...keys()].sort());
    } finally {
      reloaded.dispose();
    }
    // The Tabs edit contract offers no items list.
    expect(
      library.definitions.get("lib:definition:type-Tabs")!.accepts,
    ).not.toHaveProperty("items");
  } finally {
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
            props: {},
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
