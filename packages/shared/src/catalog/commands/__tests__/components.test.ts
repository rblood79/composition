import { describe, expect, it } from "vitest";
import type {
  DefinitionEntry,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../../document/types";
import { resolveCatalogNode } from "../../resolution/resolver";
import {
  createComponent,
  detachInstances,
  dissolveComponent,
  setLibraryDefault,
} from "../components";
import {
  allocator,
  children,
  code,
  graphOf,
  node,
  PAGE,
  pageView,
  PROJECT,
  run,
  snapshot,
  text,
  undo,
  view,
} from "./fixture";

/**
 * ADR-248 Phase 4b component commands, judged by what the page shows: detach and componentize
 * change the records, not the rendering; library defaults reach every instance.
 */
describe("ADR-248 Phase 4b component commands", () => {
  it("detaches an instance in place: same ID, same rendering, bindings frozen", () => {
    const graph = graphOf(
      [
        node("pick", "lib:definition:picker", {
          props: { label: { kind: "set", value: "Hi" } },
          visual: { color: { kind: "set", value: "red" } },
          descendantOverrides: [
            {
              kind: "patch",
              address: {
                instances: ["project:node:pick"],
                templatePath: [
                  "lib:template:pickRoot",
                  "lib:template:list",
                  "lib:template:item2",
                ],
              },
              props: { children: { kind: "set", value: "Second" } },
            },
          ],
        }),
      ],
      ["pick"],
    );
    const initial = snapshot(graph);
    const shown = pageView(graph);
    const detached = run(
      graph,
      detachInstances({ ids: ["project:node:pick"], newId: allocator() }),
    );
    const entry = graph.getEntry("project:node:pick") as NodeEntry;
    expect(entry.definitionId).toBe("lib:definition:section");
    expect(entry.descendantOverrides).toEqual([]);
    expect(entry.children).toHaveLength(3);
    // The composite layer is gone, so compare the instance's root with the detached node.
    const before = shown[0] as { children: unknown[] };
    expect(view(resolveCatalogNode(graph, "project:node:pick"))).toEqual({
      ...(before.children[0] as object),
      visual: expect.objectContaining({ color: "red" }),
    });
    expect(JSON.stringify(pageView(graph))).toContain('"Hi"');
    expect(JSON.stringify(pageView(graph))).toContain('"Second"');
    undo(graph, detached.result.inverse);
    expect(snapshot(graph)).toBe(initial);
    expect(
      code(() =>
        detachInstances({ ids: ["project:node:t"], newId: allocator() })(
          graphOf([text("t", "x")], ["t"]),
        ),
      ),
    ).toBe("NOT_AN_INSTANCE");
  });

  it("writes a library definition's project default once and reuses its override record", () => {
    const graph = graphOf(
      [text("a", "A"), node("b", "lib:definition:text")],
      ["a", "b"],
    );
    const newId = allocator();
    run(
      graph,
      setLibraryDefault({
        definitionId: "lib:definition:text",
        scope: "defaults",
        key: "children",
        write: { kind: "set", value: "Default" },
        newId,
      }),
    );
    run(
      graph,
      setLibraryDefault({
        definitionId: "lib:definition:text",
        scope: "visual",
        key: "color",
        write: { kind: "set", value: "blue" },
        newId,
      }),
    );
    expect((graph.getEntry(PROJECT) as ProjectEntry).overrideIds).toHaveLength(
      1,
    );
    const a = resolveCatalogNode(graph, "project:node:a");
    const b = resolveCatalogNode(graph, "project:node:b");
    expect(a.props.children).toBe("A");
    expect(b.props.children).toBe("Default");
    expect(a.visual.color).toBe("blue");
  });

  it("makes a component: the node stays in place as its origin (ADR-260)", () => {
    const graph = graphOf(
      [
        node("card", "lib:definition:section", {
          children: ["project:node:t"],
          layout: { position: { kind: "set", value: "absolute" }, insetLeft: { kind: "set", value: "10px" }, insetTop: { kind: "set", value: "20px" } },
        }),
        text("t", "Title"),
      ],
      ["card"],
    );
    const initial = snapshot(graph);
    const shown = pageView(graph);
    const created = run(
      graph,
      createComponent({
        id: "project:node:card",
        name: "Card",
        newId: allocator(),
      }),
    );
    expect(created.plan.selectAfter).toEqual(["project:node:card"]);
    expect(children(graph, PAGE)).toEqual(["project:node:card"]);
    const [definitionId] = (graph.getEntry(PROJECT) as ProjectEntry)
      .definitionIds;
    expect(graph.getEntry(definitionId)).toMatchObject({
      kind: "definition",
      name: "Card",
      usage: "component",
      templateRootId: "project:node:card",
      originRef: true,
    });
    expect((graph.getEntry("project:node:card") as NodeEntry).layout).toEqual(
      { position: { kind: "set", value: "absolute" }, insetLeft: { kind: "set", value: "10px" }, insetTop: { kind: "set", value: "20px" } },
    );
    expect(graph.ownerOf("project:node:card")).toBe(PAGE);
    expect(pageView(graph)).toEqual(shown);
    // An instance placed later shows the origin's content.
    const page = graph.getEntry(PAGE) as PageEntry;
    const instance = node("inst", definitionId);
    run(graph, () => ({
      label: "add",
      ops: [
        { kind: "put", entry: instance },
        {
          kind: "put",
          entry: { ...page, children: [...page.children, instance.id] },
        },
      ],
    }));
    expect(
      (view(resolveCatalogNode(graph, instance.id)) as { children: unknown[] })
        .children,
    ).toEqual([shown[0]]);
    const fresh = graphOf(
      [
        node("card", "lib:definition:section", {
          children: ["project:node:t"],
          layout: { position: { kind: "set", value: "absolute" }, insetLeft: { kind: "set", value: "10px" }, insetTop: { kind: "set", value: "20px" } },
        }),
        text("t", "Title"),
      ],
      ["card"],
    );
    const again = run(
      fresh,
      createComponent({
        id: "project:node:card",
        name: "Card",
        newId: allocator(),
      }),
    );
    undo(fresh, again.result.inverse);
    expect(snapshot(fresh)).toBe(initial);
  });

  it("dissolves a component: instances keep what they showed, the definition goes", () => {
    const graph = graphOf(
      [
        node("card", "lib:definition:section", {
          children: ["project:node:t"],
        }),
        text("t", "Title"),
      ],
      ["card"],
    );
    const newId = allocator();
    run(
      graph,
      createComponent({ id: "project:node:card", name: "Card", newId }),
    );
    const [definitionId] = (graph.getEntry(PROJECT) as ProjectEntry)
      .definitionIds;
    const first = "project:node:first" as NodeId;
    // Two instances; the second with an authored override on the template text.
    const page = graph.getEntry(PAGE) as PageEntry;
    const second = node("second", definitionId, {
      descendantOverrides: [
        {
          kind: "patch",
          address: {
            instances: ["project:node:second"],
            templatePath: ["project:node:card", "project:node:t"],
          },
          props: { children: { kind: "set", value: "Other" } },
        },
      ],
    });
    run(graph, () => ({
      label: "add",
      ops: [
        { kind: "put", entry: node("first", definitionId) },
        { kind: "put", entry: second },
        {
          kind: "put",
          entry: { ...page, children: [...page.children, first, second.id] },
        },
      ],
    }));
    const inner = (id: NodeId) =>
      (view(resolveCatalogNode(graph, id)) as { children: unknown[] })
        .children[0];
    const shownFirst = inner(first);
    const shownSecond = inner(second.id);
    run(
      graph,
      dissolveComponent({ definitionId: definitionId as never, newId }),
    );
    expect(graph.getEntry(definitionId)).toBeUndefined();
    // (ADR-260 Decision 5: the origin stays where it was, an ordinary node.)
    expect(children(graph, PAGE)[0]).toBe("project:node:card");
    expect(graph.getEntry("project:node:card")?.kind).toBe("node");
    expect((graph.getEntry(PROJECT) as ProjectEntry).definitionIds).toEqual([]);
    expect(view(resolveCatalogNode(graph, first))).toEqual(shownFirst);
    expect(view(resolveCatalogNode(graph, second.id))).toEqual(shownSecond);
  });
});
