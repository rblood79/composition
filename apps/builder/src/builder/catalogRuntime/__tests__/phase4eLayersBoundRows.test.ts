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
  removeTargets,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
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
      collectionRowHidden: (position, parentType) =>
        workspace.collectionRowHidden(position, parentType),
      // (ADR-310: a rows' template with no drawn record — its data is empty — counts 0 rows.)
      recordDrawn: (position) => workspace.root.domInputs.has(position.identity),
    },
    page,
  );
  store.connect();
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
  (node.children ?? []).map((child) => [
    child.name,
    child.repeat ? (child.repeat.count ?? "?") : null,
  ]);

/**
 * ADR-310 Decision 3 (user 2026-11-15): a bound list's Layers rows are its document positions —
 * its static items and its rows' template (the item marked `repeat`), whose row shows the drawn
 * row count; the data rows themselves are not rows of their own (they replaced the template's
 * position until ADR-310).
 */
describe("ADR-310 Layers bound rows — the rows' template row", () => {
  it("lists a bound ListBox's template once, with its row count; a data row's record selects the template's position", async () => {
    const { workspace } = await open("ListBox");
    const { listRow } = layers(workspace);
    // (No EmptyState row: the Canvas does not draw it while there are rows, 2026-10-23.)
    expect(view(listRow())).toEqual([["ListBoxItem", 2]]);
    const [template] = listRow().children!;
    expect(template!.projection).toBeUndefined();
    // The Canvas's second row is the template's record for that row: it selects its position.
    const rowsOf = workspace.root.domInputs;
    const second = [...rowsOf.values()].find((record) => record.rowIndex === 1)!;
    workspace.selectRecords([second.id]);
    expect(workspace.session.getSnapshot().selection[0]).toMatchObject({
      identity: second.id,
      target: template!.position.target,
    });
  });

  it("follows a data change; with its data emptied or unknown the template row stays", async () => {
    const { workspace, setRows } = await open("GridList");
    const { listRow } = layers(workspace);
    expect(view(listRow())).toEqual([["GridListItem", 2]]);
    setRows([row("c", "Gamma")]);
    workspace.refreshRows(["c1"]);
    expect(view(listRow())).toEqual([["GridListItem", 1]]);
    // Its data emptied: the Canvas draws the EmptyState; the template keeps its row to be edited.
    setRows([]);
    workspace.refreshRows(["c1"]);
    expect(view(listRow())).toEqual([
      ["GridListItem", 0],
      ["EmptyState", null],
    ]);
    setRows(undefined);
    workspace.refreshRows(["c1"]);
    expect(view(listRow())).toEqual([["GridListItem", "?"]]);

    const plain = await open("ListBox", false);
    expect(view(layers(plain.workspace).listRow())).toEqual([
      ["ListBoxItem", null],
      ["ListBoxItem", null],
      ["ListBoxItem", null],
    ]);
    // Its items deleted, the Canvas draws its EmptyState: now it has a row.
    const plainTree = layers(plain.workspace);
    const items = plainTree.listRow().children!.map((row) => row.position);
    plain.workspace.execute(
      removeTargets({
        targets: items.map((item) => item.target),
        newId: plain.workspace.newId,
      }),
    );
    expect(view(plainTree.listRow()).map(([name]) => name)).toEqual([
      "EmptyState",
    ]);
  });
});
