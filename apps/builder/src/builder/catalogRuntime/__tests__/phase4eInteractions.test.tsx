import "fake-indexeddb/auto";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  PageEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  createPage,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { I18nProvider } from "../../../i18n";
import { CatalogInteractionsPanel } from "../../panels/interactions/catalog/CatalogInteractionsPanel";
import {
  catalogCapabilityTargets,
  catalogDefaultAction,
  catalogInteractionsCommand,
  catalogInteractionsOf,
  catalogNewInteraction,
  catalogPageOptions,
  catalogSetStateAction,
  catalogTargetTypeName,
  catalogVisibleVariables,
  type CatalogActionContext,
} from "../interactions";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { catalogVariableCommands } from "../stateVariables";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4e Interactions: the code library names the rules vocabulary (triggers ·
 * capabilities · app actions), so a document can hold interaction records; the panel writes the
 * selected node's whole list as one step and only ever writes complete rules.
 */
const PROJECT = "project:project:interactions" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;
const ABOUT = "project:page:about" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (name: string, definitionId: string): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Interactions" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(
      indexedDB,
      `adr248-phase4e-interactions-${Math.random()}`,
    ),
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
        node("button", "lib:definition:type-Button"),
        node("tabs", "lib:definition:type-Tabs"),
      ],
      rootIds: [id("button"), id("tabs")],
      newId: workspace.newId,
    }),
  );
  const about: PageEntry = {
    kind: "page",
    id: ABOUT,
    route: "/about",
    name: "About",
    children: [],
  };
  workspace.execute(createPage({ page: about }));
  const graph = workspace.runtime.graph;
  const owner = { ownerId: id("button") };
  const context = (): CatalogActionContext => ({
    pages: catalogPageOptions(graph),
    currentPageId: HOME,
    variables: catalogVisibleVariables(graph, id("button")),
    targets: catalogCapabilityTargets(graph, HOME, id("button")),
  });
  return { workspace, graph, owner, context };
}

describe("ADR-248 Phase 4e-4e Interactions", () => {
  it("the code library names the old rules vocabulary", async () => {
    const { execution } = await buildCodeCatalogLibrary();
    expect([...execution.actionOpCodes].sort()).toEqual([
      "capability",
      "navigate",
      "setState",
      "toast",
    ]);
    for (const trigger of ["onPress", "onSelectionChange", "onAction"])
      expect(execution.triggerIds.has(trigger)).toBe(true);
    for (const capability of ["hide", "show", "toggle", "selectItem"])
      expect(execution.capabilityIds.has(capability)).toBe(true);
  });

  it("add · edit · delete write the owner's list as one step each; undo restores", async () => {
    const { workspace, graph, owner, context } = await open();
    expect(
      catalogTargetTypeName(graph, { kind: "node", id: id("button") }),
    ).toBe("Button");
    const navigate = catalogDefaultAction("navigate", context())!;
    // The first page other than the current one.
    expect(navigate).toEqual({ opcode: "navigate", pageId: ABOUT });
    const rule = catalogNewInteraction(
      owner,
      "onPress",
      navigate,
      workspace.newId,
    );
    const start = graph.revision;
    workspace.execute(catalogInteractionsCommand(owner, [rule], "Add"));
    expect(graph.revision).toBe(start + 1);
    expect(catalogInteractionsOf(graph, owner)).toEqual([rule]);

    // Capability on the Tabs node (the button itself is not a target).
    const targets = context().targets.map((target) => target.id);
    expect(targets).toContain(id("tabs"));
    expect(targets).not.toContain(id("button"));
    const capability: InteractionEntry = {
      ...rule,
      action: catalogDefaultAction("capability", context())!,
    };
    workspace.execute(catalogInteractionsCommand(owner, [capability], "Edit"));
    // The page body is listed but not the starting target.
    expect(context().targets[0]).toMatchObject({ id: BODY, pageRoot: true });
    expect(catalogInteractionsOf(graph, owner)[0]!.action).toEqual({
      opcode: "capability",
      targetId: id("tabs"),
      capabilityId: "hide",
    });
    const second = catalogNewInteraction(
      owner,
      "onPress",
      { opcode: "toast", message: "hi" },
      workspace.newId,
    );
    workspace.execute(
      catalogInteractionsCommand(owner, [capability, second], "Add"),
    );
    expect(catalogInteractionsOf(graph, owner).map((r) => r.id)).toEqual([
      rule.id,
      second.id,
    ]);
    // Editing the first rule keeps its place (the project list orders an owner's rules).
    const edited: InteractionEntry = {
      ...capability,
      action: { opcode: "toast", message: "edited" },
    };
    workspace.execute(
      catalogInteractionsCommand(owner, [edited, second], "Edit"),
    );
    expect(catalogInteractionsOf(graph, owner).map((r) => r.id)).toEqual([
      rule.id,
      second.id,
    ]);
    workspace.execute(catalogInteractionsCommand(owner, [second], "Delete"));
    expect(graph.getEntry(rule.id)).toBeUndefined();
    workspace.undo();
    // The restored first rule is back in first place.
    expect(catalogInteractionsOf(graph, owner).map((r) => r.id)).toEqual([
      rule.id,
      second.id,
    ]);
    workspace.undo();
    workspace.undo();
    workspace.undo();
    expect(catalogInteractionsOf(graph, owner)).toEqual([rule]);
  });

  it("setState starts from a visible variable with a valid value; deleting the variable takes its rules", async () => {
    const { workspace, graph, owner, context } = await open();
    // No variable, no target on an empty page: those choices have nothing to point at.
    expect(catalogDefaultAction("setState", context())).toBeUndefined();
    expect(
      catalogDefaultAction("capability", { ...context(), targets: [] }),
    ).toBeUndefined();
    workspace.execute(
      catalogVariableCommands.add(HOME, "count", workspace.newId),
    );
    const variable = context().variables[0]!;
    expect(variable).toMatchObject({
      name: "count",
      group: "page",
      type: "string",
    });
    const set = catalogDefaultAction("setState", context())!;
    expect(set).toEqual({
      opcode: "setState",
      variableId: variable.id,
      op: "set",
      value: "",
    });
    // A value of another type is replaced by the type's empty value; ops the type lacks fall back.
    expect(catalogSetStateAction(variable, "set", 3)).toMatchObject({
      value: "",
    });
    expect(catalogSetStateAction(variable, "toggle")).toMatchObject({
      op: "set",
    });
    const rule = catalogNewInteraction(owner, "onPress", set, workspace.newId);
    workspace.execute(catalogInteractionsCommand(owner, [rule], "Add"));
    workspace.execute(catalogVariableCommands.remove(variable.id));
    expect(graph.getEntry(rule.id)).toBeUndefined();
    expect(catalogInteractionsOf(graph, owner)).toEqual([]);
    workspace.undo();
    expect(catalogInteractionsOf(graph, owner)).toEqual([rule]);
  });

  it("a rule at an instance address is listed only for that address", () => {
    const address = { instances: [id("card")], templatePath: [] };
    const entries: InteractionEntry[] = [
      {
        kind: "interaction",
        id: "project:interaction:a" as EntryId<"interaction">,
        ownerId: id("card"),
        trigger: "onPress",
        action: { opcode: "toast", message: "own" },
      },
      {
        kind: "interaction",
        id: "project:interaction:b" as EntryId<"interaction">,
        ownerId: id("card"),
        address: { instances: [id("card")], templatePath: [] },
        trigger: "onPress",
        action: { opcode: "toast", message: "descendant" },
      },
    ];
    const reader = {
      projectId: PROJECT,
      library: undefined as never,
      getEntry: (entryId: string) =>
        entryId === PROJECT
          ? ({
              kind: "project",
              interactionIds: [
                "project:interaction:b",
                "project:interaction:a",
              ],
            } as never)
          : (entries.find((entry) => entry.id === entryId) as never),
      ownerOf: () => undefined,
      referrersOf: () => new Set(entries.map((entry) => entry.id)),
    };
    expect(
      catalogInteractionsOf(reader as never, { ownerId: id("card") }).map(
        (e) => e.id,
      ),
    ).toEqual(["project:interaction:a"]);
    expect(
      catalogInteractionsOf(reader as never, {
        ownerId: id("card"),
        address,
      }).map((e) => e.id),
    ).toEqual(["project:interaction:b"]);
  });

  it("the panel adds a rule to the selected node and deletes it (one step each)", async () => {
    const { workspace, graph, owner } = await open();
    workspace.selectRecords([workspace.root.recordsOfSource(id("button"))[0]!]);
    render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogInteractionsPanel />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    const start = graph.revision;
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add rule|Add/i }));
    });
    expect(graph.revision).toBe(start + 1);
    const [rule] = catalogInteractionsOf(graph, owner);
    expect(rule).toMatchObject({
      trigger: "onPress",
      action: { opcode: "navigate", pageId: ABOUT },
    });
    // The new rule opens with its summary naming the page.
    expect(screen.getByText("On press → go to page (About)")).toBeTruthy();
    // A second add appends to the list.
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Add rule|Add/i }));
    });
    const both = catalogInteractionsOf(graph, owner);
    expect(both.map((r) => r.id)).toEqual([rule!.id, expect.any(String)]);
    await act(async () => {
      fireEvent.click(
        screen.getAllByRole("button", { name: /delete rule/i })[0]!,
      );
    });
    expect(catalogInteractionsOf(graph, owner)).toEqual([both[1]]);
    expect(graph.revision).toBe(start + 3);
  });
});
