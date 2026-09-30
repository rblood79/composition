import "fake-indexeddb/auto";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DataChange, DataOp } from "@composition/shared";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type { Variable } from "../../../types/builder/data.types";
import { createCatalogDataVariablesHost } from "../../panels/datatable/usage/catalogDataVariablesHost";
import { useStateSectionFocus } from "../../panels/properties/state/stateSectionFocus";
import {
  catalogDocumentVariableNames,
  catalogLegacyVariableMove,
  catalogProjectVariableId,
  catalogVariableIndex,
  catalogVariableUsageCounter,
} from "../dataVariables";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
  catalogVisibleVariables,
} from "../interactions";
import { newCatalogProjectDocument } from "../project";
import { catalogVariableCommands } from "../stateVariables";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4e Data variables: the Variables tab reads the catalog document — page and
 * element variables by page, usage (setState rules · `{{ name }}` templates), the names project
 * variables may not take; a legacy page variable moves onto its page as one history entry; the
 * Interactions setState choices include the project variables.
 */
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const CARD = "project:node:card" as NodeId;
const TEXT = "project:node:text" as NodeId;
const BUTTON = "project:node:button" as NodeId;
const node = (
  id: NodeId,
  definitionId: string,
  extra: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id,
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:vars" as EntryId<"project">,
        name: "Vars",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-vars-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(CARD, "lib:definition:type-frame", {
          name: "Card",
          children: [TEXT],
        }),
        node(TEXT, "lib:definition:text", {
          props: {
            children: { kind: "set", value: "Hi {{ count }} {{ flag }}" },
          },
        }),
        node(BUTTON, "lib:definition:type-Button"),
      ],
      rootIds: [CARD, BUTTON],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  workspace.execute(
    catalogVariableCommands.add(HOME, "count", workspace.newId),
  );
  workspace.execute(
    catalogVariableCommands.add(CARD, "local", workspace.newId),
  );
  const [count] = catalogVariableIndex(graph).map((entry) => entry.variable);
  return { workspace, graph, count: count! };
}

const flag = { id: "v-flag", name: "flag", type: "boolean" as const };
const settings = { id: "v-obj", name: "settings", type: "object" as const };

describe("ADR-248 Phase 4e-4e Data variables", () => {
  it("index by page with owner labels; document names; usage counts setState rules and templates", async () => {
    const { workspace, graph, count } = await open();
    const index = catalogVariableIndex(graph);
    expect(
      index.map((entry) => [
        entry.variable.name,
        entry.pageId,
        entry.ownerLabel,
      ]),
    ).toEqual([
      ["count", HOME, null],
      ["local", HOME, "Card"],
    ]);
    expect([...catalogDocumentVariableNames(graph)]).toEqual([
      "count",
      "local",
    ]);
    // A setState rule on the Button for the page variable, one for the project variable.
    const owner = { ownerId: BUTTON };
    workspace.execute(
      catalogInteractionsCommand(
        owner,
        [
          catalogNewInteraction(
            owner,
            "onPress",
            { opcode: "setState", variableId: count.id, op: "set", value: "x" },
            workspace.newId,
          ),
          catalogNewInteraction(
            owner,
            "onPress",
            {
              opcode: "setState",
              variableId: catalogProjectVariableId(flag.id),
              op: "toggle",
            },
            workspace.newId,
          ),
        ],
        "Add",
      ),
    );
    const usage = catalogVariableUsageCounter(graph, [flag]);
    // count: its rule + the Text template.
    expect(usage(count.id)).toBe(2);
    // flag (project): its rule + the Text template (no page/element variable named flag).
    expect(usage(flag.id)).toBe(2);
    expect(usage("unknown")).toBe(0);
  });

  it("Interactions setState choices include the scalar project variables", async () => {
    const { graph } = await open();
    const visible = catalogVisibleVariables(graph, TEXT, [flag, settings]);
    expect(
      visible.map((variable) => [variable.name, variable.group, variable.id]),
    ).toEqual([
      ["local", "element", expect.stringMatching(/^project:stateVariable:/)],
      ["count", "page", expect.stringMatching(/^project:stateVariable:/)],
      ["flag", "project", "data:variable:v-flag"],
    ]);
  });

  it("a legacy page variable moves onto its page: one history entry (the rule follows); undo restores the data store", async () => {
    const { workspace, graph } = await open();
    const owner = { ownerId: BUTTON };
    const rule: InteractionEntry = catalogNewInteraction(
      owner,
      "onPress",
      {
        opcode: "setState",
        variableId: catalogProjectVariableId("v-old"),
        op: "set",
        value: 1,
      },
      workspace.newId,
    );
    workspace.execute(catalogInteractionsCommand(owner, [rule], "Add"));
    // The data store stand-in.
    const defined = new Set(["v-old"]);
    const apply = async (change: DataChange) => {
      await Promise.resolve();
      const inverse: DataOp[] = [];
      for (const op of change.ops)
        if (op.op === "define_variable") {
          if (op.definition === null) {
            defined.delete(op.variableId!);
            inverse.push({
              op: "define_variable",
              variableId: op.variableId,
              definition: { name: "old", type: "number" },
            });
          } else defined.add(op.variableId!);
        }
      return { applied: change.ops, inverse };
    };
    const host = createCatalogDataVariablesHost(
      workspace,
      { apply },
      "Move to page",
    );
    const legacy = {
      id: "v-old",
      name: "old",
      type: "number",
      defaultValue: 3,
      owner: { kind: "page", pageId: HOME },
    } as unknown as Variable;
    // A taken name is refused.
    expect(
      catalogLegacyVariableMove(
        graph,
        { ...legacy, name: "count", pageId: HOME } as never,
        workspace.newId,
      ),
    ).toEqual({ refused: "conflict" });
    const depth = workspace.runtime.historyDepth.undo;
    expect(await host.migrateLegacyToPage(legacy)).toBe(true);
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(defined.has("v-old")).toBe(false);
    const moved = catalogVariableIndex(graph).find(
      (entry) => entry.variable.name === "old",
    )!.variable;
    expect(moved).toMatchObject({
      ownerId: HOME,
      valueType: "number",
      defaultValue: 3,
    });
    const ruleNow = graph.getEntry(rule.id);
    expect(ruleNow?.kind === "interaction" && ruleNow.action).toMatchObject({
      variableId: moved.id,
    });
    workspace.undo();
    await workspace.runtime.settled();
    expect(defined.has("v-old")).toBe(true);
    expect(graph.getEntry(moved.id)).toBeUndefined();
    const ruleBack = graph.getEntry(rule.id);
    expect(ruleBack?.kind === "interaction" && ruleBack.action).toMatchObject({
      variableId: "data:variable:v-old",
    });
  });

  it("the tab view groups the index by page; jumping selects the owner and asks its State section to open the variable", async () => {
    const { workspace, count } = await open();
    const host = createCatalogDataVariablesHost(
      workspace,
      { apply: async () => ({ applied: [], inverse: [] }) },
      "Move",
    );
    const { result } = renderHook(() => host.useView([], [flag]));
    expect(result.current.groups).toEqual([
      expect.objectContaining({
        pageId: HOME,
        title: "Home",
        entries: [
          expect.objectContaining({ kind: "doc", ownerLabel: null }),
          expect.objectContaining({ kind: "doc", ownerLabel: "Card" }),
        ],
      }),
    ]);
    act(() => {
      host.jumpToOwner({
        def: { id: count.id, name: "count", type: "string" },
        owner: { kind: "page", pageId: HOME },
      });
    });
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: BODY }]);
    expect(useStateSectionFocus.getState().request).toMatchObject({
      ownerNodeId: HOME,
      variableId: count.id,
    });
  });
});
