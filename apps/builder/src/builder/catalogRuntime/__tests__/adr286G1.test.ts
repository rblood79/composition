import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { DataOp } from "@composition/shared";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setSiteSettings,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CATALOG_DB_NAME } from "../../../../../../packages/shared/src/catalog/runtime/storage";
import { useDataStore } from "../../stores/data";
import { collectCatalogDurableAssetRoots } from "../assetGc";
import {
  bindCatalogDataStore,
  catalogCollectionTables,
  catalogProjectVariableDefs,
} from "../catalogDataStore";
import { catalogBoundRows } from "../dataBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-286 G1 — the data definitions are document entries: no IndexedDB data store in the Builder,
 * every `DataChange` op is one document step that undo takes back (store and document both), a
 * collection step redraws the lists bound to it in the same step (R8), and an asset only the site
 * settings name stays a GC root.
 */
const SRC = resolve(__dirname, "../../..");
const ROUTE = "g1";
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      sources(path, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name))
      out.push(path);
  }
  return out;
}

async function open(factory: IDBFactory = new IDBFactory()) {
  const library = await buildCodeCatalogLibrary();
  const document = newCatalogProjectDocument({
    projectId: `project:project:${ROUTE}` as EntryId<"project">,
    name: "G1",
  });
  const storage = new CatalogStorage(factory, CATALOG_DB_NAME);
  await storage.create(document, library);
  const graph = new CatalogGraph(document, library);
  const workspace = new CatalogWorkspace(graph, storage, {
    engine: await nodeLayoutEngine(),
    viewport: { width: 1200, height: 800 },
    autosaveSchedule: () => {},
    root: {
      // The Builder's wiring (CatalogBuilderCore).
      rows: (binding, kind) =>
        catalogBoundRows(binding, catalogCollectionTables(graph), kind),
      state: { projectVariables: () => catalogProjectVariableDefs(graph) },
    },
  });
  useDataStore.getState().reset();
  bindCatalogDataStore(workspace);
  return workspace;
}

const sortedEntries = (workspace: CatalogWorkspace) =>
  JSON.stringify(
    Object.entries(workspace.runtime.graph.exportDocument().entries).sort(
      ([a], [b]) => a.localeCompare(b),
    ),
  );
/** The store's definitions as the document holds them (runtime rows aside). */
const storeView = () => {
  const { collections, apiEndpoints, variables } = useDataStore.getState();
  return JSON.stringify({
    collections: [...collections.values()],
    endpoints: [...apiEndpoints.values()],
    variables: [...variables.values()],
  });
};

describe("ADR-286 G1", () => {
  it("R1: Builder 소스에 IDB 데이터 정의 store 참조 0 · data store 의 정의 Map 직접 set 0 (투영만)", () => {
    const hits: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, "utf8");
      const rel = file.slice(SRC.length + 1);
      for (const pattern of [
        /\bdb\.(collections|api_endpoints|variables)\b/,
        /objectStore\(\s*["'](collections|api_endpoints|variables)["']/,
        /["'](collections|api_endpoints|variables)["']\s*\)\s*;?\s*$/m,
        /createObjectStore\(\s*["'](collections|api_endpoints|variables)["']/,
      ])
        if (pattern.test(text)) hits.push(`${rel} ${pattern}`);
      // The definitions' maps are written by the projection only.
      // (`setRuntimeRows` merges API rows into the projected tables — not a definition write.)
      if (
        rel !== "builder/catalogRuntime/catalogDataStore.ts" &&
        rel !== "builder/stores/utils/dataActions.ts" &&
        /set\(\{[^}]*\b(collections|apiEndpoints|variables):/.test(text) &&
        /stores\/|datatable\//.test(rel)
      )
        hits.push(`${rel} store definition set`);
    }
    expect(hits).toEqual([]);
  });

  it("DataChange op 마다 문서 step 하나 · store = 문서 투영 · Undo 한 번에 둘 다 원상", async () => {
    const workspace = await open();
    const apply = (ops: DataOp[]) =>
      useDataStore.getState().applyDataChange({ ops, origin: "user" });
    const steps: DataOp[][] = [
      [
        {
          op: "create_collection",
          id: "users",
          name: "Users",
          schema: [{ id: "f-name", key: "name", type: "string" }],
          rows: [{ name: "Ada" }, { name: "Bo" }],
        },
      ],
      [
        {
          op: "update_collection",
          collectionId: "users",
          patch: { name: "People" },
        },
      ],
      [
        {
          op: "add_field",
          collectionId: "users",
          field: { id: "f-age", key: "age", type: "number" },
        },
      ],
      [
        {
          op: "update_field",
          collectionId: "users",
          fieldId: "f-name",
          patch: { key: "fullName" },
        },
      ],
      [
        {
          op: "set_cell",
          collectionId: "users",
          rowIndex: 0,
          fieldId: "f-age",
          value: 36,
        },
      ],
      [
        {
          op: "insert_rows",
          collectionId: "users",
          rows: [{ fullName: "Cy" }],
        },
      ],
      [{ op: "remove_rows", collectionId: "users", rowIndexes: [1] }],
      [
        {
          op: "replace_rows",
          collectionId: "users",
          rows: [{ fullName: "Di" }],
        },
      ],
      [{ op: "remove_field", collectionId: "users", fieldId: "f-age" }],
      [
        {
          op: "set_execution_policy",
          collectionId: "users",
          policy: { mode: "interval", intervalSec: 30 },
        },
      ],
      [
        {
          op: "define_endpoint",
          endpoint: {
            id: "get-users",
            name: "getUsers",
            method: "GET",
            baseUrl: "https://api.example.com",
            path: "/users",
            targetCollectionId: "users",
          },
        },
      ],
      [
        {
          op: "set_source",
          collectionId: "users",
          source: "api",
          endpointId: "get-users",
        },
      ],
      [
        {
          op: "define_variable",
          variableId: "greeting",
          definition: { name: "greeting", type: "string", defaultValue: "hi" },
        },
      ],
      [{ op: "delete_endpoint", endpointId: "get-users" }],
      [{ op: "define_variable", variableId: "greeting", definition: null }],
      [{ op: "delete_collection", collectionId: "users" }],
    ];
    for (const ops of steps) {
      const before = storeView();
      const document = sortedEntries(workspace);
      const depth = workspace.runtime.historyDepth.undo;
      await apply(ops);
      expect([ops[0]!.op, workspace.runtime.historyDepth.undo]).toEqual([
        ops[0]!.op,
        depth + 1,
      ]);
      // The store is the document's projection after the step.
      const projected = storeView();
      useDataStore.getState().reset();
      const { projectCatalogData } = await import("../catalogDataStore");
      projectCatalogData(workspace.runtime.graph);
      expect([ops[0]!.op, storeView()]).toEqual([ops[0]!.op, projected]);
      workspace.undo();
      expect([ops[0]!.op, storeView()]).toEqual([ops[0]!.op, before]);
      expect([ops[0]!.op, sortedEntries(workspace)]).toEqual([
        ops[0]!.op,
        document,
      ]);
      workspace.redo();
      expect([ops[0]!.op, storeView()]).toEqual([ops[0]!.op, projected]);
    }
    expect(useDataStore.getState().collections.size).toBe(0);
  });

  it("R8: mock 행 편집 step 의 consume plan 이 바인딩 목록을 다시 그린다 (store 구독 없이) · Undo 도 같은 경로", async () => {
    const workspace = await open();
    await useDataStore.getState().applyDataChange({
      ops: [
        {
          op: "create_collection",
          id: "tags",
          name: "Tags",
          schema: [{ id: "f-tag", key: "tag", type: "string" }],
          rows: [{ tag: "a" }],
        },
      ],
      origin: "user",
    });
    const list: NodeEntry = {
      kind: "node",
      id: LIST,
      definitionId:
        "lib:definition:origin-component-listbox" as NodeEntry["definitionId"],
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      binding: { collectionId: "data:collection:tags", fieldMap: {} },
    };
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [list],
        rootIds: [LIST],
        newId: workspace.newId,
      }),
    );
    const rowCount = () =>
      workspace.root.canvasInputs.get(workspace.root.recordsOfSource(LIST)[0]!)
        ?.rowCount;
    expect(rowCount()).toBe(1);
    await useDataStore.getState().applyDataChange({
      ops: [
        {
          op: "insert_rows",
          collectionId: "tags",
          rows: [{ tag: "b" }, { tag: "c" }],
        },
      ],
      origin: "user",
    });
    expect(rowCount()).toBe(3);
    workspace.undo();
    expect(rowCount()).toBe(1);
  });

  it("site 에만 참조된 자산은 GC root 에 있다 (catalog 저장 entry)", async () => {
    const factory = new IDBFactory();
    const workspace = await open(factory);
    const hash = "a".repeat(64);
    workspace.execute(
      setSiteSettings({
        patch: { favicon: { light: `asset:sha256-${hash}` } },
      }),
    );
    await workspace.runtime.save();
    const roots = JSON.stringify(
      await collectCatalogDurableAssetRoots(factory),
    );
    expect(roots).toContain(`asset:sha256-${hash}`);
  });
});
