import { describe, expect, it } from "vitest";
import type {
  EntryId,
  EntryKind,
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
import { setFields } from "../fields";
import {
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
          actions: [{
            opcode: "setState",
            variableId: "project:stateVariable:open",
            op: "toggle",
          }],
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

  // The old paste put absolutely placed copies 10 px from their source, and "Paste here" at the
  // pointer; in-flow copies keep their position.
  it("places absolute copies by offset or at a point; in-flow copies are unmoved", () => {
    const graph = graphOf(
      [
        node("a", "lib:definition:section", {
          layout: { position: { kind: "set", value: "absolute" }, insetLeft: { kind: "set", value: "100px" }, insetTop: { kind: "set", value: "50px" } },
        }),
        node("b", "lib:definition:section", {
          layout: { position: { kind: "set", value: "absolute" }, insetLeft: { kind: "set", value: "140px" }, insetTop: { kind: "set", value: "90px" } },
        }),
        node("flow", "lib:definition:section"),
        node("target", "lib:definition:section"),
      ],
      ["a", "b", "flow", "target"],
    );
    const newId = allocator();
    // ADR-275: an authored absolute box's position is its layout insets.
    const placementOf = (id: string) => {
      const layout = (graph.getEntry(id) as NodeEntry).layout;
      return layout
        ? {
            kind: (layout.position as { value: string }).value,
            x: parseFloat((layout.insetLeft as { value: string }).value),
            y: parseFloat((layout.insetTop as { value: string }).value),
          }
        : undefined;
    };
    const duplicate = run(
      graph,
      duplicateNodes({
        ids: ["project:node:a", "project:node:flow"],
        newId,
        placement: { offset: { x: 10, y: 10 } },
      }),
    );
    const [aCopy, flowCopy] = duplicate.plan.selectAfter!;
    expect(placementOf(aCopy)).toEqual({ kind: "absolute", x: 110, y: 60 });
    expect(placementOf(flowCopy)).toBeUndefined();
    expect(placementOf("project:node:a")).toEqual({
      kind: "absolute",
      x: 100,
      y: 50,
    });

    const clipboard = copyNodes(graph, ["project:node:a", "project:node:b"]);
    run(
      graph,
      pasteNodes({
        clipboard,
        parent: { kind: "node", id: "project:node:target" },
        newId,
        placement: { at: { x: 20, y: 30 } },
      }),
    );
    const [first, second] = children(graph, "project:node:target");
    // The first root lands at the point; the second keeps its distance (+40, +40).
    expect(placementOf(first)).toEqual({ kind: "absolute", x: 20, y: 30 });
    expect(placementOf(second)).toEqual({ kind: "absolute", x: 60, y: 70 });
    // Without a placement option a paste is a verbatim copy (other callers).
    run(
      graph,
      pasteNodes({
        clipboard,
        parent: { kind: "node", id: "project:node:target" },
        newId,
      }),
    );
    expect(placementOf(children(graph, "project:node:target")[2])).toEqual({
      kind: "absolute",
      x: 100,
      y: 50,
    });
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

  it("carries a nested instance's overrides; freezes a template binding into the owned copy", () => {
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
    // The picker root holds the `{label}` title: the owned copy takes the instance's current label
    // and keeps it — it no longer follows the label (user decision 2026-10-12 「A」, as a detach).
    let frozen = 0;
    run(
      graph,
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
        newId: <K extends EntryKind>(kind: K) =>
          `project:${kind}:frozen-${kind}-${++frozen}` as EntryId<K>,
      }),
    );
    const titleOf = () =>
      (
        resolveCatalogNode(graph, "project:node:pick").children[0].children[0]
          .props as Record<string, unknown>
      ).children;
    expect(titleOf()).toBe("Pick");
    expect(JSON.stringify(pageView(graph)[1])).toContain('"y"');
    run(
      graph,
      setFields({
        targets: [{ kind: "node", id: "project:node:pick" }],
        props: { label: { kind: "set", value: "Choose" } },
      }),
    );
    expect(resolveCatalogNode(graph, "project:node:pick").props.label).toBe(
      "Choose",
    );
    expect(titleOf()).toBe("Pick");
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
    // Under different parents (the old Pencil-style group): the group takes the first selected
    // one's place, the others move in after it, in selection order.
    const across = run(
      graph,
      groupNodes({
        ids: ["project:node:a", "project:node:d"],
        group: node("g2", "lib:definition:section"),
        newId,
      }),
    );
    expect(children(graph, "project:node:box")).toEqual([
      "project:node:g2",
      "project:node:g",
    ]);
    expect(children(graph, "project:node:g2")).toEqual([
      "project:node:a",
      "project:node:d",
    ]);
    expect(children(graph, "project:node:other")).toEqual([]);
    undo(graph, across.result.inverse);
    expect(children(graph, "project:node:other")).toEqual(["project:node:d"]);
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
