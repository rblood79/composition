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
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-6-36: the Layers rows of a bound ListBox/GridList are its drawn data rows (the
 * old Layers' "Rows" projection): each row is the row's record, named by its label, selecting it
 * selects that row (the row template position's target); the document's item positions (row
 * template and sample items the Canvas does not draw) are not listed, and the rows are neither
 * draggable nor deletable. Unbound or rows unknown: the item positions as before.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const BINDING: DataBindingRef = {
  collectionId: "data:collection:c1" as DataBindingRef["collectionId"],
  fieldMap: {},
};
const row = (
  key: string,
  label: string,
  description = "",
): CatalogBoundRow => ({
  key,
  values: { id: key, label, description, icon: "", value: key },
});

async function open(type: string, bound = true) {
  const library = await buildCodeCatalogLibrary();
  let rows: CatalogBoundRow[] | undefined = [
    row("a", "Alpha", "first"),
    row("b", "Beta", "second"),
  ];
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:rows" as EntryId<"project">,
        name: "Rows",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-rows-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rows: (binding) =>
          binding.collectionId === BINDING.collectionId ? rows : undefined,
      },
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: LIST,
    definitionId: catalogPaletteDefinitionId(library, type),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...(bound ? { binding: BINDING } : {}),
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  return {
    workspace,
    setRows: (next: CatalogBoundRow[] | undefined) => {
      rows = next;
    },
  };
}

function layers(workspace: CatalogWorkspace) {
  const page = workspace.session.getSnapshot().pageId!;
  const store = new CatalogLayerTreeStore(
    {
      readModel: workspace.readModel,
      graph: workspace.runtime.graph,
      subscribeSteps: (listener) => workspace.runtime.subscribeSteps(listener),
      boundRows: (position) => workspace.boundRowsOf(position),
      subscribeBoundRows: (listener) => workspace.subscribeRows(listener),
    },
    page,
  );
  const [list] = workspace.root.recordsOfSource(LIST);
  store.setExpanded(new Set([workspace.root.recordsOfSource(BODY)[0]!, list!]));
  const listRow = () => {
    const find = (
      nodes: readonly CatalogLayerNode[],
    ): CatalogLayerNode | undefined => {
      for (const node of nodes) {
        if (node.id === list) return node;
        const inner = find(node.children ?? []);
        if (inner) return inner;
      }
      return undefined;
    };
    return find(store.getSnapshot())!;
  };
  return { store, listRow };
}
const view = (node: CatalogLayerNode) =>
  (node.children ?? []).map((child) => [child.name, child.projection ?? false]);

describe("ADR-248 Phase 4e-6-36 Layers bound rows", () => {
  it("lists a bound ListBox's data rows as its rows, each the row's record", async () => {
    const { workspace } = await open("ListBox");
    const { listRow } = layers(workspace);
    expect(view(listRow())).toEqual([
      ["Alpha", true],
      ["Beta", true],
    ]);
    // A row is the drawn row's record: selecting it selects that row on the Canvas.
    const [first, second] = listRow().children!;
    workspace.selectRecords([second!.id]);
    expect(workspace.session.getSnapshot().selection[0]).toMatchObject({
      identity: second!.id,
      target: first!.position.target,
    });
  });

  it("follows a data change; unbound or unknown rows list the item positions", async () => {
    const { workspace, setRows } = await open("GridList");
    const { listRow } = layers(workspace);
    expect(view(listRow())).toEqual([
      ["Alpha", true],
      ["Beta", true],
    ]);
    setRows([row("c", "Gamma")]);
    workspace.refreshRows(["c1"]);
    expect(view(listRow())).toEqual([["Gamma", true]]);
    setRows(undefined);
    workspace.refreshRows(["c1"]);
    expect(view(listRow()).every(([, projection]) => !projection)).toBe(true);
    expect(view(listRow()).length).toBeGreaterThan(1);

    const plain = await open("ListBox", false);
    expect(
      view(layers(plain.workspace).listRow()).map(([name]) => name),
    ).toEqual(["ListBoxItem", "ListBoxItem", "ListBoxItem"]);
  });
});
