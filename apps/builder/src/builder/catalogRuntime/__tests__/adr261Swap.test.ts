import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createComponent,
  duplicateNodes,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogCanvasMenuItems } from "../canvasMenu";
import { newCatalogProjectDocument } from "../project";
import { catalogMenuHost } from "../shortcuts";
import { CatalogStorage } from "../storage";
import { catalogSwapCandidates, catalogSwapPlan } from "../swapInstance";
import {
  catalogSlotInsertOptions,
  catalogSlotSuggestionChoices,
} from "../slots";
import { setSlotDeclaration } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogWorkspace } from "../workspace";
import { PROJECT_COMPONENTS_VIEW } from "../originView";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-261 Phase 2 (Builder): Swap instance's list — every project component and palette
 * component, the same root type first (user decision 3), library instances too (user decision 5);
 * the Canvas menu item opens it; the swap is one step.
 */
const PROJECT = "project:project:adr261swap" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const frame = (name: string, children: NodeId[] = []): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:type-frame",
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:s${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Swap" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr261-swap-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [frame("A"), frame("B")],
      rootIds: [id("A"), id("B")],
      newId: allocator(),
    }),
  );
  // ADR-279: the definitions own A and B; the instance in A's place is I.
  const I = workspace.execute(
    createComponent({ id: id("A"), name: "Card A", newId: workspace.newId }),
  ).plan.selectAfter![0] as NodeId;
  workspace.execute(
    createComponent({ id: id("B"), name: "Card B", newId: workspace.newId }),
  );
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId) as ProjectEntry;
  const [defA, defB] = project.definitionIds;
  return { workspace, graph, I, defA, defB };
}

describe("ADR-261 Phase 2 — Swap instance (Builder)", () => {
  it("lists the other components, the same root type first; not the current one", async () => {
    const { graph, I, defA, defB } = await open();
    const candidates = catalogSwapCandidates(graph, I);
    const ids = candidates.map((candidate) => candidate.definitionId);
    expect(ids).not.toContain(defA);
    expect(candidates.find((item) => item.definitionId === defB)?.group).toBe(
      "related",
    );
    // Related first, then Local, then Library.
    const order = candidates.map((candidate) => candidate.group);
    expect(order.indexOf("library")).toBeGreaterThan(
      order.lastIndexOf("related"),
    );
    expect(ids).toContain("lib:definition:type-frame");
  });

  it("the swap is one step and the instance keeps its id; undo restores", async () => {
    const { workspace, graph, I, defB } = await open();
    const revision = graph.revision;
    const { command, report } = catalogSwapPlan(graph, I, defB);
    expect(report).toEqual({
      kept: 0,
      dropped: 0,
      movedOut: 0,
      targetsUnset: 0,
    });
    workspace.execute(command);
    expect((graph.getEntry(I) as NodeEntry).definitionId).toBe(defB);
    expect(graph.revision).toBe(revision + 1);
    workspace.undo();
    expect((graph.getEntry(I) as NodeEntry).definitionId).not.toBe(defB);
  });

  it("the Canvas menu offers Swap instance for an instance, not for the origin", async () => {
    const { workspace, I } = await open();
    const swap = vi.fn();
    const host = { ...catalogMenuHost(workspace), swapInstance: swap };
    const instanceRecord = workspace.root.recordsOfSource(I)[0];
    workspace.selectRecords([instanceRecord]);
    const item = catalogCanvasMenuItems(
      host,
      "canvas-element",
      instanceRecord,
    ).find((entry) => entry.kind === "action" && entry.id === "swap-instance");
    expect(item?.kind).toBe("action");
    if (item?.kind === "action") void item.run();
    expect(swap).toHaveBeenCalledWith(I);

    // The origin is on the Local page (ADR-279) — a host over that root.
    workspace.showDefinition(PROJECT_COMPONENTS_VIEW);
    const originRecord = workspace.root.recordsOfSource(id("A"))[0];
    workspace.selectRecords([originRecord]);
    const localHost = { ...catalogMenuHost(workspace), swapInstance: swap };
    expect(
      catalogCanvasMenuItems(localHost, "canvas-element", originRecord).some(
        (entry) => entry.kind === "action" && entry.id === "swap-instance",
      ),
    ).toBe(false);
  });

  it("Phase 3: an instance's slot lists the origin's suggestions first; a slot never suggests its own component", async () => {
    const { workspace, graph, I, defA, defB } = await open();
    // A's origin holds a slot S; it suggests B.
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("A") },
        entries: [frame("S")],
        rootIds: [id("S")],
        newId: allocator(),
      }),
    );
    expect(
      catalogSlotSuggestionChoices(graph, id("S")).map((c) => c.definitionId),
    ).not.toContain(defA);
    workspace.execute(
      setSlotDeclaration({
        id: id("S"),
        slot: { name: "content", required: false, suggested: [defB] },
      }),
    );
    const options = catalogSlotInsertOptions(graph, {
      kind: "descendant",
      ownerId: I,
      address: { instances: [I], templatePath: [id("A"), id("S")] },
    });
    expect(options[0]).toMatchObject({ definitionId: defB, suggested: true });
    expect(options.filter((option) => option.suggested)).toHaveLength(1);
    expect(options.length).toBeGreaterThan(10);
  });
});
