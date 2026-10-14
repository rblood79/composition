/**
 * ADR-261 Phase 5 — instance swap property (Decision 4 · G3): the value an instance picks for a
 * nested instance of its component's origin is its `replace` override there — an owned instance of
 * the picked component. What the instance changed at and inside the position follows by name
 * (Decision 2), and so do the addresses through it (interactions · `showWhen` state owners · other
 * instances through it). The default is no override; picking it folds the node back. One step,
 * one undo.
 */
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../document/graph";
import type {
  CatalogEntry,
  DefinitionEntry,
  InteractionEntry,
  NodeEntry,
  NodeId,
} from "../../document/types";
import type { ResolvedCatalogNode } from "../../resolution/resolver";
import { resolveCatalogNode } from "../../resolution/resolver";
import { detachInstances, dissolveComponent } from "../components";
import { setFields, setWholeField } from "../fields";
import {
  instancePropertyValue,
  planInstanceProperty,
  resetReplacement,
  setInstanceProperty,
} from "../instanceProperty";
import {
  addComponentProperty,
  applyComponentProperty,
  removeComponentProperty,
  setComponentPropertyPreferred,
} from "../properties";
import { copyNodes, moveNodes, removeTargets } from "../structure";
import { swapInstance } from "../swap";
import {
  allocator,
  code,
  documentOf,
  library,
  node,
  run,
  snapshot,
  text,
  undo,
} from "./fixture";

const id = (name: string) => `project:node:${name}` as NodeId;
const SECTION = "lib:definition:section";
const CARD = "project:definition:Card" as const;
const STAR = "project:definition:Star" as const;
const HEART = "project:definition:Heart" as const;
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
const glyph = (name: string, value: string): NodeEntry => ({
  ...text(name, value),
  name: "Glyph",
});
const I = id("I");
const K = id("K");
const J = id("J");
const ICON_PATH = [id("cRoot"), id("cIcon")];

/**
 * Star: sRoot > Glyph "★". Heart: hRoot > Glyph "♥". Card: cRoot > cTitle "Title" · cIcon (a Star
 * instance) · cBody (slot). Outer: oRoot > J (a Card instance). I: a Card instance; K: an Outer
 * instance. Card's `icon` (instance → cIcon, Heart preferred) and `showIcon` (boolean → cIcon).
 */
function fixture(): CatalogGraph {
  const nodes: NodeEntry[] = [
    node("sRoot", SECTION, { children: [id("sGlyph")] }),
    glyph("sGlyph", "★"),
    node("hRoot", SECTION, { children: [id("hGlyph")] }),
    glyph("hGlyph", "♥"),
    node("cRoot", SECTION, {
      children: [id("cTitle"), id("cIcon"), id("cBody")],
    }),
    text("cTitle", "Title"),
    node("cIcon", STAR, { name: "Icon" }),
    node("cBody", SECTION, { slot: { name: "content", required: false } }),
    node("oRoot", SECTION, { children: [J] }),
    node("J", CARD),
    node("I", CARD),
    node("K", "project:definition:Outer"),
  ];
  const extra: CatalogEntry[] = [
    definition("Star", "sRoot"),
    definition("Heart", "hRoot"),
    definition("Card", "cRoot"),
    definition("Outer", "oRoot"),
  ];
  const graph = new CatalogGraph(
    documentOf(nodes, ["sRoot", "hRoot", "cRoot", "oRoot", "I", "K"], extra),
    library(),
  );
  run(
    graph,
    addComponentProperty({
      definitionId: CARD,
      key: "icon",
      name: "Icon",
      kind: "instance",
      target: { id: id("cIcon") },
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
const texts = (resolved: ResolvedCatalogNode | undefined): string[] => {
  const out: string[] = [];
  const visit = (item: ResolvedCatalogNode) => {
    if (typeof item.props.children === "string") out.push(item.props.children);
    item.children.forEach(visit);
  };
  if (resolved) visit(resolved);
  return out;
};
const pick = (
  graph: CatalogGraph,
  definitionId: typeof HEART | typeof STAR | null,
  ownerId: NodeId = I,
  instances: readonly string[] = [ownerId],
  newId = allocator(),
) =>
  run(
    graph,
    setInstanceProperty({
      ownerId,
      instances: instances as never,
      key: "icon",
      definitionId,
      newId,
    }),
  );
const origin = (graph: CatalogGraph) =>
  JSON.stringify(
    ["cRoot", "cTitle", "cIcon", "cBody"].map((name) =>
      graph.getEntry(id(name)),
    ),
  );
const replacement = (graph: CatalogGraph, owner: NodeId = I) => {
  const found = (graph.getEntry(owner) as NodeEntry).descendantOverrides.find(
    (item) => item.kind === "replace",
  );
  return found?.kind === "replace" ? found.replacementId : undefined;
};

describe("ADR-261 Phase 5 — instance swap property", () => {
  it("picking a component stands an owned instance of it at the position; the origin is untouched; undo restores", () => {
    const graph = fixture();
    const start = snapshot(graph);
    const before = origin(graph);
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "★"]);
    expect(instancePropertyValue(graph, I, [I], "icon")).toEqual({
      definitionId: STAR,
      isDefault: true,
    });
    const { result } = pick(graph, HEART);
    const placed = replacement(graph)!;
    expect((graph.getEntry(placed) as NodeEntry).definitionId).toBe(HEART);
    expect(graph.ownerOf(placed)).toBe(I);
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "♥"]);
    expect(instancePropertyValue(graph, I, [I], "icon")).toEqual({
      definitionId: HEART,
      isDefault: false,
    });
    expect(origin(graph)).toBe(before);
    expect(texts(resolveCatalogNode(graph, id("cRoot")))).toEqual([
      "Title",
      "★",
    ]);
    // The value is not a root prop (no key on the instance, none on its record).
    expect((graph.getEntry(I) as NodeEntry).props).toEqual({});
    undo(graph, result.inverse);
    expect(JSON.parse(snapshot(graph))).toEqual(JSON.parse(start));
  });

  it("the default folds the node back: a round trip with no writes is the document it started from", () => {
    const graph = fixture();
    const start = snapshot(graph);
    pick(graph, HEART);
    pick(graph, null);
    expect(replacement(graph)).toBeUndefined();
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "★"]);
    expect(snapshot(graph)).toBe(start);
  });

  it("writes inside the nested instance follow by name, and come back on the default", () => {
    const graph = fixture();
    run(
      graph,
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: I,
            address: {
              instances: [I, id("cIcon")],
              templatePath: [id("sRoot"), id("sGlyph")],
            },
          },
        ],
        props: { children: { kind: "set", value: "S!" } },
      }),
    );
    const start = snapshot(graph);
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "S!"]);
    const { report } = planInstanceProperty(graph, {
      ownerId: I,
      instances: [I],
      key: "icon",
      definitionId: HEART,
      newId: allocator(),
    });
    expect(report).toEqual({ kept: 1, dropped: 0, movedOut: 0 });
    pick(graph, HEART);
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "S!"]);
    const placed = graph.getEntry(replacement(graph)!) as NodeEntry;
    expect(placed.descendantOverrides).toEqual([
      {
        kind: "patch",
        address: {
          instances: [placed.id],
          templatePath: [id("hRoot"), id("hGlyph")],
        },
        props: { children: { kind: "set", value: "S!" } },
      },
    ]);
    pick(graph, null);
    expect(JSON.parse(snapshot(graph))).toEqual(JSON.parse(start));
  });

  it("an interaction and a state owner through the position move with it, and back", () => {
    const graph = fixture();
    const tap: InteractionEntry = {
      kind: "interaction",
      id: "project:interaction:tap",
      ownerId: I,
      address: { instances: [I], templatePath: ICON_PATH },
      trigger: "press",
      action: { opcode: "navigate", pageId: "project:page:main" },
    } as InteractionEntry;
    const hover: InteractionEntry = {
      ...tap,
      id: "project:interaction:hover",
      address: {
        instances: [I, id("cIcon")],
        templatePath: [id("sRoot"), id("sGlyph")],
      },
    } as InteractionEntry;
    const content: NodeEntry = {
      ...text("x", "content"),
      showWhen: {
        all: ["isHovered"],
        from: {
          ancestor: { address: { instances: [I], templatePath: ICON_PATH } },
        },
      },
    };
    const project = graph.getEntry(graph.projectId) as never as {
      interactionIds: string[];
    };
    run(graph, (reader) => ({
      label: "seed",
      ops: [
        { kind: "put", entry: content },
        { kind: "put", entry: tap },
        { kind: "put", entry: hover },
        {
          kind: "put",
          entry: {
            ...(reader.getEntry(graph.projectId) as CatalogEntry),
            interactionIds: [...project.interactionIds, tap.id, hover.id],
          } as CatalogEntry,
        },
        {
          kind: "put",
          entry: {
            ...(reader.getEntry(I) as NodeEntry),
            descendantOverrides: [
              {
                kind: "fillSlot",
                address: {
                  instances: [I],
                  templatePath: [id("cRoot"), id("cBody")],
                },
                childIds: [id("x")],
              },
            ],
          },
        },
      ],
    }));
    const start = snapshot(graph);
    pick(graph, HEART);
    const placed = replacement(graph)!;
    expect(graph.getEntry(tap.id)).toMatchObject({ ownerId: placed });
    expect(graph.getEntry(tap.id)).not.toHaveProperty("address");
    expect((graph.getEntry(hover.id) as InteractionEntry).address).toEqual({
      instances: [placed],
      templatePath: [id("hRoot"), id("hGlyph")],
    });
    expect((graph.getEntry(id("x")) as NodeEntry).showWhen?.from).toEqual({
      ancestor: { nodeId: placed },
    });
    pick(graph, null);
    expect(JSON.parse(snapshot(graph))).toEqual(JSON.parse(start));
  });

  it("a visibility property on the same layer still shows or hides the swapped instance", () => {
    const graph = fixture();
    pick(graph, HEART);
    run(
      graph,
      setFields({
        targets: [{ kind: "node", id: I }],
        props: { showIcon: { kind: "set", value: false } },
      }),
    );
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title"]);
    run(
      graph,
      setFields({
        targets: [{ kind: "node", id: I }],
        props: { showIcon: { kind: "set", value: true } },
      }),
    );
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "♥"]);
  });

  it("review H1: the visibility property is not copied into the swap — round trip, reset and a direct hide", () => {
    const show = (graph: CatalogGraph, value: boolean | undefined) =>
      run(
        graph,
        setFields({
          targets: [{ kind: "node", id: I }],
          props: {
            showIcon:
              value === undefined
                ? { kind: "remove" }
                : { kind: "set", value },
          },
        }),
      );
    // P1: hidden by the property, swapped and back: nothing left over; the property shows it again.
    const graph = fixture();
    show(graph, false);
    const start = snapshot(graph);
    pick(graph, HEART);
    pick(graph, null);
    expect(JSON.parse(snapshot(graph))).toEqual(JSON.parse(start));
    show(graph, true);
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "★"]);
    // P2: hidden, swapped, then the property back to its default: the swapped one shows.
    const second = fixture();
    show(second, false);
    pick(second, HEART);
    show(second, undefined);
    expect(texts(resolveCatalogNode(second, I))).toEqual(["Title", "♥"]);
    // P3: the instance hid the position itself: still hidden with the property on, once swapped.
    const third = fixture();
    run(
      third,
      setWholeField({
        targets: [
          {
            kind: "descendant",
            ownerId: I,
            address: { instances: [I], templatePath: ICON_PATH },
          },
        ],
        field: "enabled",
        value: false,
      }),
    );
    show(third, true);
    expect(texts(resolveCatalogNode(third, I))).toEqual(["Title"]);
    pick(third, HEART);
    expect(texts(resolveCatalogNode(third, I))).toEqual(["Title"]);
    // P3b: shown directly while the property hides it — the direct write wins, as on the position.
    const fourth = fixture();
    run(
      fourth,
      setWholeField({
        targets: [
          {
            kind: "descendant",
            ownerId: I,
            address: { instances: [I], templatePath: ICON_PATH },
          },
        ],
        field: "enabled",
        value: true,
      }),
    );
    show(fourth, false);
    expect(texts(resolveCatalogNode(fourth, I))).toEqual(["Title", "★"]);
    pick(fourth, HEART);
    expect(texts(resolveCatalogNode(fourth, I))).toEqual(["Title", "♥"]);
  });

  it("review M1: an outer value over the nested instance's own writes there is refused", () => {
    const graph = fixture();
    run(
      graph,
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: J,
            address: {
              instances: [J, id("cIcon")],
              templatePath: [id("sRoot"), id("sGlyph")],
            },
          },
        ],
        props: { children: { kind: "set", value: "J!" } },
      }),
    );
    expect(code(() => pick(graph, HEART, K, [K, J]))).toBe(
      "PROPERTY_VALUE_INHERITED",
    );
  });

  it("an outer instance sets a nested instance's value (its override through it)", () => {
    const graph = fixture();
    pick(graph, HEART, K, [K, J]);
    expect(texts(resolveCatalogNode(graph, K))).toEqual(["Title", "♥"]);
    expect(texts(resolveCatalogNode(graph, J))).toEqual(["Title", "★"]);
    expect(instancePropertyValue(graph, K, [K, J], "icon")).toEqual({
      definitionId: HEART,
      isDefault: false,
    });
    pick(graph, null, K, [K, J]);
    expect(replacement(graph, K)).toBeUndefined();
    expect(texts(resolveCatalogNode(graph, K))).toEqual(["Title", "★"]);
  });

  it("a value set on an origin's nested instance moves the addresses other instances hold through it", () => {
    const graph = fixture();
    // K writes the glyph inside J's icon (through J, a template node of Outer).
    run(
      graph,
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: K,
            address: {
              instances: [K, J, id("cIcon")],
              templatePath: [id("sRoot"), id("sGlyph")],
            },
          },
        ],
        props: { children: { kind: "set", value: "K!" } },
      }),
    );
    const start = snapshot(graph);
    expect(texts(resolveCatalogNode(graph, K))).toEqual(["Title", "K!"]);
    pick(graph, HEART, J);
    const placed = replacement(graph, J)!;
    expect(
      (graph.getEntry(K) as NodeEntry).descendantOverrides.map(
        (item) => item.address,
      ),
    ).toEqual([
      {
        instances: [K, placed],
        templatePath: [id("hRoot"), id("hGlyph")],
      },
    ]);
    expect(texts(resolveCatalogNode(graph, K))).toEqual(["Title", "K!"]);
    pick(graph, null, J);
    expect(JSON.parse(snapshot(graph))).toEqual(JSON.parse(start));
  });

  it("review M2: another instance's path to slot content that moves with the swap follows it", () => {
    const graph = fixture();
    // Star and Heart get a slot "more"; J (in Outer's origin) fills Star's with c; K writes c.
    const slot = (name: string) =>
      node(name, SECTION, { slot: { name: "more", required: false } });
    run(graph, (reader) => ({
      label: "seed",
      ops: [
        { kind: "put", entry: slot("sSlot") },
        { kind: "put", entry: slot("hSlot") },
        { kind: "put", entry: text("c", "content") },
        ...(["sRoot", "hRoot"] as const).map((root) => ({
          kind: "put" as const,
          entry: {
            ...(reader.getEntry(id(root)) as NodeEntry),
            children: [
              ...(reader.getEntry(id(root)) as NodeEntry).children,
              id(root === "sRoot" ? "sSlot" : "hSlot"),
            ],
          },
        })),
        {
          kind: "put",
          entry: {
            ...(reader.getEntry(J) as NodeEntry),
            descendantOverrides: [
              {
                kind: "fillSlot",
                address: {
                  instances: [J, id("cIcon")],
                  templatePath: [id("sRoot"), id("sSlot")],
                },
                childIds: [id("c")],
              },
            ],
          },
        },
        {
          kind: "put",
          entry: {
            ...(reader.getEntry(K) as NodeEntry),
            descendantOverrides: [
              {
                kind: "patch",
                address: {
                  instances: [K],
                  templatePath: [id("oRoot"), J, id("c")],
                },
                props: { children: { kind: "set", value: "K!" } },
              },
            ],
          },
        },
      ],
    }));
    const start = snapshot(graph);
    expect(texts(resolveCatalogNode(graph, K))).toContain("K!");
    pick(graph, HEART, J);
    const placed = replacement(graph, J)!;
    expect(
      (graph.getEntry(K) as NodeEntry).descendantOverrides[0].address,
    ).toEqual({ instances: [K], templatePath: [id("oRoot"), J, placed, id("c")] });
    expect(texts(resolveCatalogNode(graph, K))).toEqual(["Title", "♥", "K!"]);
    pick(graph, null, J);
    expect(JSON.parse(snapshot(graph))).toEqual(JSON.parse(start));
  });

  it("the Overrides list's reset and a direct Swap of the node read as the same value", () => {
    const graph = fixture();
    const start = snapshot(graph);
    pick(graph, HEART);
    const placed = replacement(graph)!;
    run(graph, swapInstance({ id: placed, definitionId: STAR }));
    expect(instancePropertyValue(graph, I, [I], "icon")).toEqual({
      definitionId: STAR,
      isDefault: false,
    });
    run(graph, resetReplacement({ id: placed }));
    expect(JSON.parse(snapshot(graph))).toEqual(JSON.parse(start));
  });

  it("detach keeps the swapped instance; deleting the origin layer takes the value with it", () => {
    const graph = fixture();
    pick(graph, HEART);
    const detached = fixture();
    const newId = allocator();
    pick(detached, HEART, I, [I], newId);
    run(detached, detachInstances({ ids: [I], newId }));
    expect(texts(resolveCatalogNode(detached, I))).toEqual(["Title", "♥"]);
    const placed = replacement(graph)!;
    run(graph, removeTargets({ targets: [{ kind: "node", id: id("cIcon") }] }));
    expect(graph.getEntry(placed)).toBeUndefined();
    expect(replacement(graph)).toBeUndefined();
    expect(
      (graph.getEntry(CARD) as DefinitionEntry).properties,
    ).toBeUndefined();
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title"]);
  });

  it("deleting the property keeps each instance's swapped node (a plain replacement)", () => {
    const graph = fixture();
    pick(graph, HEART);
    run(graph, removeComponentProperty({ definitionId: CARD, key: "icon" }));
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "♥"]);
  });

  it("the picked component is a dependency: its origin's edits affect the instance, a copy carries it", () => {
    const graph = fixture();
    pick(graph, HEART);
    expect(graph.collectAffectedIds([id("hGlyph")]).has(I)).toBe(true);
    const clipboard = copyNodes(graph, [I]);
    expect(clipboard.definitions?.some((item) => item.id === HEART)).toBe(true);
  });

  it("a position inside the swapped instance is edited as the node's own", () => {
    const graph = fixture();
    pick(graph, HEART);
    const placed = replacement(graph)!;
    run(
      graph,
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: placed,
            address: {
              instances: [placed],
              templatePath: [id("hRoot"), id("hGlyph")],
            },
          },
        ],
        props: { children: { kind: "set", value: "H!" } },
      }),
    );
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "H!"]);
  });

  it("a component inside its own origin is a cycle; on a page instance it is not", () => {
    const graph = fixture();
    // J stands in Outer's origin: Outer there would contain itself.
    expect(code(() => pick(graph, "project:definition:Outer" as never, J))).toBe(
      "DEFINITION_CYCLE",
    );
    // I is on the page: Card inside a Card instance is an ordinary nested instance.
    expect(code(() => pick(graph, CARD as never))).toBe("ACCEPTED");
  });

  it("Codex M1: detach keeps the visibility a property gave the swapped layer", () => {
    const graph = fixture();
    const newId = allocator();
    run(
      graph,
      setFields({
        targets: [{ kind: "node", id: I }],
        props: { showIcon: { kind: "set", value: false } },
      }),
    );
    pick(graph, HEART, I, [I], newId);
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title"]);
    run(graph, detachInstances({ ids: [I], newId }));
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title"]);
  });

  it("Codex M2: a layer inside another layer the same kind of property swaps is refused as a target", () => {
    const graph = fixture();
    // cIcon (a Star instance) holds another Star in its slot position? Use a second nested
    // instance owned by cIcon: Star gets a slot, cIcon fills it with an origin-level Star.
    const slot = node("sSlot", SECTION, {
      slot: { name: "more", required: false },
    });
    run(graph, (reader) => ({
      label: "seed",
      ops: [
        { kind: "put", entry: slot },
        { kind: "put", entry: node("inner", STAR, { name: "Inner" }) },
        {
          kind: "put",
          entry: {
            ...(reader.getEntry(id("sRoot")) as NodeEntry),
            children: [id("sGlyph"), id("sSlot")],
          },
        },
        {
          kind: "put",
          entry: {
            ...(reader.getEntry(id("cIcon")) as NodeEntry),
            descendantOverrides: [
              {
                kind: "fillSlot",
                address: {
                  instances: [id("cIcon")],
                  templatePath: [id("sRoot"), id("sSlot")],
                },
                childIds: [id("inner")],
              },
            ],
          },
        },
      ],
    }));
    expect(
      code(() =>
        run(
          graph,
          applyComponentProperty({
            definitionId: CARD,
            key: "icon",
            target: { id: id("inner") },
          }),
        ),
      ),
    ).toBe("PROPERTY_TARGET_NESTED");
  });

  it("Codex M3: moving the swapped origin layer out of the origin takes the instances' swaps with it", () => {
    const graph = fixture();
    pick(graph, HEART);
    const placed = replacement(graph)!;
    run(
      graph,
      moveNodes({
        ids: [id("cIcon")],
        parent: { kind: "page", id: "project:page:main" },
        newId: allocator(),
      }),
    );
    expect(graph.getEntry(placed)).toBeUndefined();
    expect(replacement(graph)).toBeUndefined();
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title"]);
  });

  it("validates kinds, targets and preferred components", () => {
    const graph = fixture();
    // The value is not a root prop.
    expect(
      code(() =>
        run(
          graph,
          setFields({
            targets: [{ kind: "node", id: I }],
            props: { icon: { kind: "set", value: "x" } },
          }),
        ),
      ),
    ).toBe("PROP_NOT_ACCEPTED");
    expect(
      code(() =>
        run(
          graph,
          addComponentProperty({
            definitionId: CARD,
            key: "whole",
            name: "Whole",
            kind: "instance",
            target: { id: id("cRoot") },
          }),
        ),
      ),
    ).toBe("PROPERTY_TARGET_ROOT");
    expect(
      code(() =>
        run(
          graph,
          setComponentPropertyPreferred({
            definitionId: CARD,
            key: "icon",
            preferred: ["project:definition:Gone" as never],
          }),
        ),
      ),
    ).toBe("DANGLING_DEFINITION");
    // A swapped nested instance is a new node: no text property drives it.
    expect(
      code(() =>
        run(
          graph,
          addComponentProperty({
            definitionId: CARD,
            key: "iconText",
            name: "Icon text",
            kind: "text",
            target: { id: id("cIcon"), prop: "children" },
          }),
        ),
      ),
    ).toBe("PROPERTY_TARGET_SWAPPED");
    run(
      graph,
      setComponentPropertyPreferred({
        definitionId: CARD,
        key: "icon",
        preferred: [HEART],
      }),
    );
    expect(
      (graph.getEntry(CARD) as DefinitionEntry).properties?.find(
        (item) => item.key === "icon",
      )?.preferred,
    ).toEqual([HEART]);
    expect(
      code(() =>
        run(
          graph,
          setComponentPropertyPreferred({
            definitionId: CARD,
            key: "showIcon",
            preferred: [HEART],
          }),
        ),
      ),
    ).toBe("PROPERTY_NOT_FOUND");
  });

  it("dissolving a preferred component leaves the lists; a swapped instance of it is detached", () => {
    const graph = fixture();
    const newId = allocator();
    run(
      graph,
      setComponentPropertyPreferred({
        definitionId: CARD,
        key: "icon",
        preferred: [HEART],
      }),
    );
    pick(graph, HEART, I, [I], newId);
    run(graph, dissolveComponent({ definitionId: HEART, newId }));
    const icon = (graph.getEntry(CARD) as DefinitionEntry).properties?.find(
      (item) => item.key === "icon",
    );
    expect(icon).toBeDefined();
    expect(icon).not.toHaveProperty("preferred");
    expect(texts(resolveCatalogNode(graph, I))).toEqual(["Title", "♥"]);
  });
});
