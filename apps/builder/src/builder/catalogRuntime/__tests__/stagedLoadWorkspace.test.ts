import "fake-indexeddb/auto";
import { beforeAll, describe, expect, it } from "vitest";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  removePage,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  authorStagedFixture,
  buildStagedWorkspace,
  stagedEntries,
  stagedNodeId,
  stagedSnapshot as snapshot,
} from "./support/stagedLoadFixture";

/**
 * ADR-307 Phase 2 — the workspace's wiring of a staged root: the background fill, a page switch's
 * request, a node's request (a selection by node id, a command's `selectAfter`), a root
 * replacement and dispose.
 */
const idleQueue = () => {
  const queue: (() => void)[] = [];
  return {
    queue,
    schedule: (task: () => void) => {
      queue.push(task);
      return () => {
        const at = queue.indexOf(task);
        if (at >= 0) queue.splice(at, 1);
      };
    },
    drain: () => {
      for (let guard = 0; queue.length; guard++) {
        if (guard > 100_000) throw new Error("the fill does not end");
        queue.shift()!();
      }
    },
  };
};
const page = (name: string) => `project:page:${name}` as EntryId<"page">;

describe("ADR-307 staged workspace (Phase 2)", () => {
  beforeAll(async () => {
    await authorStagedFixture();
  }, 60_000);

  it("fills the pages in the background and tells the row listeners", async () => {
    const batch = snapshot((await buildStagedWorkspace(undefined)).root);
    const idle = idleQueue();
    const workspace = await buildStagedWorkspace({}, idle.schedule);
    let told = 0;
    workspace.subscribeRows(() => told++);
    expect(workspace.fillPending).toBe(true);
    expect(idle.queue.length).toBe(1);
    expect(workspace.root.domInputs.size).toBeLessThan(batch.records.length);
    idle.drain();
    expect(workspace.fillPending).toBe(false);
    expect(told).toBeGreaterThan(0);
    expect(snapshot(workspace.root)).toEqual(batch);
    workspace.dispose();
  });

  it("a page switch fills that page now; the others wait for the background", async () => {
    const idle = idleQueue();
    const workspace = await buildStagedWorkspace({}, idle.schedule);
    const pendingPages = () =>
      workspace.root
        .pendingFillRoots()
        .map((rootId) => workspace.root.pageOfRoot(rootId));
    expect(pendingPages()).toContain(page("wide"));
    workspace.session.setPage(page("wide"));
    expect(pendingPages()).not.toContain(page("wide"));
    expect(pendingPages()).toContain(page("grid"));
    expect(idle.queue.length).toBe(1);
    workspace.dispose();
    // (Disposed: the scheduled task is dropped.)
    expect(idle.queue.length).toBe(0);
  });

  it("a node asked for by id is filled: a selection, a command's new node", async () => {
    const idle = idleQueue();
    const workspace = await buildStagedWorkspace(
      { unitLimit: 3 },
      idle.schedule,
    );
    const graph = workspace.runtime.graph;
    const kids = (id: string) => {
      const entry = graph.getEntry(id);
      return entry?.kind === "node" ? entry.children : [];
    };
    const [column] = kids(stagedNodeId("flex-body"));
    const footer = kids(column).at(-1)!;
    expect(workspace.root.recordsOfSource(footer)).toEqual([]);
    expect(workspace.itemsOfNode(footer).length).toBe(1);
    // The page is not filled by it.
    expect(workspace.root.recordsOfSource(kids(column)[0])).toEqual([]);
    // A by-id read (a Preview click, an AI tool, 「go to owner」) fills the node too.
    expect(workspace.recordsOfNode(kids(column)[0]!)).toHaveLength(1);

    // A command into a page that is still a shell selects its new node.
    const { entries, rootIds } = stagedEntries([
      { text: "Added by a command", name: "ws-added" },
    ]);
    const [gridFrame] = kids(stagedNodeId("grid-body"));
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: gridFrame as NodeId },
        index: 0,
        entries,
        rootIds,
        newId: workspace.newId,
      }),
    );
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: stagedNodeId("ws-added") }]);
    // Undo · redo go on; the fill ends in the batch build's state of the same document.
    workspace.undo();
    workspace.redo();
    idle.drain();
    const batch = await buildStagedWorkspace(undefined);
    batch.execute(
      insertNodes({
        parent: { kind: "node", id: gridFrame as NodeId },
        index: 0,
        entries,
        rootIds,
        newId: batch.newId,
      }),
    );
    expect(snapshot(workspace.root)).toEqual(snapshot(batch.root));
    workspace.dispose();
  });

  it("a record identity not drawn yet is selected (a Layers row of a page still being filled)", async () => {
    const idle = idleQueue();
    const workspace = await buildStagedWorkspace(
      { unitLimit: 3 },
      idle.schedule,
    );
    const batch = await buildStagedWorkspace(undefined);
    const graph = workspace.runtime.graph;
    const kids = (id: string) => {
      const entry = graph.getEntry(id);
      return entry?.kind === "node" ? entry.children : [];
    };
    // The Layers tree builds its rows — and their identities — from the document.
    const [column] = kids(stagedNodeId("flex-body"));
    const footer = kids(column).at(-1)!;
    const [plain] = batch.root.recordsOfSource(footer);
    const instance = batch.root
      .recordsOfSource(kids(stagedNodeId("bound-body"))[0])
      .at(0)!;
    for (const identity of [plain, instance]) {
      expect(workspace.root.domInputs.has(identity)).toBe(false);
      workspace.selectRecords([identity]);
      expect(
        workspace.session.getSnapshot().selection.map((item) => item.identity),
      ).toEqual([identity]);
    }
    idle.drain();
    expect(snapshot(workspace.root)).toEqual(snapshot(batch.root));
    workspace.dispose();
  });

  it("the fill listeners hear each change of `fillPending` once: its last task, a new root", async () => {
    const idle = idleQueue();
    const workspace = await buildStagedWorkspace({}, idle.schedule);
    const heard: boolean[] = [];
    workspace.subscribeFill(() => heard.push(workspace.fillPending));
    idle.drain();
    expect(heard).toEqual([false]);
    // A new root has shells again; its fill ends once more.
    workspace.setBreakpoint("tablet");
    expect(heard).toEqual([false, true]);
    idle.drain();
    expect(heard).toEqual([false, true, false]);
    workspace.dispose();
  });

  it("a fill that ends without a delivery tells the fill listeners (the last shell page removed)", async () => {
    const idle = idleQueue();
    const workspace = await buildStagedWorkspace({}, idle.schedule);
    const root = () => workspace.root;
    // Every page but one is filled by the background.
    while (root().pendingFillRoots().length > 1) idle.queue.shift()!();
    expect(workspace.fillPending).toBe(true);
    const [last] = root().pendingFillRoots();
    const records = root().domInputs.size;
    let told = 0;
    let rows = 0;
    workspace.subscribeFill(() => told++);
    workspace.subscribeRows(() => rows++);
    workspace.execute(
      removePage({ id: root().pageOfRoot(last)! as EntryId<"page"> }),
    );
    expect(workspace.fillPending).toBe(false);
    // (No record was filled — the page went with its shell: the row listeners hear nothing.)
    expect(root().domInputs.size).toBeLessThan(records);
    expect(told).toBe(1);
    expect(rows).toBe(0);
    workspace.dispose();

    // The same with no background task run before the step (a document of one shell page left).
    const fresh = await buildStagedWorkspace({}, idleQueue().schedule);
    let ended = 0;
    fresh.subscribeFill(() => ended++);
    for (const rootId of [...fresh.root.pendingFillRoots()])
      fresh.execute(
        removePage({
          id: fresh.root.pageOfRoot(rootId)! as EntryId<"page">,
        }),
      );
    expect(fresh.fillPending).toBe(false);
    expect(ended).toBe(1);
    fresh.dispose();
  });

  it("a fill whose delivery fails tells the failure listeners (the Canvas binds again) and goes on", async () => {
    const idle = idleQueue();
    const workspace = await buildStagedWorkspace({}, idle.schedule);
    const logged: unknown[] = [];
    const error = console.error;
    console.error = (...args: unknown[]) => logged.push(args);
    try {
      let failures = 0;
      workspace.subscribeFillFailure(() => failures++);
      const [rootId] = workspace.root.pendingFillRoots();
      const [top] = workspace.root.recordsOfSource(rootId);
      const stop = workspace.root.subscribeCanvas(top, () => {
        throw new Error("CANVAS_DOWN");
      });
      idle.queue.shift()!();
      expect(failures).toBeGreaterThan(0);
      expect(String(logged[0])).toContain("CANVAS_DOWN");
      stop();
      idle.drain();
      expect(workspace.fillPending).toBe(false);
      expect(snapshot(workspace.root)).toEqual(
        snapshot((await buildStagedWorkspace(undefined)).root),
      );
    } finally {
      console.error = error;
      workspace.dispose();
    }
  });

  it("a replaced root (a breakpoint switch) builds the shown page and is filled again", async () => {
    const idle = idleQueue();
    const workspace = await buildStagedWorkspace({}, idle.schedule);
    workspace.session.setPage(page("bound"));
    idle.drain();
    expect(workspace.fillPending).toBe(false);
    workspace.setBreakpoint("tablet");
    const pending = workspace.root
      .pendingFillRoots()
      .map((rootId) => workspace.root.pageOfRoot(rootId));
    // The shown page is built with the root; the first page is a shell now.
    expect(pending).not.toContain(page("bound"));
    expect(pending).toContain(page("home"));
    expect(idle.queue.length).toBe(1);
    idle.drain();
    const batch = await buildStagedWorkspace(undefined);
    batch.setBreakpoint("tablet");
    expect(snapshot(workspace.root)).toEqual(snapshot(batch.root));
    workspace.dispose();
  });
});
