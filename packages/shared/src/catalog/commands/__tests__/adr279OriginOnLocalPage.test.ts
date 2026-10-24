/**
 * ADR-279 — Create component: the definition owns the node (the Local page draws it) and an
 * instance stands where the node stood. Decision 2 (fixture 5 — R3: the ownership transfer keeps
 * the display at every breakpoint, position keys move layer by layer) and Decision 8 (nested
 * fixture 5 — R8: the addresses through the extracted node are rewritten in the same step).
 */
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../document/graph";
import { POSITION_LAYOUT_KEYS } from "../../document/absoluteLayout";
import type {
  BreakpointName,
  CatalogDocument,
  CatalogEntry,
  DefinitionEntry,
  InstanceAddress,
  InteractionEntry,
  LayoutWrites,
  NodeEntry,
  NodeId,
  PageEntry,
} from "../../document/types";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../resolution/resolver";
import { createComponent } from "../components";
import { removeTargets } from "../structure";
import {
  allocator,
  code,
  documentOf,
  graphOf,
  library,
  node,
  PAGE,
  run,
  snapshot,
  text,
  undo,
} from "./fixture";

const set = <V>(value: V) => ({ kind: "set" as const, value });
const BREAKPOINTS: readonly BreakpointName[] = ["desktop", "tablet", "mobile"];
const ROOT = "project:node:root" as NodeId;

/**
 * What a consumer draws at a position (IDs dropped). A project instance's record is its collapsed
 * template root's (`collapsedIds` — the instance root layer is applied onto the root), so a nested
 * instance (Decision 8's J) draws as the root it shows.
 */
const shown = (record: ResolvedCatalogNode): unknown =>
  record.definitionId.startsWith("project:definition:") &&
  record.children.length === 1
    ? shown(record.children[0]!)
    : {
  definitionId: record.definitionId,
  props: record.props,
  visual: record.visual,
  layout: record.layout,
  sizing: record.sizing,
        fills: record.fills,
        children: record.children.map(shown),
      };
/** What an owned node draws at a breakpoint. */
const drawn = (graph: CatalogGraph, id: NodeId, breakpoint: BreakpointName) =>
  shown(resolveCatalogNode(graph, id, undefined, undefined, breakpoint));
/** What an instance draws: its template root and below. */
const drawnByInstance = (
  graph: CatalogGraph,
  id: NodeId,
  breakpoint: BreakpointName,
) =>
  resolveCatalogNode(graph, id, undefined, undefined, breakpoint).children.map(
    shown,
  )[0];
const page = (graph: CatalogGraph) => graph.getEntry(PAGE) as PageEntry;
const entry = <T extends CatalogEntry["kind"]>(
  graph: CatalogGraph,
  id: string,
  kind: T,
) => {
  const found = graph.getEntry(id);
  expect(found?.kind).toBe(kind);
  return found as Extract<CatalogEntry, { kind: T }>;
};
const positionKeys = (layout: LayoutWrites | undefined) =>
  POSITION_LAYOUT_KEYS.filter((key) => layout?.[key]);
const reloads = (graph: CatalogGraph) =>
  code(() => new CatalogGraph(graph.exportDocument(), library()));

/**
 * Create a component from the page node `rootId`: the definition owns it, an instance of the
 * definition stands at its index, every breakpoint draws the same, no position key stays in any
 * template layer, one undo step restores the document. Returns what `also` saw before the undo.
 */
function createKeepsDisplay<T>(
  graph: CatalogGraph,
  rootId: NodeId,
  also: (ctx: {
    instance: NodeEntry;
    root: NodeEntry;
    definition: DefinitionEntry;
  }) => T,
): T {
  const before = Object.fromEntries(
    BREAKPOINTS.map((breakpoint) => [
      breakpoint,
      drawn(graph, rootId, breakpoint),
    ]),
  );
  const start = snapshot(graph);
  const children = [...page(graph).children];
  const index = children.indexOf(rootId);
  const { plan, result } = run(
    graph,
    createComponent({ id: rootId, name: "Made", newId: allocator() }),
  );
  const after = page(graph).children;
  expect(after).toHaveLength(children.length);
  const instanceId = after[index]!;
  expect(instanceId).not.toBe(rootId);
  expect(after.filter((id) => id !== instanceId)).toEqual(
    children.filter((id) => id !== rootId),
  );
  const definition = entry(graph, graph.ownerOf(rootId)!, "definition");
  expect(definition).toMatchObject({
    name: "Made",
    mode: "composite",
    usage: "component",
    templateRootId: rootId,
  });
  expect("originRef" in definition).toBe(false);
  const instance = entry(graph, instanceId, "node");
  expect(instance.definitionId).toBe(definition.id);
  expect(plan.selectAfter).toEqual([instanceId]);
  for (const breakpoint of BREAKPOINTS)
    expect(drawnByInstance(graph, instanceId, breakpoint)).toEqual(
      before[breakpoint],
    );
  const root = entry(graph, rootId, "node");
  expect(positionKeys(root.layout)).toEqual([]);
  for (const layer of Object.values(root.responsive ?? {}))
    expect(positionKeys(layer?.layout)).toEqual([]);
  // The template root is not a node to make a component of again.
  expect(
    code(() =>
      run(
        graph,
        createComponent({ id: rootId, name: "X", newId: allocator() }),
      ),
    ),
  ).not.toBe("ACCEPTED");
  expect(reloads(graph)).toBe("ACCEPTED");
  const seen = also({ instance, root, definition });
  undo(graph, result.inverse);
  expect(snapshot(graph)).toBe(start);
  return seen;
}

describe("ADR-279 Decision 2 — Create component: the definition owns the node, an instance stands in its place", () => {
  const pickerList = (owner: NodeId): InstanceAddress => ({
    instances: [owner],
    templatePath: ["lib:template:pickRoot", "lib:template:list"],
  });

  it("(a) a Picker with its own list item (fillSlot) — the instance shows it, at the node's index", () => {
    const own = node("own", "lib:definition:item", {
      props: { children: set("Own item") },
    });
    const graph = graphOf(
      [
        text("before", "Before"),
        node("root", "lib:definition:picker", {
          descendantOverrides: [
            { kind: "fillSlot", address: pickerList(ROOT), childIds: [own.id] },
          ],
        }),
        own,
        text("after", "After"),
      ],
      ["before", "root", "after"],
    );
    createKeepsDisplay(graph, ROOT, ({ instance, root }) => {
      expect(page(graph).children[1]).toBe(instance.id);
      expect(root.descendantOverrides).toHaveLength(1);
      expect(graph.ownerOf(own.id)).toBe(ROOT);
      expect(
        JSON.stringify(drawnByInstance(graph, instance.id, "desktop")),
      ).toContain("Own item");
    });
  });

  it("(b) a frame holding an overridden library instance — the override stays the inner node's (no rewrite on a page)", () => {
    const N = "project:node:n" as NodeId;
    const override = {
      kind: "patch" as const,
      address: {
        instances: [N, "lib:template:panelBadge"],
        templatePath: ["lib:template:badgeRoot", "lib:template:badgeText"],
      } as InstanceAddress,
      props: { children: set("Overridden") },
    };
    const graph = graphOf(
      [
        node("root", "lib:definition:section", { children: [N] }),
        node("n", "lib:definition:panel", { descendantOverrides: [override] }),
      ],
      ["root"],
    );
    expect(JSON.stringify(drawn(graph, ROOT, "desktop"))).toContain(
      "Overridden",
    );
    createKeepsDisplay(graph, ROOT, ({ instance }) => {
      expect(entry(graph, N, "node").descendantOverrides).toEqual([override]);
      expect(instance.descendantOverrides).toEqual([]);
    });
  });

  it("(c) base absolute + mobile inset: each layer's position keys move to the instance's same layer", () => {
    const graph = graphOf(
      [
        node("root", "lib:definition:section", {
          layout: {
            display: set("flex"),
            position: set("absolute"),
            insetLeft: set("10px"),
          },
          responsive: {
            mobile: { layout: { insetLeft: set("20px") } },
          },
        }),
      ],
      ["root"],
    );
    createKeepsDisplay(graph, ROOT, ({ instance, root }) => {
      expect(instance.layout).toEqual({
        position: set("absolute"),
        insetLeft: set("10px"),
      });
      expect(instance.responsive).toEqual({
        mobile: { layout: { insetLeft: set("20px") } },
      });
      expect(root.layout).toEqual({ display: set("flex") });
      expect(root.responsive?.mobile?.layout).toBeUndefined();
    });
  });

  it("(d) base relative + mobile absolute: the position that lives in one layer only moves with that layer", () => {
    const graph = graphOf(
      [
        node("root", "lib:definition:section", {
          layout: { display: set("flex") },
          responsive: {
            mobile: {
              layout: { position: set("absolute"), insetTop: set("5px") },
              visual: { color: set("red") },
            },
          },
        }),
      ],
      ["root"],
    );
    createKeepsDisplay(graph, ROOT, ({ instance, root }) => {
      expect(instance.layout).toBeUndefined();
      expect(instance.responsive).toEqual({
        mobile: {
          layout: { position: set("absolute"), insetTop: set("5px") },
        },
      });
      expect(root.layout).toEqual({ display: set("flex") });
      expect(root.responsive).toEqual({
        mobile: { visual: { color: set("red") } },
      });
    });
  });

  it("(e) base absolute + mobile pin release: the release moves too", () => {
    const graph = graphOf(
      [
        node("root", "lib:definition:section", {
          layout: { position: set("absolute"), insetLeft: set("10px") },
          responsive: {
            tablet: { layout: { insetLeft: set("15px") } },
            mobile: { layout: { position: set("relative") } },
          },
        }),
      ],
      ["root"],
    );
    createKeepsDisplay(graph, ROOT, ({ instance, root }) => {
      expect(instance.layout).toEqual({
        position: set("absolute"),
        insetLeft: set("10px"),
      });
      expect(instance.responsive).toEqual({
        tablet: { layout: { insetLeft: set("15px") } },
        mobile: { layout: { position: set("relative") } },
      });
      expect(root.layout).toBeUndefined();
      expect(root.responsive).toBeUndefined();
    });
  });
});

describe("ADR-279 Decision 8 — extracting a nested component rewrites the addresses through it in the same step", () => {
  const A = "project:definition:a" as DefinitionEntry["id"];
  const R = "project:node:r" as NodeId;
  const C = "project:node:c" as NodeId;
  const T = "project:node:t" as NodeId;
  const I = "project:node:i" as NodeId;
  const S = "project:node:s" as NodeId;
  const X = "project:node:x" as NodeId;
  const outer: DefinitionEntry = {
    kind: "definition",
    id: A,
    name: "Outer",
    mode: "composite",
    accepts: {},
    defaults: {},
    visual: {},
    stateRules: {},
    templateRootId: R,
    usage: "component",
  };
  const through = (...instances: NodeId[]): InstanceAddress => ({
    instances,
    templatePath: instances.length === 1 ? [R, C, T] : [C, T],
  });
  const atC = (...instances: NodeId[]): InstanceAddress => ({
    instances,
    templatePath: [R, C],
  });
  /** Outer `a`: R > C > T (C and T declare a slot); page instance I with `overrides` and `owned`. */
  const fixture = (
    overrides: NodeEntry["descendantOverrides"],
    owned: NodeEntry[] = [],
    extra: CatalogEntry[] = [],
  ) =>
    graphOf(
      [
        node("r", "lib:definition:section", { children: [C] }),
        node("c", "lib:definition:section", {
          children: [T],
          slot: { name: "content", required: false },
          visual: { color: set("black") },
        }),
        node("t", "lib:definition:section", {
          slot: { name: "inner", required: false },
          visual: { color: set("black") },
        }),
        node("i", A, { descendantOverrides: overrides }),
        ...owned,
      ],
      ["i"],
      [outer, ...extra],
    );
  /** Create a component from C (inside the Local card of `a`): its definition and the instance J. */
  const extract = (graph: CatalogGraph) => {
    const before = Object.fromEntries(
      BREAKPOINTS.map((breakpoint) => [
        breakpoint,
        drawnByInstance(graph, I, breakpoint),
      ]),
    );
    const start = snapshot(graph);
    const { plan, result } = run(
      graph,
      createComponent({ id: C, name: "Inner", newId: allocator() }),
    );
    const inner = entry(graph, graph.ownerOf(C)!, "definition");
    expect(inner).toMatchObject({ name: "Inner", templateRootId: C });
    const J = entry(graph, R, "node").children[0]!;
    expect(J).not.toBe(C);
    expect(entry(graph, J, "node").definitionId).toBe(inner.id);
    expect(plan.selectAfter).toEqual([J]);
    for (const breakpoint of BREAKPOINTS)
      expect(drawnByInstance(graph, I, breakpoint)).toEqual(before[breakpoint]);
    expect(reloads(graph)).toBe("ACCEPTED");
    return {
      J,
      done: () => {
        undo(graph, result.inverse);
        expect(snapshot(graph)).toBe(start);
      },
    };
  };

  it("(1) patch through C and patch at C: `instances += J`, `templatePath` from C; C itself becomes J", () => {
    const graph = fixture([
      { kind: "patch", address: through(I), visual: { color: set("red") } },
      {
        kind: "patch",
        address: atC(I),
        visual: { backgroundColor: set("blue") },
      },
    ]);
    const { J, done } = extract(graph);
    expect(
      entry(graph, I, "node").descendantOverrides.map((item) => item.address),
    ).toEqual([through(I, J), { instances: [I], templatePath: [R, J] }]);
    done();
  });

  it("(2) fillSlot at C: the slot stays C's, reached through J", () => {
    const graph = fixture(
      [{ kind: "fillSlot", address: atC(I), childIds: [S] }],
      [text("s", "Slot text")],
    );
    expect(JSON.stringify(drawnByInstance(graph, I, "desktop"))).toContain(
      "Slot text",
    );
    const { J, done } = extract(graph);
    expect(entry(graph, I, "node").descendantOverrides).toEqual([
      {
        kind: "fillSlot",
        address: { instances: [I, J], templatePath: [C] },
        childIds: [S],
      },
    ]);
    expect(graph.ownerOf(S)).toBe(I);
    done();
  });

  it("(3) replace through C: the replacement stays the instance's", () => {
    const graph = fixture(
      [{ kind: "replace", address: through(I), replacementId: X }],
      [text("x", "Replacement")],
    );
    expect(JSON.stringify(drawnByInstance(graph, I, "desktop"))).toContain(
      "Replacement",
    );
    const { J, done } = extract(graph);
    expect(entry(graph, I, "node").descendantOverrides).toEqual([
      { kind: "replace", address: through(I, J), replacementId: X },
    ]);
    expect(graph.ownerOf(X)).toBe(I);
    done();
  });

  it("(4) an interaction addressed through C", () => {
    const K = "project:interaction:k" as InteractionEntry["id"];
    const interaction: InteractionEntry = {
      kind: "interaction",
      id: K,
      ownerId: I,
      address: through(I),
      trigger: "press",
      action: { opcode: "navigate", pageId: PAGE },
    };
    const graph = fixture([], [], [interaction]);
    const { J, done } = extract(graph);
    expect(entry(graph, K, "interaction").address).toEqual(through(I, J));
    expect(graph.referrersOf(J).has(K)).toBe(true);
    done();
  });

  it("(5) a state owner reference (showWhen) addressed through C, in slot contents through C", () => {
    const graph = fixture(
      [{ kind: "fillSlot", address: through(I), childIds: [S] }],
      [
        node("s", "lib:definition:text", {
          props: { children: set("S") },
          showWhen: {
            all: [
              { key: "isHovered", from: { ancestor: { address: through(I) } } },
            ],
          },
        }),
      ],
    );
    const { J, done } = extract(graph);
    expect(entry(graph, I, "node").descendantOverrides).toEqual([
      { kind: "fillSlot", address: through(I, J), childIds: [S] },
    ]);
    expect(entry(graph, S, "node").showWhen).toEqual({
      all: [
        { key: "isHovered", from: { ancestor: { address: through(I, J) } } },
      ],
    });
    done();
  });
});

describe("ADR-279 Decision 1 — contract 46", () => {
  it("refuses a contract 45 document (an origin on a page — no migration, policy 2026-10-14)", () => {
    const document = {
      ...documentOf([], []),
      libraryContractVersion: 45,
    } as unknown as CatalogDocument;
    expect(code(() => new CatalogGraph(document, library()))).not.toBe(
      "ACCEPTED",
    );
  });
});

describe("ADR-279 Local page — deleting a template slot that an instance filled (review ADR-282 round 2)", () => {
  const A = "project:definition:a" as DefinitionEntry["id"];
  const R = "project:node:r" as NodeId;
  const C = "project:node:c" as NodeId;
  const I = "project:node:i" as NodeId;
  const S = "project:node:s" as NodeId;
  const SC = "project:node:sc" as NodeId;
  const K = "project:interaction:k" as InteractionEntry["id"];
  const outer: DefinitionEntry = {
    kind: "definition",
    id: A,
    name: "Outer",
    mode: "composite",
    accepts: {},
    defaults: {},
    visual: {},
    stateRules: {},
    templateRootId: R,
    usage: "component",
  };
  /** `a`: R > C (slot `content`); page instance I fills C with S (> SC), S owns interaction K. */
  const fixture = () =>
    graphOf(
      [
        node("r", "lib:definition:section", { children: [C] }),
        node("c", "lib:definition:section", {
          slot: { name: "content", required: false },
        }),
        node("i", A, {
          descendantOverrides: [
            {
              kind: "fillSlot",
              address: { instances: [I], templatePath: [R, C] },
              childIds: [S],
            },
          ],
        }),
        node("s", "lib:definition:section", { children: [SC] }),
        text("sc", "Filled"),
      ],
      ["i"],
      [
        outer,
        {
          kind: "interaction",
          id: K,
          ownerId: S,
          trigger: "press",
          action: { opcode: "navigate", pageId: PAGE },
        } as InteractionEntry,
      ],
    );

  it("removes the slot with the instance's contents there (and what they own) — no UNOWNED_NODE, one undo restores", () => {
    const graph = fixture();
    expect(JSON.stringify(drawnByInstance(graph, I, "desktop"))).toContain(
      "Filled",
    );
    const start = snapshot(graph);
    const { result } = run(
      graph,
      removeTargets({ targets: [{ kind: "node", id: C }] }),
    );
    expect(graph.getEntry(C)).toBeUndefined();
    expect(entry(graph, I, "node").descendantOverrides).toEqual([]);
    for (const gone of [S, SC, K]) expect(graph.getEntry(gone)).toBeUndefined();
    expect(entry(graph, R, "node").children).toEqual([]);
    expect(reloads(graph)).toBe("ACCEPTED");
    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(start);
  });
});

