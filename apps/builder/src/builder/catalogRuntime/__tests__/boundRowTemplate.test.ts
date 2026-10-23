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
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { CatalogBoundRow } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { catalogBindingRef } from "../dataBinding";
import { catalogBindingCommand } from "../dataBindingCommand";

/**
 * 2026-10-23 user report: a ListBox · GridList · TagGroup whose own items were removed (its
 * EmptyState stays), then bound, drew its rows from the origin's item — a library position, so no
 * row could be selected on the Canvas or in Layers. The binding now adds that item as the
 * collection's own node (its row template), in the same step; a collection holding items keeps
 * them.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;
const BINDING = catalogBindingRef({
  source: "dataTable",
  collectionId: "users",
  name: "Users",
})!;
const EMPTY = "lib:definition:origin-component-illustratedmessage";

async function open(type: string) {
  const library = await buildCodeCatalogLibrary();
  const rows: CatalogBoundRow[] = ["aaaa", "bbbb"].map((key) => ({
    key,
    values: { id: key, label: key, name: key },
  }));
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:row-template" as EntryId<"project">,
        name: "Row template",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `row-template-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: { rows: () => rows },
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: LIST,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const fill = () =>
    (
      (graph.getEntry(LIST) as NodeEntry).descendantOverrides.find(
        (override) => override.kind === "fillSlot",
      ) as { childIds: readonly NodeId[] }
    ).childIds;
  const isEmptyState = (id: NodeId) =>
    (graph.getEntry(id) as NodeEntry).definitionId === EMPTY;
  const rowRecords = () =>
    [...workspace.root.domInputs.values()].filter(
      (record) => record.rowIndex !== undefined,
    );
  return { workspace, fill, isEmptyState, rowRecords };
}

describe("binding a collection without items of its own", () => {
  it.each(["ListBox", "GridList", "TagGroup"])(
    "%s: its rows are its own item's — selectable",
    async (type) => {
      const { workspace, fill, isEmptyState, rowRecords } = await open(type);
      workspace.execute(
        removeTargets({
          targets: fill()
            .filter((id) => !isEmptyState(id))
            .map((id) => ({ kind: "node" as const, id })),
        }),
      );
      expect(fill().filter((id) => !isEmptyState(id))).toEqual([]);
      workspace.execute(
        catalogBindingCommand(
          [{ kind: "node", id: LIST }],
          BINDING,
          workspace.newId,
        ),
      );
      // One item of its own, before its EmptyState.
      const own = fill();
      expect(own.length).toBe(2);
      expect(isEmptyState(own[1]!)).toBe(true);
      const rows = rowRecords();
      expect(rows.length).toBe(2);
      for (const row of rows) {
        expect(workspace.positionOfRecord(row.id)).toBeTruthy();
        workspace.selectRecords([row.id]);
        expect(workspace.session.getSnapshot().selection).toHaveLength(1);
      }
      // One undo takes the binding and the item back together.
      workspace.undo();
      expect(fill().filter((id) => !isEmptyState(id))).toEqual([]);
    },
  );

  it("a collection that holds items keeps them as they are", async () => {
    const { workspace, fill } = await open("ListBox");
    const before = fill();
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: LIST }],
        BINDING,
        workspace.newId,
      ),
    );
    expect(fill()).toEqual(before);
  });
});
