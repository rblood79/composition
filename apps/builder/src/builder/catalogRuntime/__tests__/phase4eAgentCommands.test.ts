import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setAgentCommandHost } from "../../../services/agent/agentCommandHost";
import { executeAgentCommand } from "../../../services/agent/executeAgentCommand";
import type { AgentReadModel } from "../../config/commandMeta";
import { resolveCommandEnablement } from "../../main/headerMenu/resolveMenuItemState";
import { createCatalogAgentCommandHost } from "../agentHost";
import { registerCommand } from "../../stores/commandRegistry";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-5 agent commands: with the catalog host installed, the agent executor runs a
 * document command as the keyboard's plan over the workspace (one step, the log's history index
 * = the workspace history), the host's refusal is the precondition (nothing to do / not supported
 * here — never the old store), a confirm-required command changes nothing until approved, and view
 * commands keep their adapters. The header menu's enablement reads the same host.
 */
const PROJECT = "project:project:agent" as EntryId<"project">;
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

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Agent" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-agent-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let n = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("list", "lib:definition:type-frame", [id("a"), id("b")]),
        node("a", "lib:definition:text"),
        node("b", "lib:definition:text"),
      ],
      rootIds: [id("list")],
      newId: (kind: EntryKind) => `project:${kind}:g${++n}` as never,
    }),
  );
  uninstall = setAgentCommandHost(createCatalogAgentCommandHost(workspace));
  const children = () => {
    const entry = workspace.runtime.graph.getEntry(id("list"));
    return entry?.kind === "node" ? entry.children : [];
  };
  const select = (name: string) =>
    workspace.selectRecords([workspace.root.recordsOfSource(id(name))[0]]);
  return { workspace, children, select };
}
const context = (approve = true) => ({
  host: "ai-panel" as const,
  requestConfirm: async () => approve,
});

describe("ADR-248 Phase 4e-5 agent commands", () => {
  it("a document command runs the workspace plan: one step, the history index is the workspace's", async () => {
    const { workspace, children, select } = await open();
    select("a");
    const result = await executeAgentCommand("duplicate", {}, context());
    expect(result).toMatchObject({
      status: "ok",
      undoable: true,
      historyIndex: workspace.runtime.historyDepth.undo,
    });
    expect(children()).toHaveLength(3);
    const undo = await executeAgentCommand("undo", {}, context());
    expect(undo.status).toBe("ok");
    expect(children()).toHaveLength(2);
  });

  it("the host's refusal is the precondition; a confirm-required command changes nothing until approved", async () => {
    const { workspace, children, select } = await open();
    workspace.session.clearSelection();
    expect(
      await executeAgentCommand("delete", {}, context(false)),
    ).toMatchObject({
      status: "precondition-failed",
      reason: "not-applicable",
    });
    select("a");
    expect(
      await executeAgentCommand("toggleComponentOrigin", {}, context()),
    ).toMatchObject({ status: "precondition-failed", reason: "not-supported" });
    // Align runs the workspace plan: one flow element is nothing to align.
    expect(await executeAgentCommand("alignLeft", {}, context())).toMatchObject(
      { status: "precondition-failed", reason: "not-applicable" },
    );
    expect(
      await executeAgentCommand("delete", {}, context(false)),
    ).toMatchObject({ status: "declined" });
    expect(children()).toHaveLength(2);
    expect(await executeAgentCommand("delete", {}, context())).toMatchObject({
      status: "ok",
    });
    expect(children()).toEqual([id("b")]);
    while (workspace.runtime.historyDepth.undo > 0) workspace.undo();
    expect(await executeAgentCommand("undo", {}, context())).toMatchObject({
      status: "precondition-failed",
      reason: "nothing-to-undo",
    });
  });

  it("view commands keep their adapters; the header menu's enablement reads the host", async () => {
    const { workspace, select } = await open();
    workspace.session.clearSelection();
    expect((await executeAgentCommand("zoom100", {}, context())).status).toBe(
      "ok",
    );
    const empty: AgentReadModel = {
      currentPageId: null,
      selectedElementId: null,
      selectedElementIds: [],
      multiSelectMode: false,
      elementsMap: new Map(),
      guideSelected: false,
      canUndo: false,
      canRedo: false,
      viewport: { containerSize: { width: 0, height: 0 } },
    };
    const input = {
      readModel: empty,
      resolve: () => ({ id: "undo", handler: () => {} }) as never,
      isPanelVisible: () => true,
      panelIdForScope: () => null,
    };
    expect(resolveCommandEnablement("undo", input)).toEqual({ enabled: true });
    expect(resolveCommandEnablement("delete", input)).toMatchObject({
      enabled: false,
      reason: "precondition",
    });
    select("a");
    expect(resolveCommandEnablement("delete", input)).toEqual({
      enabled: true,
    });
    uninstall?.();
    uninstall = undefined;
    // Without a host the old read model decides again.
    expect(resolveCommandEnablement("undo", input)).toMatchObject({
      enabled: false,
      reason: "precondition",
    });
  });

  it("style / property clipboard commands: the host answers from the catalog selection and runs the panel's handler", async () => {
    const { workspace, select } = await open();
    const input = {
      readModel: {
        currentPageId: null,
        selectedElementId: null,
        selectedElementIds: [],
        multiSelectMode: false,
        elementsMap: new Map(),
        guideSelected: false,
        canUndo: false,
        canRedo: false,
        viewport: { containerSize: { width: 0, height: 0 } },
      } as AgentReadModel,
      resolve: () => ({ id: "pasteStyles", handler: () => {} }) as never,
      isPanelVisible: () => true,
      panelIdForScope: () => null,
    };
    workspace.session.clearSelection();
    for (const command of ["copyStyles", "pasteStyles"] as const)
      expect(resolveCommandEnablement(command, input)).toMatchObject({
        enabled: false,
        detail: "selection-empty",
      });
    select("a");
    // The old store's selection is empty; the catalog selection enables them.
    for (const command of [
      "copyStyles",
      "pasteStyles",
      "copyProperties",
      "pasteProperties",
    ] as const)
      expect(resolveCommandEnablement(command, input)).toEqual({
        enabled: true,
      });
    const calls: string[] = [];
    const off = registerCommand({
      id: "pasteStyles",
      handler: () => calls.push("pasteStyles"),
      scope: "panel:styles",
      priority: 50,
      allowInInput: false,
      disabled: false,
    });
    const plan = createCatalogAgentCommandHost(workspace).plan("pasteStyles");
    expect(plan && "run" in plan).toBe(true);
    if (plan && "run" in plan) await plan.run();
    expect(calls).toEqual(["pasteStyles"]);
    off();
  });
});
