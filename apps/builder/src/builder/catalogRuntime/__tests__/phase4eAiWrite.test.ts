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
import { setAiReadHost } from "../../../services/ai/aiReadHost";
import { setAiWriteHost } from "../../../services/ai/aiWriteHost";
import { resolveTriggers } from "@composition/shared";
import { batchDesignTool } from "../../../services/ai/tools/batchDesign";
import { bindCollectionTool } from "../../../services/ai/tools/bindCollection";
import { createInteractionRuleTool } from "../../../services/ai/tools/createInteractionRule";
import { useDataStore } from "../../stores/data";
import { catalogInteractionsOf } from "../interactions";
import { createElementTool } from "../../../services/ai/tools/createElement";
import { deleteElementTool } from "../../../services/ai/tools/deleteElement";
import { updateElementTool } from "../../../services/ai/tools/updateElement";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import { createCatalogAiReadHost, createCatalogAiWriteHost } from "../aiHost";
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

  it("bind_collection: the element's document binding, one step", async () => {
    const { workspace, steps } = await open();
    useDataStore.setState({
      collections: new Map([
        [
          "c1",
          {
            id: "c1",
            name: "Users",
            schema: [{ id: "f1", key: "name" }],
            mockData: [{ name: "Ann" }],
            useMockData: true,
          },
        ],
      ]),
    } as never);
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("menu", "lib:definition:origin-component-listbox")],
        rootIds: [id("menu")],
        newId: workspace.newId,
      }),
    );
    const menu = workspace.root.recordsOfSource(id("menu"))[0];
    const before = steps();
    const result = await bindCollectionTool.execute(
      { elementId: menu, collectionId: "c1" },
      t,
    );
    expect(result.success, result.error).toBe(true);
    expect(steps()).toBe(before + 1);
    const entry = workspace.runtime.graph.getEntry(id("menu"));
    expect(entry?.kind === "node" && entry.binding?.collectionId).toBe(
      "data:collection:c1",
    );
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
