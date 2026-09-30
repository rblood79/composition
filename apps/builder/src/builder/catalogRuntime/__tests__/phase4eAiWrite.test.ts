import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { setAiReadHost } from "../../../services/ai/aiReadHost";
import { setAiWriteHost } from "../../../services/ai/aiWriteHost";
import { resolveTriggers } from "@composition/shared";
import { batchDesignTool } from "../../../services/ai/tools/batchDesign";
import { bindCollectionTool } from "../../../services/ai/tools/bindCollection";
import { createInteractionRuleTool } from "../../../services/ai/tools/createInteractionRule";
import { proposeDataChangeTool } from "../../../services/ai/tools/proposeDataChange";
import {
  resolveAgentCommandConfirmation,
  subscribeAgentCommandConfirmation,
} from "../../../services/agent/agentCommandConfirmation";
import { setAgentCommandHost } from "../../../services/agent/agentCommandHost";
import { createCatalogAgentCommandHost } from "../agentHost";
import { useDataStore } from "../../stores/data";
import {
  setDataHistoryRecorder,
  setDocumentBindingCommitter,
} from "../../stores/utils/dataChange";
import {
  catalogDataHistoryRecorder,
  catalogDocumentBindingCommitter,
} from "../dataHistory";
import { catalogInteractionsOf } from "../interactions";
import { createElementTool } from "../../../services/ai/tools/createElement";
import { deleteElementTool } from "../../../services/ai/tools/deleteElement";
import { updateElementTool } from "../../../services/ai/tools/updateElement";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import {
  catalogCanonicalCommands,
  createCatalogAiReadHost,
  createCatalogAiWriteHost,
} from "../aiHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-5 AI writes: with the catalog hosts installed, the element tools write the
 * open workspace — create (palette definition, props the contract offers, CSS, under the given
 * element), update (props · CSS at the open breakpoint), delete — one history step each, and read
 * the result back through the read host; a batch is one step (one undo takes it back). A prop the
 * element does not offer is refused without a step; the user's selection does not move.
 */
const PROJECT = "project:project:aiw" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
  props: NodeEntry["props"] = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props,
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
// The data store saves to IndexedDB: an accepting stand-in (the applier's order is what is tested).
vi.mock("../../../lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/db")>();
  const table = new Proxy(() => Promise.resolve([]), {
    get: (_t, prop) =>
      prop === "then" ? undefined : () => Promise.resolve([]),
    apply: () => Promise.resolve([]),
  });
  const db = new Proxy(
    {},
    { get: (_t, prop) => (prop === "then" ? undefined : table) },
  );
  return { ...actual, getDB: vi.fn(async () => db) };
});

const t: ToolTranslate = (key, params) =>
  params ? `${key} ${JSON.stringify(params)}` : key;

let uninstall: (() => void)[] = [];
afterEach(() => {
  uninstall.forEach((off) => off());
  uninstall = [];
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "AI write" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-aiw-${Math.random()}`),
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
        node("list", "lib:definition:type-frame", [id("a")]),
        node("a", "lib:definition:text", [], {
          children: { kind: "set", value: "Hello" },
        }),
      ],
      rootIds: [id("list")],
      newId: (kind: EntryKind) => `project:${kind}:w${++n}` as never,
    }),
  );
  uninstall.push(
    setAiReadHost(createCatalogAiReadHost(workspace)),
    setAiWriteHost(createCatalogAiWriteHost(workspace)),
  );
  const record = (name: string) => workspace.root.recordsOfSource(id(name))[0];
  const children = (name: string) => {
    const entry = workspace.runtime.graph.getEntry(id(name));
    return entry?.kind === "node" ? entry.children : [];
  };
  const steps = () => workspace.runtime.historyDepth.undo;
  const selected = () =>
    workspace.session.getSnapshot().selection.map((item) => item.identity);
  return { workspace, record, children, steps, selected };
}

describe("ADR-248 Phase 4e-5 AI writes", () => {
  it("create_element: one step under the given element with props and CSS; the selection stays", async () => {
    const { workspace, record, children, steps, selected } = await open();
    workspace.selectRecords([record("a")]);
    const before = steps();
    const result = await createElementTool.execute(
      {
        type: "Text",
        parentId: record("list"),
        props: { children: "Made by AI" },
        styles: { color: "#ff0000", paddingTop: "8px" },
      },
      t,
    );
    expect(result.success, result.error).toBe(true);
    expect(steps()).toBe(before + 1);
    expect(children("list")).toHaveLength(2);
    const created = (result.data as { elementId: string }).elementId;
    const record2 = workspace.root.domInputs.get(created)!;
    expect(record2.props.children).toBe("Made by AI");
    expect(selected()).toEqual([record("a")]);
    // The given parent wins over where the selection would put it.
    const bodyRecord = workspace.root.recordsOfSource(BODY)[0];
    const atBody = await createElementTool.execute(
      { type: "Text", parentId: bodyRecord, props: { children: "Top" } },
      t,
    );
    expect(atBody.success, atBody.error).toBe(true);
    const body = workspace.runtime.graph.getEntry(BODY);
    expect(body?.kind === "node" && body.children).toHaveLength(2);
    // A prop the element does not offer: refused, no step.
    const refused = await createElementTool.execute(
      { type: "Text", parentId: record("list"), props: { noSuchProp: 1 } },
      t,
    );
    expect(refused.success).toBe(false);
    expect(refused.error).toContain("PROP_NOT_ACCEPTED");
    expect(steps()).toBe(before + 2);
  });

  it("update_element and delete_element: one step each, read back through the read host", async () => {
    const { workspace, record, children, steps } = await open();
    const before = steps();
    const updated = await updateElementTool.execute(
      {
        elementId: record("a"),
        props: { children: "Bye" },
        styles: { paddingTop: "12px" },
      },
      t,
    );
    expect(updated.success, updated.error).toBe(true);
    expect(steps()).toBe(before + 1);
    const a = workspace.runtime.graph.getEntry(id("a"));
    expect(a?.kind === "node" && a.visual.paddingTop).toEqual({
      kind: "set",
      value: 12,
    });
    const removed = await deleteElementTool.execute(
      { elementId: record("a") },
      t,
    );
    expect(removed.success, removed.error).toBe(true);
    expect(children("list")).toEqual([]);
    expect(steps()).toBe(before + 2);
  });

  it("batch_design: one history entry; one undo takes the whole batch back", async () => {
    const { workspace, record, children, steps } = await open();
    const before = steps();
    const result = await batchDesignTool.execute(
      {
        operations: [
          {
            action: "create",
            args: {
              type: "Text",
              parentId: record("list"),
              props: { children: "One" },
            },
          },
          {
            action: "create",
            args: {
              type: "Text",
              parentId: record("list"),
              props: { children: "Two" },
            },
          },
          {
            action: "update",
            args: { elementId: record("a"), props: { children: "Changed" } },
          },
        ],
      },
      t,
    );
    expect(result.success, JSON.stringify(result.data)).toBe(true);
    expect(children("list")).toHaveLength(3);
    expect(steps()).toBe(before + 1);
    workspace.undo();
    expect(children("list")).toEqual([id("a")]);
    const a = workspace.runtime.graph.getEntry(id("a"));
    expect(a?.kind === "node" && a.props.children).toEqual({
      kind: "set",
      value: "Hello",
    });
    workspace.redo();
    expect(children("list")).toHaveLength(3);
  });

  it("create_interaction_rule: one step, the rule in the element's interactions (toast; navigate by route)", async () => {
    const { workspace, steps } = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("go", "lib:definition:origin-component-button")],
        rootIds: [id("go")],
        newId: workspace.newId,
      }),
    );
    const go = workspace.root.recordsOfSource(id("go"))[0];
    const trigger = resolveTriggers("Button")[0]!;
    const before = steps();
    const toast = await createInteractionRuleTool.execute(
      { elementId: go, trigger, action: { kind: "toast", message: "Hi" } },
      t,
    );
    expect(toast.success, toast.error).toBe(true);
    expect(steps()).toBe(before + 1);
    const home = workspace.runtime.graph.getEntry("project:page:home");
    const route = home?.kind === "page" ? home.route : "";
    const nav = await createInteractionRuleTool.execute(
      { elementId: go, trigger, action: { kind: "navigate", path: route } },
      t,
    );
    expect(nav.success, nav.error).toBe(true);
    const rules = catalogInteractionsOf(workspace.runtime.graph, {
      ownerId: id("go"),
    });
    expect(rules.map((rule) => rule.action.opcode)).toEqual([
      "toast",
      "navigate",
    ]);
    const missing = await createInteractionRuleTool.execute(
      { elementId: go, trigger, action: { kind: "navigate", path: "/nope" } },
      t,
    );
    expect(missing.error).toContain("PAGE_NOT_FOUND");
  });

  it("bind_collection and propose_data_change bind_element: approved, one entry of the document history; undo takes the binding and the new collection back", async () => {
    const { workspace, steps } = await open();
    const apply = useDataStore.getState().applyDataChange;
    uninstall.push(
      () => setDataHistoryRecorder(null),
      () => setDocumentBindingCommitter(null),
    );
    setDataHistoryRecorder(catalogDataHistoryRecorder(workspace, apply));
    uninstall.push(
      setAgentCommandHost(createCatalogAgentCommandHost(workspace)),
    );
    setDocumentBindingCommitter(
      catalogDocumentBindingCommitter(workspace, apply),
    );
    let approve = true;
    uninstall.push(
      subscribeAgentCommandConfirmation((request) => {
        if (request)
          queueMicrotask(() => resolveAgentCommandConfirmation(approve));
      }),
    );
    useDataStore.setState({
      currentProjectId: "p1",
      collections: new Map([
        [
          "c1",
          {
            id: "c1",
            name: "Users",
            schema: [{ id: "f1", key: "name", type: "string" }],
            mockData: [{ name: "Ann" }],
            useMockData: true,
          },
        ],
      ]),
    } as never);
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("menu", "lib:definition:origin-component-listbox"),
          node("list2", "lib:definition:origin-component-listbox"),
        ],
        rootIds: [id("menu"), id("list2")],
        newId: workspace.newId,
      }),
    );
    const binding = (name: string) => {
      const entry = workspace.runtime.graph.getEntry(id(name));
      return entry?.kind === "node" ? entry.binding?.collectionId : undefined;
    };
    const menu = workspace.root.recordsOfSource(id("menu"))[0];
    const before = steps();
    // Declined: nothing changes.
    approve = false;
    const declined = await bindCollectionTool.execute(
      { elementId: menu, collectionId: "c1" },
      t,
    );
    expect(declined.success).toBe(false);
    expect(binding("menu")).toBeUndefined();
    expect(steps()).toBe(before);
    approve = true;
    const result = await bindCollectionTool.execute(
      { elementId: menu, collectionId: "c1" },
      t,
    );
    expect(result.success, result.error).toBe(true);
    expect(steps()).toBe(before + 1);
    expect(binding("menu")).toBe("data:collection:c1");
    // A new collection and its binding (an AI data proposal): one entry.
    const list2 = workspace.root.recordsOfSource(id("list2"))[0];
    const proposed = await proposeDataChangeTool.execute(
      {
        ops: [
          {
            op: "create_collection",
            id: "c2",
            name: "Tags",
            schema: [{ id: "f2", key: "tag", type: "string" }],
            rows: [{ tag: "a" }],
            source: "manual",
          },
          { op: "bind_element", elementId: list2, collectionId: "c2" },
        ],
      },
      t,
    );
    expect(proposed.success, proposed.error).toBe(true);
    expect(steps()).toBe(before + 2);
    expect(binding("list2")).toBe("data:collection:c2");
    expect(useDataStore.getState().collections.has("c2")).toBe(true);
    // The log's history index is the document history's.
    expect((proposed.data as { historyId: number }).historyId).toBe(steps());
    workspace.undo();
    await vi.waitFor(() =>
      expect(useDataStore.getState().collections.has("c2")).toBe(false),
    );
    expect(binding("list2")).toBeUndefined();
    expect(binding("menu")).toBe("data:collection:c1");
    workspace.redo();
    await vi.waitFor(() =>
      expect(useDataStore.getState().collections.has("c2")).toBe(true),
    );
    expect(binding("list2")).toBe("data:collection:c2");
    // An element the document does not have: refused, nothing saved.
    const missing = await proposeDataChangeTool.execute(
      {
        ops: [
          {
            op: "create_collection",
            id: "c3",
            name: "Ghost",
            schema: [{ id: "f3", key: "x", type: "string" }],
            rows: [],
            source: "manual",
          },
          { op: "bind_element", elementId: "nope", collectionId: "c3" },
        ],
      },
      t,
    );
    expect(missing.success).toBe(false);
    expect(useDataStore.getState().collections.has("c3")).toBe(false);
    expect(steps()).toBe(before + 2);
  });

  it("create_element makes a composite as the palette does (the origin's children)", async () => {
    const { workspace } = await open();
    const result = await createElementTool.execute({ type: "Select" }, t);
    expect(result.success, result.error).toBe(true);
    const created = (result.data as { elementId: string }).elementId;
    const record = workspace.root.domInputs.get(created)!;
    const entry = workspace.runtime.graph.getEntry(record.sourceId);
    expect(entry?.kind === "node" && entry.definitionId).toBe(
      "lib:definition:origin-component-select",
    );
    expect(record.children.length).toBeGreaterThan(0);
  });

  it("canonical fields: clip · placeholder on a Frame, slot inside a component template, reusable makes a component — one step each, refused ones write nothing", async () => {
    const { workspace, record, children, steps } = await open();
    const node = (identity: string) => {
      const target = workspace.positionOfRecord(identity)?.target;
      const entry =
        target?.kind === "node"
          ? workspace.runtime.graph.getEntry(target.id)
          : undefined;
      return entry?.kind === "node" ? entry : undefined;
    };
    const before = steps();
    const frame = await createElementTool.execute(
      {
        type: "frame",
        parentId: record("list"),
        canonical: { clip: true, placeholder: true },
      },
      t,
    );
    expect(frame.success, frame.error).toBe(true);
    expect(steps()).toBe(before + 1);
    const frameId = (frame.data as { elementId: string }).elementId;
    expect(node(frameId)?.visual.overflow).toEqual({
      kind: "set",
      value: "hidden",
    });
    expect(node(frameId)?.placeholder).toBe(true);
    const cleared = await updateElementTool.execute(
      { elementId: frameId, canonical: { clip: false, placeholder: false } },
      t,
    );
    expect(cleared.success, cleared.error).toBe(true);
    expect(node(frameId)?.visual.overflow).toEqual({
      kind: "set",
      value: "visible",
    });
    expect(node(frameId)?.placeholder).toBeUndefined();
    // A slot outside a component template: refused, nothing written (not the prop either).
    const refused = await updateElementTool.execute(
      {
        elementId: frameId,
        styles: { paddingTop: "4px" },
        canonical: { slot: ["x"] },
      },
      t,
    );
    expect(refused.error).toContain("SLOT_NOT_DECLARABLE");
    expect(node(frameId)?.visual.paddingTop).toBeUndefined();
    expect(
      (
        await updateElementTool.execute(
          { elementId: frameId, canonical: { reusable: false } },
          t,
        )
      ).error,
    ).toContain("REUSABLE_FALSE_NOT_SUPPORTED");
    // Reusable: a component of the Frame; its instance is the element from then on (one step).
    const inner = await createElementTool.execute(
      { type: "Text", parentId: frameId, props: { children: "In" } },
      t,
    );
    expect(inner.success, inner.error).toBe(true);
    const frameNode = node(frameId)!.id;
    const innerNode = node((inner.data as { elementId: string }).elementId)!.id;
    const beforeComponent = steps();
    const made = await updateElementTool.execute(
      { elementId: frameId, canonical: { reusable: true } },
      t,
    );
    expect(made.success, made.error).toBe(true);
    expect(steps()).toBe(beforeComponent + 1);
    const instanceId = (made.data as { elementId: string }).elementId;
    expect(instanceId).not.toBe(frameId);
    const instance = node(instanceId)!;
    const definition = workspace.runtime.graph.getEntry(instance.definitionId);
    expect(definition?.kind === "definition" && definition.templateRootId).toBe(
      frameNode,
    );
    expect(children("list")).toContain(instance.id);
    // Inside the template a node declares a slot (the old id list has no place in it); the
    // template is not drawn as its own element here, so the host's commands are run directly.
    const slot = catalogCanonicalCommands(
      workspace,
      { kind: "node", id: innerNode },
      { slot: ["any"], placeholder: true },
      () => "x",
    );
    workspace.execute((reader) => ({
      label: "slot",
      ops: slot.commands.flatMap((command) => command(reader).ops),
    }));
    expect(workspace.runtime.graph.getEntry(innerNode)).toMatchObject({
      slot: { name: "content", required: false },
      placeholder: true,
    });
    workspace.undo();
    workspace.undo();
    workspace.undo();
    expect(children("list")).toContain(frameNode);
  });

  it("history merge refuses an entry with an outside change", async () => {
    const { workspace, steps } = await open();
    workspace.recordExternal("Data", { undo: () => {}, redo: () => {} });
    workspace.recordExternal("Data", { undo: () => {}, redo: () => {} });
    const before = steps();
    expect(workspace.mergeHistory(2, "x")).toBe(false);
    expect(steps()).toBe(before);
  });
});
