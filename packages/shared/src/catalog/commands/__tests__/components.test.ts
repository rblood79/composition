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
    // (ADR-279 Decision 6: the template goes with the definition; the instance that stood in the
    // node's place is an ordinary node now, as every other instance.)
    expect(graph.getEntry("project:node:card")).toBeUndefined();
    expect(children(graph, PAGE)).toHaveLength(3);
    for (const id of children(graph, PAGE))
      expect((graph.getEntry(id) as NodeEntry).definitionId).toBe(
        "lib:definition:section",
      );
    expect((graph.getEntry(PROJECT) as ProjectEntry).definitionIds).toEqual([]);
    expect(view(resolveCatalogNode(graph, first))).toEqual(shownFirst);
    expect(view(resolveCatalogNode(graph, second.id))).toEqual(shownSecond);
  });
});
