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

  it("makes a component: template to Components, an instance in place", () => {
    const graph = graphOf(
      [
        node("card", "lib:definition:section", {
          children: ["project:node:t"],
          placement: { kind: "absolute", x: 10, y: 20 },
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
    const [instanceId] = created.plan.selectAfter!;
    expect(children(graph, PAGE)).toEqual([instanceId]);
    const instance = graph.getEntry(instanceId) as NodeEntry;
    const definition = graph.getEntry(instance.definitionId) as DefinitionEntry;
    expect(definition).toMatchObject({
      kind: "definition",
      name: "Card",
      usage: "component",
      templateRootId: "project:node:card",
    });
    expect(instance.placement).toEqual({ kind: "absolute", x: 10, y: 20 });
    expect(
      (graph.getEntry("project:node:card") as NodeEntry).placement,
    ).toBeUndefined();
    expect(graph.ownerOf("project:node:card")).toBe(definition.id);
    // The instance shows the template root's content.
    expect(
      (view(resolveCatalogNode(graph, instanceId)) as { children: unknown[] })
        .children,
    ).toEqual([
      {
        ...(shown[0] as object),
        children: (shown[0] as { children: unknown[] }).children,
      },
    ]);
    undo(graph, created.result.inverse);
    expect(snapshot(graph)).toBe(initial);
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
    const created = run(
      graph,
      createComponent({ id: "project:node:card", name: "Card", newId }),
    );
    const [first] = created.plan.selectAfter!;
    const definitionId = (graph.getEntry(first) as NodeEntry).definitionId;
    // A second instance with an authored override on the template text.
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
        { kind: "put", entry: second },
        {
          kind: "put",
          entry: { ...page, children: [...page.children, second.id] },
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
    expect(graph.getEntry("project:node:card")).toBeUndefined();
    expect((graph.getEntry(PROJECT) as ProjectEntry).definitionIds).toEqual([]);
    expect(view(resolveCatalogNode(graph, first))).toEqual(shownFirst);
    expect(view(resolveCatalogNode(graph, second.id))).toEqual(shownSecond);
  });
});
