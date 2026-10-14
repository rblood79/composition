/**
 * ADR-261 Phase 4 — user component properties, text · boolean (Decision 4 · G3): a property drives
 * origin nodes; an instance writes its value under the key on its root; the resolver projects it on
 * the driven positions (text → the prop, boolean → `enabled`) and never on the root record (R3).
 * The default is the origin node's own value. Detach keeps the values; removing or moving a driven
 * node out of the origin takes it off; deleting a property clears every instance's value.
 */
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../document/graph";
import type {
  AuthoredValue,
  CatalogEntry,
  DefinitionEntry,
  NodeEntry,
  NodeId,
  PageEntry,
} from "../../document/types";
import type { ResolvedCatalogNode } from "../../resolution/resolver";
import { readPropSource } from "../../resolution/fieldSource";
import { resolveCatalogNode } from "../../resolution/resolver";
import { detachInstances } from "../components";
import { setFields } from "../fields";
import {
  addComponentProperty,
  applyComponentProperty,
  detachComponentProperty,
  removeComponentProperty,
  renameComponentProperty,
} from "../properties";
import { moveNodes, removeTargets } from "../structure";
import { swapInstance } from "../swap";
import {
  allocator,
  code,
  documentOf,
  library,
  node,
  PAGE,
  run,
  snapshot,
  text,
  undo,
} from "./fixture";

const id = (name: string) => `project:node:${name}` as NodeId;
const SECTION = "lib:definition:section";
const CARD = "project:definition:Card" as const;
const OUTER = "project:definition:Outer" as const;
const LABEL = "project:definition:Label" as const;
const definition = (name: string, root: string): DefinitionEntry => ({
  kind: "definition",
  id: `project:definition:${name}`,
  name,
  mode: "composite",
  accepts: {},
  defaults: {},
  visual: {},
  stateRules: {},
  templateRootId: id(root),
  usage: "component",
  originRef: true,
});
const set = (value: AuthoredValue) => ({ kind: "set" as const, value });

/**
 * Card (origin on the page): cRoot > cTitle "Title" · cIcon "★". Outer (origin on the page):
 * oRoot > J (a Card instance). Label (origin on the page): a text root "Label". I: a Card
 * instance; K: an Outer instance; L: a Label instance.
 */
function fixture(): CatalogGraph {
  const nodes: NodeEntry[] = [
    node("cRoot", SECTION, { children: [id("cTitle"), id("cIcon")] }),
    text("cTitle", "Title"),
    text("cIcon", "★"),
    node("oRoot", SECTION, { children: [id("J")] }),
    node("J", CARD),
    text("lRoot", "Label"),
    node("I", CARD),
    node("K", OUTER),
    node("L", LABEL),
    text("away", "elsewhere"),
  ];
  const extra: CatalogEntry[] = [
    definition("Card", "cRoot"),
    definition("Outer", "oRoot"),
    definition("Label", "lRoot"),
  ];
  return new CatalogGraph(
    documentOf(
      nodes,
      ["cRoot", "oRoot", "lRoot", "I", "K", "L", "away"],
      extra,
    ),
    library(),
  );
}
/** Card gets `title` (text → cTitle) and `showIcon` (boolean → cIcon). */
function withProperties(): CatalogGraph {
  const graph = fixture();
  run(
    graph,
    addComponentProperty({
      definitionId: CARD,
      key: "title",
      name: "Title",
      kind: "text",
      target: { id: id("cTitle"), prop: "children" },
    }),
  );
  run(
    graph,
    addComponentProperty({
      definitionId: CARD,
      key: "showIcon",
      name: "Show icon",
      kind: "boolean",
      target: { id: id("cIcon") },
    }),
  );
  return graph;
}
const writeProps = (
  graph: CatalogGraph,
  target: NodeId,
  props: Record<string, AuthoredValue>,
) =>
  run(
    graph,
    setFields({
      targets: [{ kind: "node", id: target }],
      props: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [key, set(value)]),
      ),
    }),
  );
const texts = (resolved: ResolvedCatalogNode): string[] => {
  const out: string[] = [];
  const visit = (item: ResolvedCatalogNode) => {
    if (typeof item.props.children === "string") out.push(item.props.children);
    item.children.forEach(visit);
  };
  visit(resolved);
  return out;
};
const cardOf = (graph: CatalogGraph) => graph.getEntry(CARD) as DefinitionEntry;

describe("ADR-261 Phase 4 — component properties (text · boolean)", () => {
  it("an instance's values show on the driven positions; the origin keeps its own; no root prop", () => {
    const graph = withProperties();
    // Default: the origin nodes' own values.
    expect(texts(resolveCatalogNode(graph, id("I")))).toEqual(["Title", "★"]);
    writeProps(graph, id("I"), { title: "Hello", showIcon: false });
    const drawn = resolveCatalogNode(graph, id("I"));
    expect(texts(drawn)).toEqual(["Hello"]);
    // R3: the property keys are not the root record's props (the consumer record of an instance
    // is its template root's projection — `collapseLayers`).
    expect(drawn.children[0].props).not.toHaveProperty("title");
    expect(drawn.children[0].props).not.toHaveProperty("showIcon");
    // The origin draws itself.
    expect(texts(resolveCatalogNode(graph, id("cRoot")))).toEqual([
      "Title",
      "★",
    ]);
    writeProps(graph, id("I"), { showIcon: true });
    expect(texts(resolveCatalogNode(graph, id("I")))).toEqual(["Hello", "★"]);
  });

  it("the contract takes the keys with their kind's type; others are refused", () => {
    const graph = withProperties();
    expect(code(() => writeProps(graph, id("I"), { title: 3 }))).toBe(
      "PROP_TYPE_MISMATCH",
    );
    expect(code(() => writeProps(graph, id("I"), { other: "x" }))).toBe(
      "PROP_NOT_ACCEPTED",
    );
    expect(code(() => writeProps(graph, id("I"), { showIcon: true }))).toBe(
      "ACCEPTED",
    );
  });

  it("an instance's direct write at the position wins over the property (the panel shows it)", () => {
    const graph = withProperties();
    writeProps(graph, id("I"), { title: "Hello" });
    const target = {
      kind: "descendant" as const,
      ownerId: id("I"),
      address: {
        instances: [id("I")],
        templatePath: [id("cRoot"), id("cTitle")],
      },
    };
    expect(readPropSource(graph, target, "children")).toMatchObject({
      value: "Hello",
      source: "property",
    });
    run(
      graph,
      setFields({ targets: [target], props: { children: set("Direct") } }),
    );
    expect(texts(resolveCatalogNode(graph, id("I")))[0]).toBe("Direct");
    expect(readPropSource(graph, target, "children").value).toBe("Direct");
  });

  it("a nested instance: its own value, then the outer instance's patch on it", () => {
    const graph = withProperties();
    writeProps(graph, id("J"), { title: "Inner" });
    expect(texts(resolveCatalogNode(graph, id("K")))[0]).toBe("Inner");
    const atJ = {
      kind: "descendant" as const,
      ownerId: id("K"),
      address: { instances: [id("K")], templatePath: [id("oRoot"), id("J")] },
    };
    run(graph, setFields({ targets: [atJ], props: { title: set("Outer") } }));
    expect(texts(resolveCatalogNode(graph, id("K")))[0]).toBe("Outer");
    // The panel of the title position inside K reads the same value.
    expect(
      readPropSource(
        graph,
        {
          kind: "descendant",
          ownerId: id("K"),
          address: {
            instances: [id("K"), id("J")],
            templatePath: [id("cRoot"), id("cTitle")],
          },
        },
        "children",
      ),
    ).toMatchObject({ value: "Outer", source: "property" });
  });

  it("a text property on the component root: the instance's direct root write wins", () => {
    const graph = fixture();
    run(
      graph,
      addComponentProperty({
        definitionId: LABEL,
        key: "text",
        name: "Text",
        kind: "text",
        target: { id: id("lRoot"), prop: "children" },
      }),
    );
    writeProps(graph, id("L"), { text: "From property" });
    const drawn = resolveCatalogNode(graph, id("L")).children[0];
    expect(drawn.props.children).toBe("From property");
    expect(drawn.props).not.toHaveProperty("text");
    writeProps(graph, id("L"), { children: "Root write" });
    expect(resolveCatalogNode(graph, id("L")).children[0].props.children).toBe(
      "Root write",
    );
  });

  it("R3: a composite root (a library picker) does not take the property key as its prop", () => {
    const graph = new CatalogGraph(
      documentOf(
        [node("pRoot", "lib:definition:picker"), node("P", "project:definition:Pick")],
        ["pRoot", "P"],
        [definition("Pick", "pRoot")],
      ),
      library(),
    );
    run(
      graph,
      addComponentProperty({
        definitionId: "project:definition:Pick",
        key: "caption",
        name: "Caption",
        kind: "text",
        target: { id: id("pRoot"), prop: "label" },
      }),
    );
    writeProps(graph, id("P"), { caption: "Pick one" });
    const layers: ResolvedCatalogNode[] = [];
    const visit = (item: ResolvedCatalogNode) => {
      layers.push(item);
      item.children.forEach(visit);
    };
    visit(resolveCatalogNode(graph, id("P")).children[0]);
    expect(layers[0].props.label).toBe("Pick one");
    for (const layer of layers) expect(layer.props).not.toHaveProperty("caption");
  });

  it("review m1: swapping a nested instance a text property drives drops that target when the new component has no such text", () => {
    const graph = withProperties();
    // Outer's own text property on J's root text… (J's root is a section: no text — use Label.)
    run(graph, swapInstance({ id: id("J"), definitionId: LABEL }));
    run(
      graph,
      addComponentProperty({
        definitionId: OUTER,
        key: "caption",
        name: "Caption",
        kind: "text",
        target: { id: id("J"), prop: "children" },
      }),
    );
    writeProps(graph, id("K"), { caption: "Outer text" });
    const { plan } = run(graph, swapInstance({ id: id("J"), definitionId: CARD }));
    expect((graph.getEntry(OUTER) as DefinitionEntry).properties).toBeUndefined();
    expect((graph.getEntry(id("K")) as NodeEntry).props).toEqual({});
    expect(plan.label).toBeDefined();
    expect(() => new CatalogGraph(graph.exportDocument(), library())).not.toThrow();
  });

  it("review m2: a nested instance's own property is not a text target (deleting it would leave the outer one invalid)", () => {
    const graph = withProperties();
    expect(
      code(() =>
        run(
          graph,
          addComponentProperty({
            definitionId: OUTER,
            key: "outerTitle",
            name: "Outer title",
            kind: "text",
            target: { id: id("J"), prop: "title" },
          }),
        ),
      ),
    ).toBe("PROPERTY_TARGET_NESTED_PROPERTY");
  });

  it("refuses targets outside the origin, a boolean root, a non-text prop and a taken key", () => {
    const graph = fixture();
    const add = (input: Partial<Parameters<typeof addComponentProperty>[0]>) =>
      code(() =>
        run(
          graph,
          addComponentProperty({
            definitionId: CARD,
            key: "p",
            name: "P",
            kind: "text",
            target: { id: id("cTitle"), prop: "children" },
            ...input,
          }),
        ),
      );
    expect(add({ target: { id: id("away"), prop: "children" } })).toBe(
      "PROPERTY_TARGET_OUTSIDE",
    );
    expect(add({ kind: "boolean", target: { id: id("cRoot") } })).toBe(
      "PROPERTY_TARGET_ROOT",
    );
    expect(add({ target: { id: id("cTitle"), prop: "label" } })).toBe(
      "PROPERTY_PROP_NOT_TEXT",
    );
    expect(add({ key: "9bad" })).toBe("INVALID_PROPERTY_KEY");
    expect(
      add({
        definitionId: LABEL,
        key: "children",
        target: { id: id("lRoot"), prop: "children" },
      }),
    ).toBe("PROPERTY_KEY_TAKEN");
    // An old document's definition (no field) loads as is.
    expect(() => fixture()).not.toThrow();
  });

  it("apply · detach · rename; a node driven by another property moves over; undo restores", () => {
    const graph = withProperties();
    const start = snapshot(graph);
    const { result } = run(
      graph,
      applyComponentProperty({
        definitionId: CARD,
        key: "title",
        target: { id: id("cIcon"), prop: "children" },
      }),
    );
    writeProps(graph, id("I"), { title: "Both" });
    expect(texts(resolveCatalogNode(graph, id("I")))).toEqual(["Both", "Both"]);
    run(
      graph,
      renameComponentProperty({
        definitionId: CARD,
        key: "title",
        name: "Head",
      }),
    );
    expect(cardOf(graph).properties?.[0]).toMatchObject({ name: "Head" });
    // A second text property on cTitle · children takes it over from `title`.
    run(
      graph,
      addComponentProperty({
        definitionId: CARD,
        key: "head2",
        name: "Head 2",
        kind: "text",
        target: { id: id("cTitle"), prop: "children" },
      }),
    );
    expect(
      cardOf(graph).properties?.find((item) => item.key === "title")?.targets,
    ).toEqual([{ id: id("cIcon"), prop: "children" }]);
    run(
      graph,
      detachComponentProperty({
        definitionId: CARD,
        key: "title",
        target: { id: id("cIcon"), prop: "children" },
      }),
    );
    // Its last node gone: the property is deleted and I's value cleared.
    expect(cardOf(graph).properties?.map((item) => item.key)).toEqual([
      "showIcon",
      "head2",
    ]);
    expect((graph.getEntry(id("I")) as NodeEntry).props).not.toHaveProperty(
      "title",
    );
    void result;
    expect(snapshot(graph)).not.toBe(start);
  });

  it("deleting a property clears the instances' values and the outer patches on nested ones", () => {
    const graph = withProperties();
    writeProps(graph, id("I"), { title: "Hello" });
    writeProps(graph, id("J"), { title: "Inner" });
    const atJ = {
      kind: "descendant" as const,
      ownerId: id("K"),
      address: { instances: [id("K")], templatePath: [id("oRoot"), id("J")] },
    };
    run(graph, setFields({ targets: [atJ], props: { title: set("Outer") } }));
    const start = snapshot(graph);
    const { result } = run(
      graph,
      removeComponentProperty({ definitionId: CARD, key: "title" }),
    );
    expect((graph.getEntry(id("I")) as NodeEntry).props).toEqual({});
    expect((graph.getEntry(id("J")) as NodeEntry).props).toEqual({});
    // The patch held only the value: it is gone.
    expect((graph.getEntry(id("K")) as NodeEntry).descendantOverrides).toEqual(
      [],
    );
    expect(texts(resolveCatalogNode(graph, id("K")))[0]).toBe("Title");
    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(start);
  });

  it("deleting a driven node takes it off (the property goes with its last node)", () => {
    const graph = withProperties();
    writeProps(graph, id("I"), { title: "Hello", showIcon: false });
    run(
      graph,
      removeTargets({ targets: [{ kind: "node", id: id("cTitle") }] }),
    );
    expect(cardOf(graph).properties?.map((item) => item.key)).toEqual([
      "showIcon",
    ]);
    expect((graph.getEntry(id("I")) as NodeEntry).props).toEqual({
      showIcon: set(false),
    });
  });

  it("moving a driven node out of the origin takes it off; moving inside keeps it", () => {
    const graph = withProperties();
    writeProps(graph, id("I"), { showIcon: false });
    // Inside the origin (a reorder): kept.
    run(
      graph,
      moveNodes({
        ids: [id("cIcon")],
        parent: { kind: "node", id: id("cRoot") },
        index: 0,
        newId: allocator(),
      }),
    );
    expect(cardOf(graph).properties).toHaveLength(2);
    // Out to the page: taken off, its value cleared.
    run(
      graph,
      moveNodes({
        ids: [id("cIcon")],
        parent: { kind: "page", id: PAGE },
        index: 0,
        newId: allocator(),
      }),
    );
    expect(cardOf(graph).properties?.map((item) => item.key)).toEqual([
      "title",
    ]);
    expect((graph.getEntry(id("I")) as NodeEntry).props).toEqual({});
    expect((graph.getEntry(PAGE) as PageEntry).children[0]).toBe(id("cIcon"));
  });

  it("detach keeps what the properties showed", () => {
    const graph = withProperties();
    writeProps(graph, id("I"), { title: "Hello", showIcon: false });
    run(graph, detachInstances({ ids: [id("I")], newId: allocator() }));
    const root = graph.getEntry(id("I")) as NodeEntry;
    expect(root.definitionId).toBe(SECTION);
    expect(root.props).toEqual({});
    const [title, icon] = root.children.map(
      (child) => graph.getEntry(child) as NodeEntry,
    );
    expect(title.props.children).toEqual(set("Hello"));
    expect(icon.enabled).toBe(false);
    expect(texts(resolveCatalogNode(graph, id("I")))).toEqual(["Hello"]);
  });
});
