import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import type { DataChange } from "@composition/shared";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogDataHistoryRecorder, dataChangeEffect } from "../dataHistory";
import { catalogBindingCommand, catalogBindingRef } from "../dataBinding";
import { CatalogHistoryStore } from "../history";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4e (user 2026-09-30): data changes (the data store, H1) join the document's
 * single history — an outside entry is undone and redone in history order with the document steps,
 * and an entry may carry a document part (one undo for both).
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:datahistory" as EntryId<"project">,
        name: "Data history",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(
      indexedDB,
      `adr248-phase4e-datahistory-${Math.random()}`,
    ),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const list: NodeEntry = {
    kind: "node",
    id: LIST,
    definitionId: "lib:definition:type-ListBox",
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [list],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

const bindingOf = (workspace: CatalogWorkspace) => {
  const node = workspace.runtime.graph.getEntry(LIST);
  return node?.kind === "node" ? node.binding : undefined;
};

/** A data store stand-in: one collection's row count, changed by `add_row` / `remove_row`. */
function fakeStore() {
  let rows = 0;
  const log: string[] = [];
  const apply = vi.fn(async (change: DataChange) => {
    await Promise.resolve();
    for (const op of change.ops) {
      rows += op.op === "insert_rows" ? 1 : -1;
      log.push(op.op);
    }
  });
  return { apply, log, rows: () => rows, bump: () => (rows += 1) };
}
const addRow = {
  change: {
    ops: [{ op: "insert_rows", collectionId: "c1", index: 0, rows: [{}] }],
    origin: "user" as const,
    label: "Add row",
  },
  inverse: [{ op: "remove_rows", collectionId: "c1", rowIndexes: [0] }],
} as never;

describe("ADR-248 Phase 4e-4e data history (one stack)", () => {
  it("an outside entry is one history entry; undo/redo re-apply the data ops in order with document steps", async () => {
    const workspace = await open();
    const store = fakeStore();
    const history = new CatalogHistoryStore(workspace.runtime, workspace);
    const record = catalogDataHistoryRecorder(workspace, store.apply);
    const revision = workspace.runtime.graph.revision;
    store.bump();
    record(addRow);
    expect(workspace.runtime.graph.revision).toBe(revision);
    expect(history.getSnapshot().labels.at(-1)).toBe("Add row");
    // A document step after it.
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: LIST }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "c1",
          name: "",
        })!,
      ),
    );
    const applied = history.getSnapshot().applied;
    workspace.undo(); // the binding
    workspace.undo(); // the row
    await workspace.runtime.settled();
    expect(store.rows()).toBe(0);
    expect(store.log).toEqual(["remove_rows"]);
    expect(history.getSnapshot().applied).toBe(applied - 2);
    expect(bindingOf(workspace)).toBeUndefined();
    workspace.redo();
    workspace.redo();
    await workspace.runtime.settled();
    expect(store.rows()).toBe(1);
    expect(store.log).toEqual(["remove_rows", "insert_rows"]);
    expect(bindingOf(workspace)).toBeTruthy();
    // A new step clears the redo side (the outside entry too).
    workspace.undo();
    workspace.undo();
    await workspace.runtime.settled();
    workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: LIST }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "c2",
          name: "",
        })!,
      ),
    );
    expect(workspace.runtime.historyDepth.redo).toBe(0);
  });

  it("an outside change with a document part is one entry: undo reverts both", async () => {
    const workspace = await open();
    const store = fakeStore();
    store.bump();
    const start = workspace.runtime.historyDepth.undo;
    workspace.recordExternal(
      "Create and connect",
      dataChangeEffect(addRow, store.apply),
      catalogBindingCommand(
        [{ kind: "node", id: LIST }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "c1",
          name: "",
        })!,
      ),
    );
    expect(workspace.runtime.historyDepth.undo).toBe(start + 1);
    // Named by the outside change, not its document part ("Bind data").
    expect(workspace.runtime.historyLabels.undo.at(-1)).toBe(
      "Create and connect",
    );
    workspace.undo();
    await workspace.runtime.settled();
    expect(bindingOf(workspace)).toBeUndefined();
    expect(store.rows()).toBe(0);
    workspace.redo();
    await workspace.runtime.settled();
    expect(store.rows()).toBe(1);
  });

  it("the effect re-applies without recording, as the user origin; empty ops call nothing", async () => {
    const apply = vi.fn(async () => undefined);
    const effect = dataChangeEffect(addRow, apply);
    await effect.undo();
    expect(apply).toHaveBeenCalledWith(
      {
        ops: [{ op: "remove_rows", collectionId: "c1", rowIndexes: [0] }],
        origin: "user",
      },
      { record: false },
    );
    const none = dataChangeEffect(
      { change: { ops: [], origin: "user" }, inverse: [] } as never,
      apply,
    );
    await none.redo();
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
