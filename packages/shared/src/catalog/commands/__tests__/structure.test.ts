import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../document/graph";
import { buildCatalogLibrary } from "../../document/library";
import type {
  CatalogDocument,
  CatalogEntry,
  EntryId,
  EntryKind,
  InstanceAddress,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../../document/types";
import { CatalogValidationError } from "../../document/validation";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import type { CatalogCommand } from "../compose";
import {
  copyNodes,
  duplicateNodes,
  insertNodes,
  moveNodes,
  pasteNodes,
  removeTargets,
} from "../structure";

/**
 * ADR-248 Phase 4b structure commands, judged by the resolved relation (not by the ops): each
 * edit is one transaction and one history entry, its inverse restores the graph, and an instance's
 * container position keeps what it showed when its template children become owned nodes.
 */
const library = () =>
  buildCatalogLibrary({
    contractVersion: 1,
    revision: "phase4b-structure",
    bindingIds: ["section", "text", "listbox", "item"],
    actionOpCodes: ["setState", "capability"],
    triggerIds: ["press"],
    capabilityIds: ["selectItem"],
    definitions: [
      {
        id: "lib:definition:section",
        name: "Section",
        mode: "native",
        bindingId: "section",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:text",
        name: "Text",
        mode: "primitive",
        bindingId: "text",
        accepts: { children: "string" },
        defaults: { children: "" },
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:listbox",
        name: "ListBox",
        mode: "primitive",
        bindingId: "listbox",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:item",
        name: "ListBoxItem",
        mode: "primitive",
        bindingId: "item",
        accepts: { children: "string" },
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:badge",
        name: "Badge",
        mode: "composite",
        templateRootId: "lib:template:badgeRoot",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:panel",
        name: "Panel",
        mode: "composite",
        templateRootId: "lib:template:panelRoot",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:picker",
        name: "Picker",
        mode: "composite",
        templateRootId: "lib:template:pickRoot",
        accepts: { label: "string" },
        defaults: { label: "Pick" },
        visual: {},
        stateRules: {},
      },
    ],
    templates: [
      {
        id: "lib:template:badgeRoot",
        definitionId: "lib:definition:section",
        children: ["lib:template:badgeText"],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:badgeText",
        definitionId: "lib:definition:text",
        children: [],
        props: { children: "badge" },
        visual: {},
      },
      {
        id: "lib:template:panelRoot",
        definitionId: "lib:definition:section",
        children: ["lib:template:panelBadge"],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:panelBadge",
        definitionId: "lib:definition:badge",
        children: [],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:pickRoot",
        definitionId: "lib:definition:section",
        children: [
          "lib:template:title",
          "lib:template:list",
          "lib:template:badge",
        ],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:title",
        definitionId: "lib:definition:text",
        children: [],
        props: { children: "{label}" },
        visual: {},
      },
      {
        id: "lib:template:list",
        definitionId: "lib:definition:listbox",
        children: ["lib:template:item1", "lib:template:item2"],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:item1",
        definitionId: "lib:definition:item",
        children: [],
        props: { children: "One" },
        visual: {},
      },
      {
        id: "lib:template:item2",
        definitionId: "lib:definition:item",
        children: [],
        props: { children: "Two" },
        visual: {},
      },
      {
        id: "lib:template:badge",
        definitionId: "lib:definition:badge",
        children: [],
        props: {},
        visual: {},
      },
    ],
    tokens: [],
  });

const PAGE = "project:page:main" as const;
const PROJECT = "project:project:p" as const;
const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeId,
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
function graphOf(
  nodes: NodeEntry[],
  roots: string[],
  extra: CatalogEntry[] = [],
) {
  const project: ProjectEntry = {
    kind: "project",
    id: PROJECT,
    name: "p",
    pageIds: [PAGE],
    definitionIds: [],
    overrideIds: [],
    themeIds: [],
    tokenIds: [],
    stateVariableIds: extra
      .filter((entry) => entry.kind === "stateVariable")
      .map((entry) => entry.id as EntryId<"stateVariable">),
    interactionIds: extra
      .filter((entry) => entry.kind === "interaction")
      .map((entry) => entry.id as EntryId<"interaction">),
    assetIds: [],
  };
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 1,
    revision: 0,
    projectId: PROJECT,
    rootId: PROJECT,
    entries: Object.fromEntries(
      [
        project,
        {
          kind: "page",
          id: PAGE,
          route: "/",
          name: "main",
          children: roots.map((id) => `project:node:${id}` as NodeId),
        } as PageEntry,
        ...nodes,
        ...extra,
      ].map((entry) => [entry.id, entry]),
    ),
  };
  return new CatalogGraph(document, library());
}
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:n${++next}` as EntryId<K>;
};
function run(graph: CatalogGraph, command: CatalogCommand) {
  const plan = command(graph);
  const before = graph.history.length;
  const result = applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label: plan.label },
    ops: plan.ops,
  });
  expect(graph.history.length).toBe(before + 1);
  return { plan, result };
}
const undo = (graph: CatalogGraph, inverse: readonly unknown[]) =>
  applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label: "undo" },
    ops: inverse as never,
  });
const snapshot = (graph: CatalogGraph) =>
  JSON.stringify(
    Object.entries(graph.exportDocument().entries).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  );
const code = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogValidationError) return error.code;
    throw error;
  }
  return "ACCEPTED";
};
/** What a consumer sees: definitions, props and visual, by position (IDs dropped). */
const view = (node: ResolvedCatalogNode): unknown => ({
  definitionId: node.definitionId,
  props: node.props,
  visual: node.visual,
  children: node.children.map(view),
});
const pageView = (graph: CatalogGraph) =>
  (graph.getEntry(PAGE) as PageEntry).children.map((id) =>
    view(resolveCatalogNode(graph, id)),
  );
const children = (graph: CatalogGraph, id: string) => {
  const entry = graph.getEntry(id);
  return entry?.kind === "page" || entry?.kind === "node" ? entry.children : [];
};
const text = (id: string, value: string) =>
  node(id, "lib:definition:text", {
    props: { children: { kind: "set", value } },
  });

describe("ADR-248 Phase 4b structure commands", () => {
  it("inserts into a page and a node; the inverse restores; nesting is checked", () => {
    const graph = graphOf([node("box", "lib:definition:section")], ["box"]);
    const initial = snapshot(graph);
    const newId = allocator();
    const { plan, result } = run(
      graph,
      insertNodes({
        parent: { kind: "node", id: "project:node:box" },
        entries: [text("a", "A")],
        rootIds: ["project:node:a"],
        newId,
      }),
    );
    expect(plan.selectAfter).toEqual(["project:node:a"]);
    expect(children(graph, "project:node:box")).toEqual(["project:node:a"]);
    run(
      graph,
      insertNodes({
        parent: { kind: "page", id: PAGE },
        index: 0,
        entries: [text("b", "B")],
        rootIds: ["project:node:b"],
        newId,
      }),
    );
    expect(children(graph, PAGE)).toEqual([
      "project:node:b",
      "project:node:box",
    ]);
    // A ListBox reads only its item types.
    run(
      graph,
      insertNodes({
        parent: { kind: "page", id: PAGE },
        entries: [node("list", "lib:definition:listbox")],
        rootIds: ["project:node:list"],
        newId,
      }),
    );
    expect(
      code(() =>
        insertNodes({
          parent: { kind: "node", id: "project:node:list" },
          entries: [text("c", "C")],
          rootIds: ["project:node:c"],
          newId,
        })(graph),
      ),
    ).toBe("NESTING_NOT_ALLOWED");
    expect(
      code(() =>
        insertNodes({
          parent: { kind: "page", id: PAGE },
          entries: [text("a", "dup")],
          rootIds: ["project:node:a"],
          newId,
        })(graph),
      ),
    ).toBe("ID_COLLISION");
    const revisionBefore = snapshot(graph);
    expect(revisionBefore).not.toBe(initial);
    // Inverses in reverse order restore the starting graph.
    const g2 = graphOf([node("box", "lib:definition:section")], ["box"]);
    const one = run(
      g2,
      insertNodes({
        parent: { kind: "node", id: "project:node:box" },
        entries: [text("a", "A")],
        rootIds: ["project:node:a"],
        newId: allocator(),
      }),
    );
    undo(g2, one.result.inverse);
    expect(snapshot(g2)).toBe(initial);
    expect(result.impact.structural).toBe(true);
  });

  it("moves and reorders; a node cannot move into itself", () => {
    const graph = graphOf(
      [
        node("box", "lib:definition:section", {
          children: ["project:node:a", "project:node:b", "project:node:c"],
        }),
        text("a", "A"),
        text("b", "B"),
        text("c", "C"),
        node("other", "lib:definition:section"),
      ],
      ["box", "other"],
    );
    const initial = snapshot(graph);
    const newId = allocator();
    // Reorder: c to the front (index among the siblings without the moved node).
    const reorder = run(
      graph,
      moveNodes({
        ids: ["project:node:c"],
        parent: { kind: "node", id: "project:node:box" },
        index: 0,
        newId,
      }),
    );
    expect(children(graph, "project:node:box")).toEqual([
      "project:node:c",
      "project:node:a",
      "project:node:b",
    ]);
    const across = run(
      graph,
      moveNodes({
        ids: ["project:node:a", "project:node:b"],
        parent: { kind: "node", id: "project:node:other" },
        newId,
      }),
    );
    expect(children(graph, "project:node:box")).toEqual(["project:node:c"]);
    expect(children(graph, "project:node:other")).toEqual([
      "project:node:a",
      "project:node:b",
    ]);
    expect(across.result.impact.affectedParents).toEqual(
      new Set(["project:node:box", "project:node:other"]),
    );
    expect(
      code(() =>
        moveNodes({
          ids: ["project:node:other"],
          parent: { kind: "node", id: "project:node:a" },
          newId,
        })(graph),
      ),
    ).toBe("MOVE_INTO_SELF");
    undo(graph, across.result.inverse);
    undo(graph, reorder.result.inverse);
    expect(snapshot(graph)).toBe(initial);
  });

  it("removes a subtree with its owned records and the records that name it", () => {
    const graph = graphOf(
      [
        node("box", "lib:definition:section", {
          children: ["project:node:a"],
        }),
        text("a", "A"),
        node("button", "lib:definition:section"),
        node("pick", "lib:definition:picker"),
      ],
      ["box", "button", "pick"],
      [
        {
          kind: "stateVariable",
          id: "project:stateVariable:open",
          ownerId: "project:node:box",
          name: "open",
          valueType: "boolean",
          defaultValue: false,
        },
        {
          kind: "interaction",
          id: "project:interaction:toggle",
          ownerId: "project:node:button",
          trigger: "press",
          action: {
            opcode: "setState",
            variableId: "project:stateVariable:open",
            op: "toggle",
          },
        },
      ],
    );
    const initial = snapshot(graph);
    const removed = run(
      graph,
      removeTargets({
        targets: [
          { kind: "node", id: "project:node:box" },
          { kind: "node", id: "project:node:a" },
          {
            kind: "descendant",
            ownerId: "project:node:pick",
            address: {
              instances: ["project:node:pick"],
              templatePath: ["lib:template:pickRoot", "lib:template:badge"],
            },
          },
        ],
      }),
    );
    expect(children(graph, PAGE)).toEqual([
      "project:node:button",
      "project:node:pick",
    ]);
    for (const id of [
      "project:node:box",
      "project:node:a",
      "project:stateVariable:open",
      "project:interaction:toggle",
    ])
      expect(graph.getEntry(id)).toBeUndefined();
    const project = graph.getEntry(PROJECT) as ProjectEntry;
    expect(project.stateVariableIds).toEqual([]);
    expect(project.interactionIds).toEqual([]);
    // The template position is hidden, not deleted.
    expect(
      resolveCatalogNode(graph, "project:node:pick").children[0].children.map(
        (child) => child.sourceId,
      ),
    ).toEqual(["lib:template:title", "lib:template:list"]);
    undo(graph, removed.result.inverse);
    expect(snapshot(graph)).toBe(initial);
  });

  it("duplicates after the original and pastes a copied selection with new IDs", () => {
    const graph = graphOf(
      [
        node("box", "lib:definition:section", {
          children: ["project:node:a"],
        }),
        text("a", "A"),
        node("target", "lib:definition:section"),
      ],
      ["box", "target"],
      [
        {
          kind: "stateVariable",
          id: "project:stateVariable:open",
          ownerId: "project:node:box",
          name: "open",
          valueType: "boolean",
          defaultValue: false,
        },
      ],
    );
    const newId = allocator();
    const before = pageView(graph);
    const duplicate = run(
      graph,
      duplicateNodes({ ids: ["project:node:box", "project:node:a"], newId }),
    );
    const [copyId] = duplicate.plan.selectAfter!;
    expect(children(graph, PAGE)).toEqual([
      "project:node:box",
      copyId,
      "project:node:target",
    ]);
    expect(view(resolveCatalogNode(graph, copyId))).toEqual(before[0]);
    expect(
      (graph.getEntry(PROJECT) as ProjectEntry).stateVariableIds,
    ).toHaveLength(2);
    const clipboard = copyNodes(graph, ["project:node:box"]);
    for (let round = 0; round < 2; round++)
      run(
        graph,
        pasteNodes({
          clipboard,
          parent: { kind: "node", id: "project:node:target" },
          newId,
        }),
      );
    const pasted = children(graph, "project:node:target");
    expect(pasted).toHaveLength(2);
    expect(new Set(pasted).size).toBe(2);
    for (const id of pasted)
      expect(view(resolveCatalogNode(graph, id))).toEqual(before[0]);
    expect(
      (graph.getEntry(PROJECT) as ProjectEntry).stateVariableIds,
    ).toHaveLength(4);
  });

  it("materializes an instance's container position and keeps what it showed", () => {
    const listAddress: InstanceAddress = {
      instances: ["project:node:pick"],
      templatePath: ["lib:template:pickRoot", "lib:template:list"],
    };
    const graph = graphOf(
      [
        node("pick", "lib:definition:picker", {
          descendantOverrides: [
            {
              kind: "patch",
              address: {
                instances: ["project:node:pick"],
                templatePath: [
                  "lib:template:pickRoot",
                  "lib:template:list",
                  "lib:template:item1",
                ],
              },
              props: { children: { kind: "set", value: "First" } },
            },
          ],
        }),
      ],
      ["pick"],
    );
    const initial = snapshot(graph);
    const shown = pageView(graph);
    const newId = allocator();
    const inserted = run(
      graph,
      insertNodes({
        parent: {
          kind: "descendant",
          ownerId: "project:node:pick",
          address: listAddress,
        },
        entries: [
          node("three", "lib:definition:item", {
            props: { children: { kind: "set", value: "Three" } },
          }),
        ],
        rootIds: ["project:node:three"],
        newId,
      }),
    );
    const list = resolveCatalogNode(graph, "project:node:pick").children[0]
      .children[1];
    expect(list.children.map((item) => item.props.children)).toEqual([
      "First",
      "Two",
      "Three",
    ]);
    // Everything else the instance showed is unchanged.
    const after = pageView(graph) as Array<{
      children: Array<{ children: unknown[] }>;
    }>;
    const before = shown as typeof after;
    after[0].children[0].children[1] = before[0].children[0].children[1];
    expect(after).toEqual(before);
    const owner = graph.getEntry("project:node:pick") as NodeEntry;
    expect(owner.descendantOverrides).toEqual([
      expect.objectContaining({ kind: "fillSlot", address: listAddress }),
    ]);
    // Structural edits in the materialized position are ordinary owned edits now.
    const [firstId] = (
      owner.descendantOverrides[0] as { childIds: readonly NodeId[] }
    ).childIds;
    const moved = run(
      graph,
      moveNodes({
        ids: [firstId],
        parent: {
          kind: "descendant",
          ownerId: "project:node:pick",
          address: listAddress,
        },
        newId,
      }),
    );
    expect(
      resolveCatalogNode(
        graph,
        "project:node:pick",
      ).children[0].children[1].children.map((item) => item.props.children),
    ).toEqual(["Two", "Three", "First"]);
    undo(graph, moved.result.inverse);
    undo(graph, inserted.result.inverse);
    expect(snapshot(graph)).toBe(initial);
  });

  it("carries a nested instance's overrides; refuses a position with a template binding", () => {
    const graph = graphOf(
      [
        node("panel", "lib:definition:panel", {
          descendantOverrides: [
            {
              kind: "patch",
              address: {
                instances: ["project:node:panel", "lib:template:panelBadge"],
                templatePath: [
                  "lib:template:badgeRoot",
                  "lib:template:badgeText",
                ],
              } as InstanceAddress,
              props: { children: { kind: "set", value: "New!" } },
            },
          ],
        }),
        node("pick", "lib:definition:picker"),
      ],
      ["panel", "pick"],
    );
    const shown = pageView(graph) as Array<{ children: unknown[] }>;
    run(
      graph,
      insertNodes({
        parent: {
          kind: "descendant",
          ownerId: "project:node:panel",
          address: {
            instances: ["project:node:panel"],
            templatePath: ["lib:template:panelRoot"],
          },
        },
        entries: [text("x", "x")],
        rootIds: ["project:node:x"],
        newId: allocator(),
      }),
    );
    const after = pageView(graph) as Array<{
      children: Array<{ children: unknown[] }>;
    }>;
    // The badge (now an owned instance) still shows the override; the new text follows it.
    expect(after[0].children[0].children.slice(0, 1)).toEqual(
      (shown[0].children[0] as { children: unknown[] }).children,
    );
    expect(JSON.stringify(after[0])).toContain("New!");
    expect(after[1]).toEqual(shown[1]);
    // The picker root holds the `{label}` title: an owned copy could not follow the label.
    expect(
      code(() =>
        insertNodes({
          parent: {
            kind: "descendant",
            ownerId: "project:node:pick",
            address: {
              instances: ["project:node:pick"],
              templatePath: ["lib:template:pickRoot"],
            },
          },
          entries: [text("y", "y")],
          rootIds: ["project:node:y"],
          newId: allocator(),
        })(graph),
      ),
    ).toBe("POSITION_HAS_TEMPLATE_BINDING");
  });
});
