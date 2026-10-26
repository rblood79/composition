/**
 * ADR-261 Phase 2 — Swap instance (Decision 2 · G2): the node keeps its id and shows another
 * component; what it changed follows by name path (unique place only), slot content by slot name,
 * the addresses others hold (interactions · `showWhen` state owners · other instances through it)
 * move in the same step. No place: slot content moves out after it (user decision 1), the rest is
 * dropped and counted (user decision 6). One undo restores all.
 */
import { describe, expect, it } from "vitest";
import { buildCodeCatalogLibrary } from "../../document/codeCatalogLibrary";
import { CatalogGraph } from "../../document/graph";
import type {
  CatalogEntry,
  DefinitionEntry,
  InteractionEntry,
  NodeEntry,
  NodeId,
  PageEntry,
} from "../../document/types";
import { resolveCatalogNode } from "../../resolution/resolver";
import { insertNodes } from "../structure";
import { planSwapInstance, swapInstance } from "../swap";
import {
  allocator,
  code,
  documentOf,
  graphOf,
  node,
  PAGE,
  run,
  snapshot,
  text,
  undo,
} from "./fixture";

const id = (name: string) => `project:node:${name}` as NodeId;
const definition = (
  name: string,
  root: string,
  extra: Partial<DefinitionEntry> = {},
): DefinitionEntry => ({
  kind: "definition",
  id: `project:definition:${name}`,
  name,
  mode: "composite",
  accepts: {},
  defaults: {},
  visual: {},
  stateRules: {},
  templateRootId: id(root),
  ...extra,
});
const SECTION = "lib:definition:section";
const titled = (name: string) => ({
  ...text(name, "title"),
  name: "Title",
});
const I = id("I");
const A = "project:definition:A" as const;
const B = "project:definition:B" as const;
const D = "project:definition:D" as const;

/**
 * A: aRoot > Title · aBody (slot content) · aBadge (Badge). B: bRoot > Title · bMain (slot content)
 * · Title. D: dRoot > Title (no slot). I: an instance of A with a title write, slot content x
 * (whose condition reads I's state), a write on the badge position and one inside the badge, and
 * an interaction on its title position.
 */
function fixture() {
  const nodes: NodeEntry[] = [
    node("aRoot", SECTION, {
      children: [id("aTitle"), id("aBody"), id("aBadge")],
    }),
    { ...titled("aTitle") },
    node("aBody", SECTION, { slot: { name: "content", required: false } }),
    node("aBadge", "lib:definition:badge"),
    node("bRoot", SECTION, {
      children: [id("bTitle"), id("bMain"), id("bTitle2")],
    }),
    { ...titled("bTitle") },
    node("bMain", SECTION, { slot: { name: "content", required: false } }),
    { ...titled("bTitle2") },
    node("dRoot", SECTION, { children: [id("dTitle")] }),
    { ...titled("dTitle") },
    {
      ...text("x", "slot content"),
      showWhen: {
        all: ["isHovered"],
        from: {
          ancestor: {
            address: { instances: [I], templatePath: [id("aRoot")] },
          },
        },
      },
    },
    node("I", A, {
      descendantOverrides: [
        {
          kind: "patch",
          address: {
            instances: [I],
            templatePath: [id("aRoot"), id("aTitle")],
          },
          props: { children: { kind: "set", value: "Hi" } },
        },
        {
          kind: "fillSlot",
          address: { instances: [I], templatePath: [id("aRoot"), id("aBody")] },
          childIds: [id("x")],
        },
        {
          kind: "patch",
          address: {
            instances: [I],
            templatePath: [id("aRoot"), id("aBadge")],
          },
          enabled: false,
        },
        {
          kind: "patch",
          address: {
            instances: [I, id("aBadge")],
            templatePath: ["lib:template:badgeRoot", "lib:template:badgeText"],
          },
          props: { children: { kind: "set", value: "B!" } },
        },
      ],
    }),
  ];
  const interaction: InteractionEntry = {
    kind: "interaction",
    id: "project:interaction:tap",
    ownerId: I,
    address: { instances: [I], templatePath: [id("aRoot"), id("aTitle")] },
    trigger: "press",
    action: { opcode: "navigate", pageId: PAGE },
  } as InteractionEntry;
  const extra: CatalogEntry[] = [
    definition("A", "aRoot"),
    definition("B", "bRoot"),
    definition("D", "dRoot"),
    interaction,
  ];
  return graphOf(nodes, ["I"], extra);
}

describe("ADR-261 Phase 2 — swapInstance", () => {
  it("Codex M4: a layer name holding the path separators is not another layer's path", () => {
    const P = "project:definition:P" as const;
    const Q = "project:definition:Q" as const;
    const nodes: NodeEntry[] = [
      node("pRoot", SECTION, { children: [id("pGroup")] }),
      node("pGroup", SECTION, { name: "Group", children: [id("pTitle")] }),
      { ...text("pTitle", "title"), name: "Title" },
      node("qRoot", SECTION, { children: [id("qOdd")] }),
      { ...text("qOdd", "Unrelated"), name: "Group#0/Title" },
      node("X", P, {
        descendantOverrides: [
          {
            kind: "patch",
            address: {
              instances: [id("X")],
              templatePath: [id("pRoot"), id("pGroup"), id("pTitle")],
            },
            props: { children: { kind: "set", value: "Mine" } },
          },
        ],
      }),
    ];
    const graph = graphOf(nodes, ["X"], [definition("P", "pRoot"), definition("Q", "qRoot")]);
    const { report } = planSwapInstance(graph, { id: id("X"), definitionId: Q });
    expect(report).toMatchObject({ kept: 0, dropped: 1 });
    run(graph, swapInstance({ id: id("X"), definitionId: Q }));
    expect((graph.getEntry(id("X")) as NodeEntry).descendantOverrides).toEqual([]);
  });

  it("moves the instance's changes to the same places by name path; the rest is counted; undo restores", () => {
    const graph = fixture();
    const start = snapshot(graph);
    const { report } = planSwapInstance(graph, { id: I, definitionId: B });
    expect(report).toEqual({
      kept: 4,
      dropped: 2,
      movedOut: 0,
      targetsUnset: 0,
    });
    const { result } = run(graph, swapInstance({ id: I, definitionId: B }));
    const swapped = graph.getEntry(I) as NodeEntry;
    expect(swapped.definitionId).toBe(B);
    expect(swapped.descendantOverrides).toEqual([
      {
        kind: "patch",
        address: { instances: [I], templatePath: [id("bRoot"), id("bTitle")] },
        props: { children: { kind: "set", value: "Hi" } },
      },
      {
        kind: "fillSlot",
        address: { instances: [I], templatePath: [id("bRoot"), id("bMain")] },
        childIds: [id("x")],
      },
    ]);
    // The interaction and the slot content's state owner follow (Round 2 h2: the condition stays).
    expect(
      (graph.getEntry("project:interaction:tap") as InteractionEntry).address,
    ).toEqual({ instances: [I], templatePath: [id("bRoot"), id("bTitle")] });
    expect((graph.getEntry(id("x")) as NodeEntry).showWhen?.from).toEqual({
      ancestor: { address: { instances: [I], templatePath: [id("bRoot")] } },
    });
    // What the Canvas draws: the first Title says "Hi", the slot holds x.
    const drawn = JSON.stringify(resolveCatalogNode(graph, I));
    expect(drawn).toContain('"Hi"');
    expect(drawn).toContain("slot content");
    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(start);
  });

  it("slot content with no slot of its name moves out right after the instance (user decision 1)", () => {
    const graph = fixture();
    const { plan } = planSwapInstance(graph, { id: I, definitionId: D });
    const { report } = planSwapInstance(graph, { id: I, definitionId: D });
    expect(report.movedOut).toBe(1);
    run(graph, () => plan);
    expect((graph.getEntry(PAGE) as PageEntry).children).toEqual([I, id("x")]);
    expect(graph.ownerOf(id("x"))).toBe(PAGE);
    // x left I, so its condition read from I has no owner: dropped (user decision 6) — x shows.
    expect((graph.getEntry(id("x")) as NodeEntry).showWhen).toBeUndefined();
    expect(report.dropped).toBeGreaterThanOrEqual(1);
  });

  it("an interaction with no place is removed with its project index entry", () => {
    const graph = fixture();
    // Point the interaction at the badge position (B has no Badge).
    const tap = graph.getEntry("project:interaction:tap") as InteractionEntry;
    run(graph, () => ({
      label: "fixture",
      ops: [
        {
          kind: "put",
          entry: {
            ...tap,
            address: {
              instances: [I],
              templatePath: [id("aRoot"), id("aBadge")],
            },
          },
        },
      ] as never,
    }));
    run(graph, swapInstance({ id: I, definitionId: B }));
    expect(graph.getEntry("project:interaction:tap")).toBeUndefined();
  });

  it("a node in a component's template: other instances' addresses through it move too", () => {
    const graph = fixture();
    // aBadge (a Badge in A's template) becomes a Picker: I's write inside it (Text) follows to the
    // Picker's title (the same `Text` step).
    run(
      graph,
      swapInstance({ id: id("aBadge"), definitionId: "lib:definition:picker" }),
    );
    const nested = (graph.getEntry(I) as NodeEntry).descendantOverrides.find(
      (item) => item.address.instances.length === 2,
    );
    expect(nested?.address).toEqual({
      instances: [I, id("aBadge")],
      templatePath: ["lib:template:pickRoot", "lib:template:title"],
    });
  });

  it("keeps only the root props the new contract takes", () => {
    const graph = graphOf([text("t", "hello")], ["t"]);
    const { report } = planSwapInstance(graph, {
      id: id("t"),
      definitionId: "lib:definition:picker",
    });
    expect(report.dropped).toBe(1);
    run(
      graph,
      swapInstance({ id: id("t"), definitionId: "lib:definition:picker" }),
    );
    expect((graph.getEntry(id("t")) as NodeEntry).props).toEqual({});
  });

  it("refuses the same component, an origin, and a definition cycle", () => {
    const graph = fixture();
    expect(
      code(() => run(graph, swapInstance({ id: I, definitionId: A }))),
    ).toBe("SAME_DEFINITION");
    expect(
      code(() =>
        run(graph, swapInstance({ id: id("aBadge"), definitionId: A })),
      ),
    ).toBe("DEFINITION_CYCLE");
    const origin = graphOf(
      [node("o", SECTION)],
      [],
      [definition("O", "o")],
    );
    expect(
      code(() => run(origin, swapInstance({ id: id("o"), definitionId: A }))),
    ).toBe("ORIGIN_NOT_SWAPPABLE");
  });
});

/**
 * Phase 2 review (2026-10-15) — the code library: a swap is refused only where the new component
 * cannot stand; props the new contract types differently are dropped, not a refused swap (m1);
 * slot content the new slot does not take moves out (h2).
 */
describe("ADR-261 Phase 2 — swapInstance over the code library (review h2 · m1)", () => {
  const origin = (name: string) =>
    `lib:definition:origin-component-${name}` as NodeEntry["definitionId"];
  async function placed(definitionId: NodeEntry["definitionId"], props = {}) {
    const graph = new CatalogGraph(
      documentOf([], []),
      await buildCodeCatalogLibrary(),
    );
    const I = id("I");
    run(
      graph,
      insertNodes({
        parent: { kind: "page", id: PAGE },
        entries: [node("I", definitionId, { props })],
        rootIds: [I],
        newId: allocator(),
      }),
    );
    return { graph, I };
  }

  it("a number value does not refuse the swap to a text field: it is dropped and counted (m1)", async () => {
    const { graph, I } = await placed(origin("progressbar"), {
      value: { kind: "set", value: 50 },
      label: { kind: "set", value: "Progress" },
    });
    const { report } = planSwapInstance(graph, {
      id: I,
      definitionId: origin("textfield"),
    });
    run(graph, swapInstance({ id: I, definitionId: origin("textfield") }));
    const props = (graph.getEntry(I) as NodeEntry).props;
    expect(props.value).toBeUndefined();
    expect(props.label).toEqual({ kind: "set", value: "Progress" });
    expect(report.dropped).toBeGreaterThanOrEqual(1);
  });

  it("ListBox items do not stay in a GridList: they move out after it (h2 · user decision 1)", async () => {
    const { graph, I } = await placed(origin("listbox"));
    const items = (graph.getEntry(I) as NodeEntry).descendantOverrides.flatMap(
      (item) => (item.kind === "fillSlot" ? item.childIds : []),
    );
    expect(items.length).toBeGreaterThan(0);
    run(graph, swapInstance({ id: I, definitionId: origin("gridlist") }));
    expect(
      (graph.getEntry(I) as NodeEntry).descendantOverrides.filter(
        (item) => item.kind === "fillSlot",
      ),
    ).toEqual([]);
    expect((graph.getEntry(PAGE) as PageEntry).children).toEqual([I, ...items]);
  });

  it("an item inside a ListBox is not swapped to a Button (h2 — the insert's nesting rule)", async () => {
    const { graph, I } = await placed(origin("listbox"));
    const fill = (graph.getEntry(I) as NodeEntry).descendantOverrides.find(
      (item) => item.kind === "fillSlot",
    );
    const item = fill?.kind === "fillSlot" ? fill.childIds[0] : undefined;
    expect(
      code(() =>
        run(graph, swapInstance({ id: item!, definitionId: origin("button") })),
      ),
    ).toBe("NESTING_NOT_ALLOWED");
  });
});
