import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { DataChange } from "@composition/shared";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  tableHeaderColumns,
  tableHeaderPosition,
} from "../../../../../../packages/shared/src/catalog/commands";
import { createCatalogQuickConnectHost } from "../../panels/datatable/usage/catalogQuickConnectHost";
import { useDataStore } from "../../stores/data";
import { bindCatalogDataStore } from "../catalogDataStore";
import { catalogBindingRef } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4e quick connect: from the Properties Data row, create a table and connect the
 * selected node — the collection (data store) and the document part (Table columns + typed binding)
 * are one history entry.
 */
const ROUTE = "quickconnect";
const PROJECT = `project:project:${ROUTE}` as EntryId<"project">;
const HOME = "project:page:home";
const BODY = "project:node:home-body" as NodeId;
const TABLE = "project:node:table" as NodeId;
const LIST = "project:node:list" as NodeId;
const node = (id: NodeId, definitionId: string): NodeEntry => ({
  kind: "node",
  id,
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const schema = [
  { id: "f-name", key: "name", type: "string" },
  { id: "f-email", key: "email", type: "email", label: "E-mail" },
];

/**
 * ADR-286: the real data store bound to the workspace — the collection is a document entry, so
 * create + connect is one document step.
 */
function boundStore() {
  return {
    get collections() {
      return useDataStore.getState().collections;
    },
    apply: (change: DataChange, options: { document?: readonly unknown[] }) =>
      useDataStore.getState().applyDataChange(change, options),
    collection: (id: string) => useDataStore.getState().collections.get(id),
  };
}

async function open() {
  const store = boundStore();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "QC" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-qc-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  useDataStore.getState().reset();
  bindCatalogDataStore(workspace);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(TABLE, "lib:definition:origin-component-table"),
        node(LIST, "lib:definition:type-ListBox"),
      ],
      rootIds: [TABLE, LIST],
      newId: workspace.newId,
    }),
  );
  const host = createCatalogQuickConnectHost(
    workspace,
    store,
    (name) => `Create table and connect — ${name}`,
  );
  const identity = (id: NodeId) => workspace.root.recordsOfSource(id)[0]!;
  const graph = workspace.runtime.graph;
  const bindingOf = (id: NodeId) => {
    const entry = graph.getEntry(id);
    return entry?.kind === "node" ? entry.binding : undefined;
  };
  const columns = () =>
    tableHeaderColumns(graph, tableHeaderPosition(graph, TABLE)!).map(
      (column) => column.key,
    );
  return { workspace, host, store, identity, graph, bindingOf, columns };
}

const input = {
  name: "Users",
  project_id: ROUTE,
  schema,
  mockData: [{ name: "a", email: "a@x" }],
  useMockData: true,
} as never;

describe("ADR-248 Phase 4e-4e quick connect (catalog)", () => {
  it("captures the selected node, plans the Table's header columns", async () => {
    const { host, identity } = await open();
    const target = host.capture(identity(TABLE))!;
    expect(target).toMatchObject({
      elementId: TABLE,
      pageId: HOME,
      elementType: "Table",
      elementLabel: "Table",
      binding: {},
    });
    const plan = host.planColumns(target)!;
    expect(plan.instance).toBe(true);
    // ADR-277: the Table origin's header starts with the starter columns (Name · Type · Status —
    // their keys read nothing from a schema, so the first connect replaces them).
    expect(plan.existing.map((column) => column.key)).toEqual([
      "name",
      "type",
      "status",
    ]);
    expect(host.planColumns(host.capture(identity(LIST))!)).toBeNull();
    expect(host.precheck(target, ROUTE)).toEqual({ ok: true });
    expect(host.precheck(target, "other")).toEqual({
      ok: false,
      reason: "context",
    });
  });

  it("create + connect (replace columns) is one history entry; undo and redo take both sides", async () => {
    const { workspace, host, store, identity, bindingOf, columns } =
      await open();
    workspace.selectRecords([identity(TABLE)]);
    const target = host.capture(identity(TABLE))!;
    const depth = workspace.runtime.historyDepth.undo;
    const before = columns();
    const created = await host.execute({
      input,
      target,
      projectId: ROUTE,
      replaceColumns: true,
    });
    expect(store.collections.has(created.id)).toBe(true);
    expect(host.readBack(TABLE, created.id)).toBe(true);
    expect(columns()).toEqual(["name", "email"]);
    // The connected Table stays selected.
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: TABLE }]);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(workspace.runtime.historyLabels.undo.at(-1)).toBe(
      "Create table and connect — Users",
    );
    workspace.undo();
    await workspace.runtime.settled();
    expect(bindingOf(TABLE)).toBeUndefined();
    expect(columns()).toEqual(before);
    expect(store.collections.has(created.id)).toBe(false);
    workspace.redo();
    await workspace.runtime.settled();
    expect(host.readBack(TABLE, created.id)).toBe(true);
    expect(columns()).toEqual(["name", "email"]);
    expect(store.collections.has(created.id)).toBe(true);
  });

  it("a node without a Table header takes the binding only", async () => {
    const { host, identity, bindingOf } = await open();
    const created = await host.execute({
      input,
      target: host.capture(identity(LIST))!,
      projectId: ROUTE,
    });
    expect(bindingOf(LIST)).toEqual({
      collectionId: `data:collection:${created.id}`,
      fieldMap: {},
    });
  });

  it("a binding changed after the capture: nothing is written (no collection, no entry)", async () => {
    const { workspace, host, store, identity, bindingOf } = await open();
    const target = host.capture(identity(LIST))!;
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: LIST }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "other",
          name: "",
        })!,
      ),
    );
    const depth = workspace.runtime.historyDepth.undo;
    await expect(
      host.execute({ input, target, projectId: ROUTE }),
    ).rejects.toThrow(/binding-changed/);
    expect(store.collections.size).toBe(0);
    expect(workspace.runtime.historyDepth.undo).toBe(depth);
    expect(bindingOf(LIST)?.collectionId).toBe("data:collection:other");
  });
});
