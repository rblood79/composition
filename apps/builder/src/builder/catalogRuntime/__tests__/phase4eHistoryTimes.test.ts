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
