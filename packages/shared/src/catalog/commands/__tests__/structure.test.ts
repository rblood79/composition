import { describe, expect, it } from "vitest";
import type {
  InstanceAddress,
  NodeEntry,
  NodeId,
  ProjectEntry,
} from "../../document/types";
import { resolveCatalogNode } from "../../resolution/resolver";
import {
  copyNodes,
  duplicateNodes,
  groupNodes,
  insertNodes,
  moveNodes,
  pasteNodes,
  removeTargets,
  ungroupNodes,
} from "../structure";
import {
  library,
  PAGE,
  PROJECT,
  node,
  graphOf,
  allocator,
  run,
  undo,
  snapshot,
  code,
  view,
  pageView,
  children,
  text,
} from "./fixture";

/**
 * ADR-248 Phase 4b structure commands, judged by the resolved relation (not by the ops): each
 * edit is one transaction and one history entry, its inverse restores the graph, and an instance's
 * container position keeps what it showed when its template children become owned nodes.
 */
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

  it("groups siblings in place and ungroups them back", () => {
    const graph = graphOf(
      [
        node("box", "lib:definition:section", {
          children: ["project:node:a", "project:node:b", "project:node:c"],
        }),
        text("a", "A"),
        text("b", "B"),
        text("c", "C"),
        node("other", "lib:definition:section", {
          children: ["project:node:d"],
        }),
        text("d", "D"),
      ],
      ["box", "other"],
    );
    const initial = snapshot(graph);
    const shown = pageView(graph);
    const newId = allocator();
    const grouped = run(
      graph,
      groupNodes({
        ids: ["project:node:c", "project:node:b"],
        group: node("g", "lib:definition:section"),
        newId,
      }),
    );
    expect(grouped.plan.selectAfter).toEqual(["project:node:g"]);
    expect(children(graph, "project:node:box")).toEqual([
      "project:node:a",
      "project:node:g",
    ]);
    // Members keep their sibling order, not the selection order.
    expect(children(graph, "project:node:g")).toEqual([
      "project:node:b",
      "project:node:c",
    ]);
    expect(
      code(() =>
        groupNodes({
          ids: ["project:node:a", "project:node:d"],
          group: node("g2", "lib:definition:section"),
          newId,
        })(graph),
      ),
    ).toBe("GROUP_PARENTS_DIFFER");
    const ungrouped = run(
      graph,
      ungroupNodes({ ids: ["project:node:g"], newId }),
    );
    expect(ungrouped.plan.selectAfter).toEqual([
      "project:node:b",
      "project:node:c",
    ]);
    expect(graph.getEntry("project:node:g")).toBeUndefined();
    expect(pageView(graph)).toEqual(shown);
    undo(graph, ungrouped.result.inverse);
    undo(graph, grouped.result.inverse);
    expect(snapshot(graph)).toBe(initial);
    expect(
      code(() =>
        ungroupNodes({ ids: ["project:node:pick"], newId })(
          graphOf([node("pick", "lib:definition:picker")], ["pick"]),
        ),
      ),
    ).toBe("UNGROUP_INSTANCE");
  });
});
