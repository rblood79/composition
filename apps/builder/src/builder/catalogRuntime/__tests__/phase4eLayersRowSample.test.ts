import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DataBindingRef,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  insertNodes,
  insertTableColumns,
  setFields,
  tableHeaderPosition,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e: the Layers rows of a bound collection follow what the Canvas draws — the rows of
 * the record that holds them (a TagGroup's TagList, a Table's body, not only the bound node's own
 * children), the sample the Canvas draws (a list growing with its rows shows 10) and the rest as
 * one "+N more" row that selects the list (as the Canvas hatch does). A row with no document
 * position (a Table's data row) selects the row holding it.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const BINDING: DataBindingRef = {
  collectionId: "data:collection:c1" as DataBindingRef["collectionId"],
  fieldMap: {},
};
const rowsOf = (count: number): CatalogBoundRow[] =>
  Array.from({ length: count }, (_, index) => ({
    key: `r${index}`,
    values: {
      id: `r${index}`,
      label: `Row ${index}`,
      name: `Row ${index}`,
      description: "",
      icon: "",
      value: `r${index}`,
    },
  }));

async function open(type: string, rows: CatalogBoundRow[]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:layer-sample" as EntryId<"project">,
        name: "Layer sample",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e-layer-sample-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: { rowSample: 10, rows: () => rows },
    },
  );
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
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          ...node(LIST, catalogPaletteDefinitionId(library, type)),
          binding: BINDING,
        },
      ],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  if (type === "Table") {
    workspace.execute(
      insertTableColumns({
        header: tableHeaderPosition(workspace.runtime.graph, LIST)!,
        columns: [{ key: "name", label: "Name" }],
        replace: false,
        buildColumn: () => {
          const id = workspace.newId("node") as NodeId;
          return {
            entries: [node(id, "lib:definition:origin-component-table-column")],
            rootId: id,
          };
        },
        buildCell: () => {
          const id = workspace.newId("node") as NodeId;
          return {
            entries: [node(id, "lib:definition:type-Cell")],
            rootId: id,
          };
        },
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        props: { heightMode: { kind: "set", value: "auto" } },
      }),
    );
  }
  return workspace;
}

/** The Layers tree with every record row expanded. */
function layers(workspace: CatalogWorkspace) {
  const store = new CatalogLayerTreeStore(
    {
      readModel: workspace.readModel,
      graph: workspace.runtime.graph,
      subscribeSteps: (listener) => workspace.runtime.subscribeSteps(listener),
      boundRows: (position) => workspace.boundRowsOf(position),
      subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
    },
    workspace.session.getSnapshot().pageId!,
  );
  store.setExpanded(new Set(workspace.root.domInputs.keys()));
  const all = (nodes: readonly CatalogLayerNode[]): CatalogLayerNode[] =>
    nodes.flatMap((node) => [node, ...all(node.children ?? [])]);
  return () => all(store.getSnapshot());
}
/** The rows under the first row of a type: [name, projection]. */
const childrenOf = (nodes: CatalogLayerNode[], typeName: string) =>
  (nodes.find((node) => node.typeName === typeName)?.children ?? []).map(
    (child) => [child.name, child.projection ?? false] as const,
  );
const sampleView = (count: number, more?: number) => [
  ...Array.from({ length: count }, (_, index) => [`Row ${index}`, true]),
  ...(more ? [[`+${more} more`, true]] : []),
];

describe("ADR-248 4e Layers row sample", () => {
  it("a list growing with its rows lists the 10 drawn rows and one '+N more' row selecting the list", async () => {
    const workspace = await open("ListBox", rowsOf(15));
    const nodes = layers(workspace)();
    expect(childrenOf(nodes, "ListBox")).toEqual(sampleView(10, 5));
    const more = nodes.find((node) => node.name === "+5 more")!;
    const [list] = workspace.root.recordsOfSource(LIST);
    expect(more.selects).toBe(list);
    workspace.dispose();
  });

  it("a list of 10 rows has no '+N more' row", async () => {
    const workspace = await open("GridList", rowsOf(10));
    expect(childrenOf(layers(workspace)(), "GridList")).toEqual(sampleView(10));
    workspace.dispose();
  });

  it("a TagGroup lists its data tags under the TagList", async () => {
    const workspace = await open("TagGroup", rowsOf(3));
    expect(childrenOf(layers(workspace)(), "TagList")).toEqual(sampleView(3));
    workspace.dispose();
  });

  it("an auto Table lists its data rows (named by the first cell) under the body, sampled", async () => {
    const workspace = await open("Table", rowsOf(12));
    const nodes = layers(workspace)();
    expect(childrenOf(nodes, "TableBody")).toEqual(sampleView(10, 2));
    // A data row has no document position (the Table draws it from the data): it selects the body.
    const body = nodes.find((node) => node.typeName === "TableBody")!;
    expect(body.children!.every((row) => row.selects === body.id)).toBe(true);
    workspace.dispose();
  });
});
