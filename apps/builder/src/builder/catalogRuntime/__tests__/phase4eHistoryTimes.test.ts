import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const padding = (value: number, label?: string) =>
  setFields({
    targets: [{ kind: "node", id: BODY }],
    visual: { padding: { kind: "set", value } },
    ...(label ? { label } : {}),
  });

afterEach(() => vi.useRealTimers());

describe("ADR-248 Phase 4e History entry times", () => {
  it("records when each action ran; undo/redo keep the time, a merge takes the last one", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:times" as EntryId<"project">,
          name: "Times",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-history-times-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    workspace.execute(padding(4, "Padding"));
    vi.setSystemTime(2_000);
    workspace.execute(padding(8, "Padding"));
    vi.setSystemTime(3_000);
    workspace.execute(padding(12, "Gap"));
    const snapshot = () => workspace.history.getSnapshot();
    expect(snapshot().times).toEqual([1_000, 2_000, 3_000]);
    // Undo moves the entry to redo; its time is the action's, not the undo's.
    vi.setSystemTime(9_000);
    workspace.undo();
    expect(snapshot()).toMatchObject({ applied: 2, times: [1_000, 2_000, 3_000] });
    workspace.redo();
    expect(snapshot().times).toEqual([1_000, 2_000, 3_000]);
    // Two entries joined (an AI batch): the joined entry carries the later time.
    expect(workspace.runtime.mergeHistory(2, "AI: style")).toBe(true);
    expect(snapshot()).toMatchObject({
      labels: ["Padding", "AI: style"],
      times: [1_000, 3_000],
    });
  });
});

describe("History snapshot cost (CANVAS_PERF_SCALING_2026-11 B7)", () => {
  it("reads entries only when a reader asks; an unread history costs nothing per step", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:lazy" as EntryId<"project">,
          name: "Lazy",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `history-lazy-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    const entries = vi.spyOn(workspace.runtime, "historyEntries", "get");
    let heard = 0;
    workspace.history.subscribe(() => heard++);
    for (let index = 1; index <= 5; index++)
      workspace.execute(padding(index * 4, "Padding"));
    // Listeners hear each change; nobody read the snapshot, so no entry was read.
    expect(heard).toBe(5);
    expect(entries).not.toHaveBeenCalled();
    expect(workspace.history.size()).toEqual({ undo: 5, redo: 0 });
    expect(workspace.history.getSnapshot()).toMatchObject({
      applied: 5,
      labels: ["Padding", "Padding", "Padding", "Padding", "Padding"],
    });
    expect(entries).toHaveBeenCalledTimes(1);
    // An unchanged history keeps the same snapshot object (useSyncExternalStore).
    const first = workspace.history.getSnapshot();
    expect(workspace.history.getSnapshot()).toBe(first);
    // A jump walks undo by the counts, not by re-reading the entries per step.
    entries.mockClear();
    workspace.history.goTo(1);
    expect(entries).not.toHaveBeenCalled();
    expect(workspace.history.getSnapshot()).toMatchObject({ applied: 1 });
    workspace.history.goTo(4);
    expect(workspace.history.getSnapshot()).toMatchObject({ applied: 4 });
  });
});
