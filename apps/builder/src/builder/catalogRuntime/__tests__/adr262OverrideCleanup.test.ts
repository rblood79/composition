import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createComponent,
  duplicateNodes,
  insertNodes,
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { ContextMenuItem } from "../../components/overlay/contextMenu/types";
import { catalogCanvasMenuItems, type CatalogMenuHost } from "../canvasMenu";
import {
  catalogComponentCommands,
  catalogOverrideCleanupTarget,
} from "../componentActions";
import {
  confirmCatalogPush,
  watchCatalogComponentEdits,
} from "../componentConfirm";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import {
  resolveEditingSemanticsImpactConfirmation,
  subscribeEditingSemanticsImpactConfirmation,
} from "../../utils/editingSemanticsImpactConfirmation";

/**
 * ADR-262 Phase 2 — the Builder paths of push · reset all: the Canvas menu lists them for an
 * instance only (not its origin, not a position inside it), push asks when other instances take
 * it (user decision 4) and writes the origin, reset all is one step with undo.
 */
const PROJECT = "project:project:adr262" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:x${++next}` as EntryId<K>;
};
const set = <V>(value: V) => ({ kind: "set" as const, value });

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Overrides" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr262-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const newId = allocator();
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("card", "lib:definition:type-frame", [id("title")]),
        node("title", "lib:definition:text"),
      ],
      rootIds: [id("card")],
      newId,
    }),
  );
  workspace.execute(
    createComponent({ id: id("card"), name: "Card", newId: workspace.newId }),
  );
  const graph = workspace.runtime.graph;
  const instanceOf = (ids: readonly string[]) =>
    ids.filter((item) => item !== id("card")) as NodeId[];
  workspace.execute(
    duplicateNodes({ ids: [id("card")], newId: workspace.newId }),
  );
  const [I] = instanceOf([...graph.instancesOf(definitionOf())]);
  workspace.execute(
    duplicateNodes({ ids: [id("card")], newId: workspace.newId }),
  );
  const J = instanceOf([...graph.instancesOf(definitionOf())]).find(
    (item) => item !== I,
  )!;
  function definitionOf() {
    return graph.definitionOfTemplateRoot(id("card"))!;
  }
  const host: CatalogMenuHost = {
    graph,
    get records() {
      return workspace.root.domInputs;
    },
    selection: () => workspace.session.getSnapshot().selection,
    execute: (command) => workspace.execute(command),
    newId: workspace.newId,
    clipboard: {
      get: () => workspace.clipboard,
      set: (value) => {
        workspace.clipboard = value;
      },
    },
  };
  const record = (nodeId: NodeId) => workspace.root.recordsOfSource(nodeId)[0];
  const ids = (items: ContextMenuItem[]) =>
    items.filter((item) => item.kind !== "separator").map((item) => item.id);
  const run = (items: ContextMenuItem[], itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (item?.kind !== "action") throw new Error(`no ${itemId}`);
    void item.run();
  };
  return { workspace, graph, host, I, J, record, ids, run };
}

function answerImpact(answer: boolean) {
  const asked: number[] = [];
  const stop = subscribeEditingSemanticsImpactConfirmation((request) => {
    if (!request || request.kind === "detach-instance") return;
    asked.push(request.instanceCount);
    queueMicrotask(() => resolveEditingSemanticsImpactConfirmation(answer));
  });
  return { asked, stop };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ADR-262 Phase 2 — Builder push · reset all", () => {
  it("the Canvas menu offers both for an instance, neither for its origin or a position inside it", async () => {
    const { workspace, graph, host, I, record, ids } = await open();
    workspace.selectRecords([record(I)]);
    const items = ids(
      catalogCanvasMenuItems(host, "canvas-element", record(I)),
    );
    expect(items).toContain("push-changes");
    expect(items).toContain("reset-all-changes");
    workspace.selectRecords([record(id("card"))]);
    const origin = ids(
      catalogCanvasMenuItems(host, "canvas-element", record(id("card"))),
    );
    expect(origin).not.toContain("push-changes");
    expect(origin).not.toContain("reset-all-changes");
    expect(catalogOverrideCleanupTarget(graph, I)).toMatchObject({
      id: I,
      name: "Card",
    });
    expect(catalogOverrideCleanupTarget(graph, id("card"))).toBeUndefined();
    // A position inside the instance (its title) is a `descendant` target — not the instance.
    expect(
      catalogOverrideCleanupTarget(graph, {
        kind: "descendant",
        ownerId: I,
        address: { instances: [I], templatePath: [id("card"), id("title")] },
      }),
    ).toBeUndefined();
  });

  it("push asks with the other instances' count, writes the origin and clears the instance; Cancel does nothing", async () => {
    const { workspace, graph, I, J } = await open();
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: I }],
        visual: { opacity: set(0.5) },
      }),
    );
    workspace.execute(
      setWholeField({
        targets: [
          {
            kind: "descendant",
            ownerId: I,
            address: {
              instances: [I],
              templatePath: [id("card"), id("title")],
            },
          },
        ],
        field: "enabled",
        value: false,
      }),
    );
    const depth = workspace.runtime.historyDepth.undo;
    const cancel = answerImpact(false);
    const refused = await confirmCatalogPush(graph, I, () =>
      workspace.execute(catalogComponentCommands.push(I, workspace.newId)),
    );
    cancel.stop();
    expect(refused).toBe(false);
    // (The other instance J — the origin is no instance — one.)
    expect(cancel.asked).toEqual([1]);
    expect(workspace.runtime.historyDepth.undo).toBe(depth);

    // The origin-edit watcher (the Builder's) must not ask a second time about the push it covers.
    const watcherAsked: number[] = [];
    const stopWatcher = watchCatalogComponentEdits(workspace, {
      detach: async () => true,
      impact: async (request) => {
        watcherAsked.push(request.instanceCount);
        return true;
      },
    });
    const ok = answerImpact(true);
    await confirmCatalogPush(graph, I, () =>
      workspace.execute(catalogComponentCommands.push(I, workspace.newId)),
    );
    ok.stop();
    await settle();
    stopWatcher();
    expect(watcherAsked).toEqual([]);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect((graph.getEntry(id("card")) as NodeEntry).visual.opacity).toEqual(
      set(0.5),
    );
    expect((graph.getEntry(id("title")) as NodeEntry).enabled).toBe(false);
    const instance = graph.getEntry(I) as NodeEntry;
    expect(instance.visual).toEqual({});
    expect(instance.descendantOverrides).toEqual([]);
    // J (no override) now shows the hidden title: its drawn records hold no title.
    expect(workspace.root.recordsOfSource(id("title")).length).toBe(0);
    expect(J).toBeTruthy();
    workspace.undo();
    expect((graph.getEntry(I) as NodeEntry).visual.opacity).toEqual(set(0.5));
    expect((graph.getEntry(id("title")) as NodeEntry).enabled).toBeUndefined();
  });

  it("reset all from the menu is one step: the instance shows the origin again; undo restores", async () => {
    const { workspace, graph, host, I, record, run } = await open();
    workspace.execute(
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: I,
            address: {
              instances: [I],
              templatePath: [id("card"), id("title")],
            },
          },
        ],
        props: { children: set("Changed") },
        visual: { color: set("red") },
      }),
    );
    workspace.execute(
      setWholeField({
        targets: [{ kind: "node", id: I }],
        field: "visibility",
        value: { tablet: false },
      }),
    );
    const depth = workspace.runtime.historyDepth.undo;
    workspace.selectRecords([record(I)]);
    run(
      catalogCanvasMenuItems(host, "canvas-element", record(I)),
      "reset-all-changes",
    );
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    const instance = graph.getEntry(I) as NodeEntry;
    expect(instance.descendantOverrides).toEqual([]);
    expect(instance.visibility).toBeUndefined();
    workspace.undo();
    expect((graph.getEntry(I) as NodeEntry).descendantOverrides).toHaveLength(
      1,
    );
    expect((graph.getEntry(I) as NodeEntry).visibility).toEqual({
      tablet: false,
    });
  });
});
