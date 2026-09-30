import "fake-indexeddb/auto";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DataBindingValue } from "@composition/shared";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type { DataTable } from "../../../types/builder/data.types";
import { createCatalogDataUsageSource } from "../../panels/datatable/usage/catalogDataUsageSource";
import {
  catalogBindingRef,
  catalogBindingValue,
  catalogCollectionUsage,
} from "../dataBinding";
import {
  catalogEditContract,
  catalogPropertiesPatchCommand,
} from "../editContract";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4e Data (document side): the Properties binding picker writes the node's typed
 * `binding` (references `data:collection:…` · `data:field:…`, H1 — the collection stays in the
 * data store), and the Data surfaces count usage from the graph's collection index.
 */
const PROJECT = "project:project:data" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  props: NodeEntry["props"] = {},
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props,
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const collection: DataTable = {
  id: "c7f1a2b3-0000-4000-8000-000000000001",
  name: "Users",
  project_id: "p",
  schema: [
    { id: "f-name", key: "name", type: "string" },
    { id: "f-email", key: "email", type: "email" },
  ],
  mockData: [],
  useMockData: true,
} as unknown as DataTable;
const binding = (fieldMap?: Record<string, string>): DataBindingValue => ({
  source: "dataTable",
  collectionId: collection.id,
  name: collection.name,
  ...(fieldMap ? { fieldMap } : {}),
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Data" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-data-${Math.random()}`),
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
        node("list", "lib:definition:type-ListBox", {}, [id("label")]),
        node("label", "lib:definition:text", {
          children: { kind: "set", value: "{email}" },
        }),
        node("other", "lib:definition:type-ListBox"),
      ],
      rootIds: [id("list"), id("other")],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const target = { kind: "node", id: id("list") } as const;
  const bindingKeys = new Set(
    catalogEditContract(graph, workspace.readModel, target)
      .fields.filter((field) => field.kind === "binding")
      .map((field) => field.key),
  );
  const patch = (
    patchValue: Record<string, unknown>,
    targets = [target] as const,
  ) =>
    catalogPropertiesPatchCommand(
      graph,
      targets,
      patchValue,
      (key) => workspace.readModel.propSource(targets[0]!, key).value,
      bindingKeys,
    );
  return { workspace, graph, target, bindingKeys, patch };
}

describe("ADR-248 Phase 4e-4e Data binding", () => {
  it("the picker value and the binding reference convert both ways; the document refuses what it cannot hold", () => {
    const ref = catalogBindingRef(binding({ value: "f-name" }));
    expect(ref).toEqual({
      collectionId: `data:collection:${collection.id}`,
      fieldMap: { value: "data:field:f-name" },
    });
    expect(catalogBindingValue(ref!, "Users")).toEqual(
      binding({ value: "f-name" }),
    );
    expect(catalogBindingRef(undefined)).toBeUndefined();
    expect(
      catalogBindingRef({ source: "api", name: "legacy" } as DataBindingValue),
    ).toBeNull();
    expect(
      catalogBindingRef({ ...binding(), collectionId: "has space" }),
    ).toBeNull();
  });

  it("the binding field writes the node's typed binding as one step (with a prop in the same patch); clear and undo", async () => {
    const { workspace, graph, target, bindingKeys, patch } = await open();
    expect([...bindingKeys]).toEqual(["dataBinding"]);
    const read = () =>
      catalogEditContract(graph, workspace.readModel, target).fields.find(
        (field) => field.key === "dataBinding",
      );
    expect(read()).toMatchObject({ isOverridden: false });
    expect(read()!.currentValue).toBeUndefined();
    const start = graph.revision;
    workspace.execute(patch({ dataBinding: binding({ value: "f-name" }) })!);
    expect(graph.revision).toBe(start + 1);
    const entry = graph.getEntry(id("list"));
    expect(entry?.kind === "node" && entry.binding).toEqual({
      collectionId: `data:collection:${collection.id}`,
      fieldMap: { value: "data:field:f-name" },
    });
    expect(entry?.kind === "node" && entry.props.dataBinding).toBeUndefined();
    expect(read()).toMatchObject({
      isOverridden: true,
      currentValue: { source: "dataTable", collectionId: collection.id },
    });
    // The field's value source reads the same binding (the picker shows the collection).
    expect(workspace.readModel.bindingValue(target)).toMatchObject({
      collectionId: collection.id,
      fieldMap: { value: "f-name" },
    });
    // The same value again changes nothing.
    expect(
      patch({ dataBinding: binding({ value: "f-name" }) }),
    ).toBeUndefined();
    // A binding and a prop together: one step.
    workspace.execute(
      patch({
        dataBinding: binding(),
        selectionMode: "multiple",
      })!,
    );
    expect(graph.revision).toBe(start + 2);
    const both = graph.getEntry(id("list"));
    expect(both?.kind === "node" && both.binding?.fieldMap).toEqual({});
    expect(both?.kind === "node" && both.props.selectionMode).toEqual({
      kind: "set",
      value: "multiple",
    });
    // A non-table value is refused (nothing written).
    expect(() =>
      workspace.execute(
        patch({ dataBinding: { source: "api", name: "legacy" } })!,
      ),
    ).toThrow(expect.objectContaining({ code: "UNSUPPORTED_BINDING" }));
    expect(graph.revision).toBe(start + 2);
    workspace.execute(patch({ dataBinding: undefined })!);
    const cleared = graph.getEntry(id("list"));
    expect(cleared?.kind === "node" && cleared.binding).toBeUndefined();
    workspace.undo();
    workspace.undo();
    workspace.undo();
    const back = graph.getEntry(id("list"));
    expect(back?.kind === "node" && back.binding).toBeUndefined();
  });

  it("usage: collection counts from the index; a field's users are the bound node's fieldMap and templates below it", async () => {
    const { workspace, graph, patch } = await open();
    expect(catalogCollectionUsage(graph, [collection.id]).size).toBe(0);
    workspace.execute(patch({ dataBinding: binding({ value: "f-name" }) })!);
    workspace.execute(
      patch({ dataBinding: binding() }, [
        { kind: "node", id: id("other") },
      ] as const)!,
    );
    expect(catalogCollectionUsage(graph, [collection.id])).toEqual(
      new Map([[collection.id, 2]]),
    );
    const source = createCatalogDataUsageSource(workspace);
    const name = collection.schema[0]!;
    const email = collection.schema[1]!;
    const { result } = renderHook(() => ({
      usage: source.useCollectionUsage([collection]),
      name: source.useFieldUsage(collection, name),
      email: source.useFieldUsage(collection, email),
    }));
    expect(result.current.usage.get(collection.id)).toBe(2);
    expect(result.current.name).toEqual([
      {
        id: id("list"),
        type: "lib:definition:type-ListBox",
        reason: "fieldMap",
      },
    ]);
    expect(result.current.email.map((ref) => [ref.id, ref.reason])).toEqual([
      [id("label"), "template"],
    ]);
    // Re-read at the next step.
    act(() => {
      workspace.undo();
    });
    expect(result.current.usage.get(collection.id)).toBe(1);
  });
});
