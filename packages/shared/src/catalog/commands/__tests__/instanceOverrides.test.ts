import { describe, expect, it } from "vitest";
import type {
  BreakpointName,
  CatalogFillLayer,
  DefinitionEntry,
  InstanceAddress,
  NodeEntry,
  NodeId,
  StateName,
} from "../../document/types";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../resolution/resolver";
import { overridesAt } from "../../resolution/templateOwners";
import { setFields } from "../fields";
import { pushInstanceOverrides, resetInstance } from "../instanceOverrides";
import { setInstanceProperty } from "../instanceProperty";
import { addComponentProperty } from "../properties";
import {
  allocator,
  code,
  graphOf,
  node,
  run,
  snapshot,
  text,
  undo,
} from "./fixture";

/**
 * ADR-262 G1 · G2 — the push and reset invariants over the Phase 0 table (breakdown §1): every
 * override kind on the three origin shapes, the review Round 1 · 2 reproductions as cells, the
 * other instances, undo, and the nested-address rebasing.
 */

const COMP = "project:definition:comp" as const;
const COMP2 = "project:definition:comp2" as const;
const COMP3 = "project:definition:comp3" as const;
const COMP4 = "project:definition:comp4" as const;
const R = "project:node:r" as const;
const T = "project:node:t" as const;
const N = "project:node:n" as const;
const PK = "project:node:pk" as const;
const R2 = "project:node:r2" as const;
const T2 = "project:node:t2" as const;
const RT = "project:node:rt" as const;
const R4 = "project:node:r4" as const;
const I = "project:node:i" as const;
const J = "project:node:j" as const;
const K = "project:node:k" as const;
const I3 = "project:node:i3" as const;

const definition = (
  id: DefinitionEntry["id"],
  name: string,
  templateRootId: string,
  shape: Partial<DefinitionEntry>,
): DefinitionEntry => ({
  kind: "definition",
  id,
  name,
  mode: "composite",
  accepts: {},
  defaults: {},
  stateRules: {},
  visual: {},
  templateRootId: templateRootId as DefinitionEntry["templateRootId"],
  ...shape,
});
const set = <V>(value: V) => ({ kind: "set" as const, value });
const fill = (color: string, id = "f1"): CatalogFillLayer => ({
  kind: "color",
  id,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  color,
});
const BREAKPOINTS: readonly BreakpointName[] = ["desktop", "tablet", "mobile"];
const STATES: readonly (StateName | undefined)[] = [undefined, "hover"];

/** What a consumer draws at a position (IDs and the authored-only echoes dropped). */
const shown = (record: ResolvedCatalogNode): unknown => ({
  definitionId: record.definitionId,
  props: record.props,
  visual: record.visual,
  layout: record.layout,
  sizing: record.sizing,
  fills: record.fills,
  fillSizing: record.fillSizing,
  children: record.children.map(shown),
});
/** The display of an instance: the records it draws (its template root and below). */
const display = (
  graph: ReturnType<typeof graphOf>,
  id: NodeId,
  breakpoint: BreakpointName,
  state?: StateName,
): unknown[] => {
  try {
    return resolveCatalogNode(
      graph,
      id,
      state,
      undefined,
      breakpoint,
    ).children.map(shown);
  } catch (error) {
    // (A hidden instance root draws nothing — as an origin root hidden at that breakpoint.)
    if ((error as { code?: string }).code === "NODE_DISABLED") return [];
    throw error;
  }
};
const displays = (graph: ReturnType<typeof graphOf>, id: NodeId) =>
  Object.fromEntries(
    BREAKPOINTS.flatMap((breakpoint) =>
      STATES.map((state) => [
        `${breakpoint}/${state ?? "base"}`,
        display(graph, id, breakpoint, state),
      ]),
    ),
  );
/** A display without the root record's kept placement fields (`sizing` · `layout`). */
const unplaced = (records: unknown[]) =>
  records.map((record) => {
    const {
      sizing: _sizing,
      layout: _layout,
      ...rest
    } = record as Record<string, unknown>;
    return rest;
  });
const unplacedAll = (all: Record<string, unknown[]>) =>
  Object.fromEntries(
    Object.entries(all).map(([key, records]) => [key, unplaced(records)]),
  );
/** The record at a child path of a display (`0` = the template root). */
const at = (records: unknown[], ...path: number[]) =>
  path.reduce(
    (record, index) => (record as { children: unknown[] }).children[index],
    { children: records } as unknown,
  ) as {
    props: Record<string, unknown>;
    visual: Record<string, unknown>;
    children: unknown[];
  };

const tPatch = (owner: NodeId): InstanceAddress => ({
  instances: [owner],
  templatePath: [R, T],
});
const pkPatch = (owner: NodeId): InstanceAddress => ({
  instances: [owner],
  templatePath: [R, PK],
});
const nested = (owner: NodeId): InstanceAddress => ({
  instances: [owner, N],
  templatePath: [R2, T2],
});
const pickerList = (owner: NodeId): InstanceAddress => ({
  instances: [owner, PK],
  templatePath: ["lib:template:pickRoot", "lib:template:list"],
});

const shapes = [
  ["referenced origin on a page", { originRef: true }, true],
  ["hidden template (deleted origin)", { originRef: false }, false],
  ["owned template (old shape)", {}, false],
] as const;

/**
 * Component `comp`: origin R (Section, color black · mobile blue) > T (Text, color black · mobile
 * blue) + N (an instance of `comp2`, whose origin R2 > T2 — N overrides T2 at tablet) + PK (a
 * library Picker). `comp3`: a Text origin (its root accepts `children`). `comp4`: for swaps.
 * Instances: I (under test) · J (no override) · K (its own override on T).
 */
function fixture(
  shape: Partial<DefinitionEntry>,
  onPage: boolean,
  instance: Partial<NodeEntry>,
  extraNodes: NodeEntry[] = [],
) {
  const t = node("t", "lib:definition:text", {
    props: { children: set("T") },
    visual: { color: set("black") },
    responsive: { mobile: { visual: { color: set("blue") } } },
  });
  const t2 = node("t2", "lib:definition:text", {
    props: { children: set("T2") },
    visual: { color: set("black") },
  });
  const r2 = node("r2", "lib:definition:section", { children: [T2] });
  const n = node("n", COMP2, {
    descendantOverrides: [
      {
        kind: "patch",
        address: { instances: [N], templatePath: [R2, T2] },
        responsive: { tablet: { visual: { color: set("blue") } } },
      },
    ],
  });
  const pk = node("pk", "lib:definition:picker");
  const r = node("r", "lib:definition:section", {
    children: [T, N, PK],
    visual: { color: set("black") },
    responsive: {
      tablet: { fillSizing: { width: { factor: 2 } } },
      mobile: { visual: { color: set("blue") } },
    },
  });
  const rt = node("rt", "lib:definition:text", {
    props: { children: set("Root text") },
  });
  const r4 = node("r4", "lib:definition:section");
  const i = node("i", COMP, instance);
  const j = node("j", COMP);
  const k = node("k", COMP, {
    descendantOverrides: [
      { kind: "patch", address: tPatch(K), visual: { color: set("purple") } },
    ],
  });
  const i3 = node("i3", COMP3, { props: { children: set("Instance text") } });
  return graphOf(
    [t, t2, r2, n, pk, r, rt, r4, i, j, k, i3, ...extraNodes],
    [...(onPage ? ["r", "r2", "rt", "r4"] : []), "i", "j", "k", "i3"],
    [
      definition(COMP, "Comp", R, shape),
      definition(COMP2, "Comp2", R2, shape),
      definition(COMP3, "Comp3", RT, shape),
      definition(COMP4, "Comp4", R4, shape),
    ],
  );
}

/** The Phase 0 table's override set on one instance (rows 3 · 4 · 6 · 7 · 8 · 9 · 11 ~ 18). */
const everyOverride = (owner: NodeId): Partial<NodeEntry> => ({
  visual: { color: set("red") },
  responsive: {
    tablet: {
      visual: { opacity: set(0.5) },
      sizing: { width: set(300) },
      layout: { display: set("grid") },
    },
  },
  sizing: { width: set(100) },
  layout: { display: set("flex") },
  fills: [fill("#ff0000ff")],
  fillSizing: { width: { factor: 1 } },
  stateRules: { hover: { color: set("green") } },
  visibility: { tablet: false },
  descendantOverrides: [
    {
      kind: "patch",
      address: tPatch(owner),
      props: { children: set("P") },
      responsive: { tablet: { visual: { color: set("red") } } },
      fills: [fill("#00ff00ff", "f2")],
      stateRules: { hover: { opacity: set(0.2) } },
      visibility: { mobile: false },
    },
    { kind: "patch", address: pkPatch(owner), enabled: false },
    {
      kind: "patch",
      address: nested(owner),
      responsive: { mobile: { visual: { color: set("red") } } },
    },
  ],
});

describe("ADR-262 G1 — push instance overrides onto the origin", () => {
  it.each(shapes)(
    "keeps the pushed instance's display (%s)",
    (_, shape, onPage) => {
      const graph = fixture(shape, onPage, everyOverride(I));
      const before = displays(graph, I);
      const start = snapshot(graph);
      const { result } = run(
        graph,
        pushInstanceOverrides({ id: I, newId: allocator() }),
      );
      expect(displays(graph, I)).toEqual(before);
      // An instance with its own override at the position keeps its value there (the root's
      // pushed color · fills reach it like every instance).
      expect(at(display(graph, K, "desktop"), 0, 0).visual.color).toBe("purple");
      expect(at(display(graph, K, "desktop"), 0).visual.color).toBe("red");
      // An instance without one shows the pushed instance's display (less the placement it keeps).
      expect(unplacedAll(displays(graph, J))).toEqual(unplacedAll(before));
      // The instance keeps only placement: `sizing` · `layout` (decision 3) and no field override.
      const instance = graph.getEntry(I) as NodeEntry;
      expect(instance.props).toEqual({});
      expect(instance.visual).toEqual({});
      expect(instance.fills).toBeUndefined();
      expect(instance.fillSizing).toBeUndefined();
      expect(instance.stateRules).toBeUndefined();
      expect(instance.visibility).toBeUndefined();
      expect(instance.sizing).toEqual({ width: set(100) });
      expect(instance.layout).toEqual({ display: set("flex") });
      expect(instance.responsive).toEqual({
        tablet: {
          sizing: { width: set(300) },
          layout: { display: set("grid") },
        },
      });
      expect(instance.descendantOverrides).toEqual([]);
      undo(graph, result.inverse);
      expect(snapshot(graph)).toBe(start);
    },
  );

  it.each(shapes)(
    "hand-computed cells: origin mobile layer vs instance base (Round 1 h1) · instance tablet only (Round 2 h1) · nested whole-replace (Round 1 h1-2) (%s)",
    (_, shape, onPage) => {
      const graph = fixture(shape, onPage, everyOverride(I));
      run(graph, pushInstanceOverrides({ id: I, newId: allocator() }));
      const r = graph.getEntry(R) as NodeEntry;
      // Round 1 h1: R mobile=blue · I base=red → R.color=red and the mobile layer's color is gone.
      expect(r.visual.color).toEqual(set("red"));
      expect(r.responsive?.mobile?.visual?.color).toBeUndefined();
      expect(r.responsive?.tablet?.visual?.opacity).toEqual(set(0.5));
      expect(at(display(graph, J, "desktop"), 0).visual.color).toBe("red");
      // Row 9: the root is hidden at tablet for every instance now (R took the AND) — and at
      // mobile by the visibility fallback, as the instance itself was before the push.
      expect(r.visibility).toEqual({ tablet: false });
      expect(display(graph, J, "tablet")).toEqual([]);
      expect(display(graph, J, "mobile")).toEqual([]);
      // Round 2 h1: T mobile=blue · I tablet=red → black / red / red: T.tablet=red, T.mobile gone.
      const t = graph.getEntry(T) as NodeEntry;
      expect(t.visual.color).toEqual(set("black"));
      expect(t.responsive).toEqual({
        tablet: { visual: { color: set("red") } },
      });
      expect(at(display(graph, J, "desktop"), 0, 0).visual.color).toBe("black");
      // (The mobile cells of rows 4 · 18 are read in the dedicated tests below — here the root
      // is hidden there.)
      expect(at(display(graph, K, "desktop"), 0, 0).visual.color).toBe("purple");
      // Row 11 · 13 · 14 · 15 · 16: props, state rule, hidden position, fills, visibility.
      expect(t.props.children).toEqual(set("P"));
      expect(t.fills).toEqual([fill("#00ff00ff", "f2")]);
      expect(t.visibility).toEqual({ mobile: false });
      expect(t.stateRules).toEqual({ hover: { opacity: set(0.2) } });
      expect((graph.getEntry(PK) as NodeEntry).enabled).toBe(false);
      // Row 18: N tablet=blue masked by I's whole `responsive` → N's override is I's.
      expect((graph.getEntry(N) as NodeEntry).descendantOverrides).toEqual([
        {
          kind: "patch",
          address: { instances: [N], templatePath: [R2, T2] },
          responsive: { mobile: { visual: { color: set("red") } } },
        },
      ]);
      // Row 6 · 7 · 8: the root's paint and state rule.
      expect(r.fills).toEqual([fill("#ff0000ff")]);
      expect(r.fillSizing).toEqual({ width: { factor: 1 } });
      expect(r.stateRules).toEqual({ hover: { color: set("green") } });
    },
  );

  it("row 4 alone (Round 2 h1): black / red / red on every instance", () => {
    const graph = fixture({ originRef: true }, true, {
      descendantOverrides: [
        {
          kind: "patch",
          address: tPatch(I),
          responsive: { tablet: { visual: { color: set("red") } } },
        },
      ],
    });
    const cell = (id: NodeId) =>
      BREAKPOINTS.map((bp) => at(display(graph, id, bp), 0, 0).visual.color);
    expect(cell(I)).toEqual(["black", "red", "red"]);
    expect(cell(J)).toEqual(["black", "black", "blue"]);
    run(graph, pushInstanceOverrides({ id: I, newId: allocator() }));
    expect(cell(I)).toEqual(["black", "red", "red"]);
    expect(cell(J)).toEqual(["black", "red", "red"]);
    expect(cell(K)).toEqual(["purple", "purple", "purple"]);
  });

  it("row 18 alone (Round 1 h1-2): the nested tablet layer stays masked after the push", () => {
    const graph = fixture({ originRef: true }, true, {
      descendantOverrides: [
        {
          kind: "patch",
          address: nested(I),
          responsive: { mobile: { visual: { color: set("red") } } },
        },
      ],
    });
    const cell = (id: NodeId) =>
      BREAKPOINTS.map(
        (bp) => at(display(graph, id, bp), 0, 1, 0, 0).visual.color,
      );
    expect(cell(I)).toEqual(["black", "black", "red"]);
    expect(cell(J)).toEqual(["black", "blue", "blue"]);
    run(graph, pushInstanceOverrides({ id: I, newId: allocator() }));
    expect(cell(I)).toEqual(["black", "black", "red"]);
    expect(cell(J)).toEqual(["black", "black", "red"]);
  });

  it("row 7 alone: the instance's base fill sizing masks the origin's tablet layer — cleared", () => {
    const graph = fixture({ originRef: true }, true, {
      fillSizing: { width: { factor: 1 } },
    });
    const before = displays(graph, I);
    run(graph, pushInstanceOverrides({ id: I, newId: allocator() }));
    expect(displays(graph, I)).toEqual(before);
    expect(unplacedAll(displays(graph, J))).toEqual(unplacedAll(before));
    const r = graph.getEntry(R) as NodeEntry;
    expect(r.fillSizing).toEqual({ width: { factor: 1 } });
    expect(r.responsive?.tablet).toBeUndefined();
  });

  it("row 1 · 2: a root prop and a component property value land on the nodes they drive", () => {
    const graph = fixture({ originRef: true }, true, {});
    run(
      graph,
      addComponentProperty({
        definitionId: COMP,
        key: "p1",
        name: "Title",
        kind: "text",
        target: { id: T, prop: "children" },
      }),
    );
    run(
      graph,
      setFields({
        targets: [{ kind: "node", id: I }],
        props: { p1: set("Hello") },
      }),
    );
    const before = displays(graph, I);
    run(graph, pushInstanceOverrides({ id: I, newId: allocator() }));
    expect(displays(graph, I)).toEqual(before);
    expect((graph.getEntry(T) as NodeEntry).props.children).toEqual(
      set("Hello"),
    );
    expect((graph.getEntry(I) as NodeEntry).props).toEqual({});
    expect(at(display(graph, J, "desktop"), 0, 0).props.children).toBe("Hello");
    // A root prop the origin accepts (comp3's Text root).
    const text = displays(graph, I3);
    run(graph, pushInstanceOverrides({ id: I3, newId: allocator() }));
    expect(displays(graph, I3)).toEqual(text);
    expect((graph.getEntry(RT) as NodeEntry).props.children).toEqual(
      set("Instance text"),
    );
  });

  it("row 17: a slot's field writes go, its contents stay the instance's", () => {
    const own = node("own", "lib:definition:item", {
      props: { children: set("Own") },
    });
    const graph = fixture(
      { originRef: true },
      true,
      {
        descendantOverrides: [
          {
            kind: "fillSlot",
            address: pickerList(I),
            childIds: [own.id],
            visual: { color: set("red") },
          },
        ],
      },
      [own],
    );
    const before = displays(graph, I);
    run(graph, pushInstanceOverrides({ id: I, newId: allocator() }));
    expect(displays(graph, I)).toEqual(before);
    expect((graph.getEntry(I) as NodeEntry).descendantOverrides).toEqual([
      { kind: "fillSlot", address: pickerList(I), childIds: [own.id] },
    ]);
    expect((graph.getEntry(PK) as NodeEntry).descendantOverrides).toEqual([
      {
        kind: "patch",
        address: {
          instances: [PK],
          templatePath: pickerList(I).templatePath,
        },
        visual: { color: set("red") },
      },
    ]);
    // The other instance shows the list's color, not the item.
    expect(JSON.stringify(display(graph, J, "desktop"))).not.toContain("Own");
  });

  it("decision 1: a library origin's instance pushes root props · visual as project defaults", () => {
    const graph = graphOf(
      [
        node("a", "lib:definition:picker", {
          props: { label: set("Mine") },
          visual: { color: set("red") },
        }),
        node("b", "lib:definition:picker"),
      ],
      ["a", "b"],
    );
    const a = "project:node:a" as NodeId;
    const before = displays(graph, a);
    run(graph, pushInstanceOverrides({ id: a, newId: allocator() }));
    expect(displays(graph, a)).toEqual(before);
    expect(displays(graph, "project:node:b" as NodeId)).toEqual(before);
    expect((graph.getEntry(a) as NodeEntry).props).toEqual({});
  });

  it("refuses a node that is no instance", () => {
    const graph = fixture({ originRef: true }, true, {});
    expect(
      code(() => pushInstanceOverrides({ id: T, newId: allocator() })(graph)),
    ).toBe("NOT_AN_INSTANCE");
  });

  it("nested address rebases to the inner owner (the projection reads both at one position)", () => {
    const graph = fixture({ originRef: true }, true, everyOverride(I));
    const found = overridesAt(
      (id) => graph.getEntry(id),
      graph.getEntry(I) as NodeEntry,
      [I, N],
      [R2, T2],
    );
    expect(
      found.map((item) => [item.owner.id, item.override.address.instances]),
    ).toEqual([
      [I, [I, N]],
      [N, [N]],
    ]);
  });
});

describe("ADR-262 G2 — reset all changes", () => {
  it.each(shapes)(
    "shows as a fresh instance, keeping placement and slot contents (%s)",
    (_, shape, onPage) => {
      const own = node("own", "lib:definition:item", {
        props: { children: set("Own") },
      });
      const graph = fixture(
        shape,
        onPage,
        {
          ...everyOverride(I),
          descendantOverrides: [
            ...(everyOverride(I).descendantOverrides ?? []),
            {
              kind: "fillSlot",
              address: pickerList(I),
              childIds: [own.id],
              visual: { color: set("red") },
            },
          ],
        },
        [own],
      );
      const start = snapshot(graph);
      const { result } = run(graph, resetInstance({ id: I }));
      const instance = graph.getEntry(I) as NodeEntry;
      expect(instance.props).toEqual({});
      expect(instance.visual).toEqual({});
      expect(instance.fills).toBeUndefined();
      expect(instance.fillSizing).toBeUndefined();
      expect(instance.stateRules).toBeUndefined();
      expect(instance.visibility).toBeUndefined();
      expect(instance.sizing).toEqual({ width: set(100) });
      expect(instance.layout).toEqual({ display: set("flex") });
      expect(instance.responsive).toEqual({
        tablet: {
          sizing: { width: set(300) },
          layout: { display: set("grid") },
        },
      });
      expect(instance.descendantOverrides).toEqual([
        { kind: "fillSlot", address: pickerList(I), childIds: [own.id] },
      ]);
      // = the fresh instance J, except the kept placement on the root and the slot contents
      // (the picker's list: the third child of the root).
      const comparable = (records: unknown[]) =>
        unplaced(records).map((record) => ({
          ...record,
          children: (record.children as unknown[]).slice(0, 2),
        }));
      for (const bp of BREAKPOINTS)
        for (const state of STATES)
          expect(comparable(display(graph, I, bp, state))).toEqual(
            comparable(display(graph, J, bp, state)),
          );
      expect(JSON.stringify(display(graph, I, "desktop"))).toContain("Own");
      undo(graph, result.inverse);
      expect(snapshot(graph)).toBe(start);
    },
  );

  it("folds a swapped nested instance back (ADR-261 Phase 5 value)", () => {
    const graph = fixture({ originRef: true }, true, {});
    run(
      graph,
      addComponentProperty({
        definitionId: COMP,
        key: "sw",
        name: "Nested",
        kind: "instance",
        target: { id: N },
      }),
    );
    const fresh = displays(graph, J);
    run(
      graph,
      setInstanceProperty({
        ownerId: I,
        instances: [I],
        key: "sw",
        definitionId: COMP4,
        newId: allocator(),
      }),
    );
    expect(
      (graph.getEntry(I) as NodeEntry).descendantOverrides.some(
        (item) => item.kind === "replace",
      ),
    ).toBe(true);
    run(graph, resetInstance({ id: I }));
    expect((graph.getEntry(I) as NodeEntry).descendantOverrides).toEqual([]);
    expect(displays(graph, I)).toEqual(fresh);
  });

  it("folds a swap the outer fold-back exposes (review Round 3 m1)", () => {
    // Card.icon Star → Heart, then Heart's Glyph A → B: the inner swap lives on the outer
    // replacement until the outer folds back, then it is the instance's own — one reset drops both.
    const id = (name: string) => `project:node:${name}` as NodeId;
    const def = (name: string, root: string) =>
      definition(`project:definition:${name}` as DefinitionEntry["id"], name, id(root), {
        originRef: true,
      });
    const graph = graphOf(
      [
        text("a", "A"),
        text("b", "B"),
        node("star", "lib:definition:section", { children: [id("sGlyph")] }),
        node("sGlyph", "project:definition:A", { name: "Glyph" }),
        node("heart", "lib:definition:section", { children: [id("hGlyph")] }),
        node("hGlyph", "project:definition:A", { name: "Glyph" }),
        node("card", "lib:definition:section", { children: [id("icon")] }),
        node("icon", "project:definition:Star"),
        node("ci", "project:definition:Card"),
        node("cj", "project:definition:Card"),
      ],
      ["a", "b", "star", "heart", "card", "ci", "cj"],
      [
        def("A", "a"),
        def("B", "b"),
        def("Star", "star"),
        def("Heart", "heart"),
        def("Card", "card"),
      ],
    );
    for (const [name, target, key] of [
      ["Card", "icon", "icon"],
      ["Heart", "hGlyph", "glyph"],
      ["Star", "sGlyph", "glyph"],
    ] as const)
      run(
        graph,
        addComponentProperty({
          definitionId: `project:definition:${name}`,
          key,
          name: key,
          kind: "instance",
          target: { id: id(target) },
        }),
      );
    const newId = allocator();
    const fresh = displays(graph, id("cj"));
    run(
      graph,
      setInstanceProperty({
        ownerId: id("ci"),
        instances: [id("ci")],
        key: "icon",
        definitionId: "project:definition:Heart",
        newId,
      }),
    );
    const outer = (graph.getEntry(id("ci")) as NodeEntry).descendantOverrides[0];
    if (outer?.kind !== "replace") throw new Error("outer swap missing");
    run(
      graph,
      setInstanceProperty({
        ownerId: outer.replacementId,
        instances: [outer.replacementId],
        key: "glyph",
        definitionId: "project:definition:B",
        newId,
      }),
    );
    expect(JSON.stringify(displays(graph, id("ci")))).toContain('"B"');
    const start = snapshot(graph);
    const { result } = run(graph, resetInstance({ id: id("ci") }));
    expect((graph.getEntry(id("ci")) as NodeEntry).descendantOverrides).toEqual([]);
    expect(displays(graph, id("ci"))).toEqual(fresh);
    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(start);
  });

  it("refuses a node that is no instance", () => {
    const graph = fixture({ originRef: true }, true, {});
    expect(code(() => resetInstance({ id: T })(graph))).toBe("NOT_AN_INSTANCE");
  });
});
