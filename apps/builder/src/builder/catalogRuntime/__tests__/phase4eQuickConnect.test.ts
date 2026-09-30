import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { DataChange, DataOp } from "@composition/shared";
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
import type { DataTable } from "../../../types/builder/data.types";
import { createCatalogQuickConnectHost } from "../../panels/datatable/usage/catalogQuickConnectHost";
import { catalogBindingCommand, catalogBindingRef } from "../dataBinding";
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

/** The data store stand-in: collections created / deleted by ops. */
function fakeStore(options: { onApply?: () => void } = {}) {
  const collections = new Map<string, DataTable>();
  return {
    collections,
    async apply(change: DataChange, _options: { record: false }) {
      await Promise.resolve();
      options.onApply?.();
      const inverse: DataOp[] = [];
      for (const op of change.ops) {
        if (op.op === "create_collection") {
          const id = op.id!;
          collections.set(id, {
            id,
            name: op.name,
            project_id: op.projectId,
            schema: op.schema,
            mockData: op.rows,
            useMockData: true,
          } as unknown as DataTable);
          inverse.push({ op: "delete_collection", collectionId: id });
        } else if (op.op === "delete_collection") {
          collections.delete(op.collectionId);
        }
      }
      return { applied: change.ops, inverse };
    },
    collection: (id: string) => collections.get(id),
  };
}

async function open(store = fakeStore()) {
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
    // The Table origin's header starts without columns (they come from the schema).
    expect(plan.existing).toEqual([]);
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

  it("a binding changed while the collection saves: nothing stays (collection removed, no entry)", async () => {
    let change: (() => void) | undefined;
    const store = fakeStore({ onApply: () => change?.() });
    const { workspace, host, identity, bindingOf } = await open(store);
    const target = host.capture(identity(LIST))!;
    change = () => {
      change = undefined;
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
    };
    const depth = workspace.runtime.historyDepth.undo;
    await expect(
      host.execute({ input, target, projectId: ROUTE }),
    ).rejects.toThrow(/binding-changed/);
    expect(store.collections.size).toBe(0);
    // Only the concurrent edit is in history.
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(bindingOf(LIST)?.collectionId).toBe("data:collection:other");
  });
});
