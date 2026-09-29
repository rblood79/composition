import { describe, expect, it } from "vitest";
import { createG1Fixture } from "../../document/fixture";
import { CatalogGraph, createCatalogGraph } from "../../document/graph";
import type {
  CatalogDocument,
  CatalogEntry,
  NodeEntry,
  NodeId,
} from "../../document/types";
import { applyCatalogTransaction, type CatalogOperation } from "../transaction";

/**
 * ADR-248 Phase 4a-2: every transaction reports what it touched (affected parents and pages,
 * structural and layout relevance) so consumers never rediscover it with a whole-document scan,
 * and a structural edit validates only the staged entries and the entries that reference them.
 */
const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  children: string[] = [],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}`,
  definitionId,
  children: children.map((child) => `project:node:${child}` as NodeId),
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});

/** Two pages, a user composite with a template, a patched instance, interaction and state. */
function fixture(): CatalogDocument {
  const { document } = createG1Fixture();
  const nodes: NodeEntry[] = [
    node("frameA", "lib:definition:box", ["leafA1", "leafA2"]),
    node("leafA1", "lib:definition:text"),
    node("leafA2", "lib:definition:box", ["leafA3"]),
    node("leafA3", "lib:definition:text"),
    node("tileA", "project:definition:tile"),
    node("frameB", "lib:definition:box", ["leafB1", "tileB"]),
    node("leafB1", "lib:definition:text"),
    node("tileB", "project:definition:tile", [], {
      descendantOverrides: [
        {
          kind: "patch",
          address: {
            instances: ["project:node:tileB"],
            templatePath: ["project:node:tileRoot", "project:node:tileText"],
          },
          props: { children: { kind: "set", value: "patched" } },
        },
      ],
    }),
    node("tileRoot", "lib:definition:box", ["tileText"]),
    node("tileText", "lib:definition:text"),
  ];
  const entries: Record<string, CatalogEntry> = {
    ...document.entries,
    "project:project:g1": {
      ...(document.entries["project:project:g1"] as Extract<
        CatalogEntry,
        { kind: "project" }
      >),
      pageIds: ["project:page:main", "project:page:second"],
      definitionIds: ["project:definition:tile"],
      themeIds: ["project:theme:brand"],
      tokenIds: ["project:token:brand"],
      stateVariableIds: ["project:stateVariable:open"],
      interactionIds: ["project:interaction:go"],
    },
    "project:page:main": {
      kind: "page",
      id: "project:page:main",
      name: "Main",
      route: "/",
      children: [
        "project:node:cardA",
        "project:node:cardB",
        "project:node:frameA",
        "project:node:tileA",
      ],
    },
    "project:page:second": {
      kind: "page",
      id: "project:page:second",
      name: "Second",
      route: "/second",
      children: ["project:node:frameB"],
    },
    "project:definition:tile": {
      kind: "definition",
      id: "project:definition:tile",
      name: "Tile",
      mode: "composite",
      templateRootId: "project:node:tileRoot",
      accepts: {},
      defaults: {},
      visual: {},
      stateRules: {},
    },
    "project:token:brand": {
      kind: "token",
      id: "project:token:brand",
      name: "brand",
      tokenType: "color",
      value: "#ff0000",
      source: "user-defined",
    },
    "project:theme:brand": {
      kind: "theme",
      id: "project:theme:brand",
      name: "Brand",
      tokenIds: ["project:token:brand"],
      preset: {
        tint: "blue",
        neutral: "gray",
        radius: "md",
        darkMode: "light",
      },
    },
    "project:stateVariable:open": {
      kind: "stateVariable",
      id: "project:stateVariable:open",
      ownerId: "project:node:frameA",
      name: "open",
      valueType: "boolean",
      defaultValue: false,
    },
    "project:interaction:go": {
      kind: "interaction",
      id: "project:interaction:go",
      ownerId: "project:node:leafA1",
      trigger: "press",
      action: {
        opcode: "capability",
        targetId: "project:node:leafB1",
        capabilityId: "selectItem",
      },
    },
  };
  for (const item of nodes) entries[item.id] = item;
  return { ...document, entries };
}
const library = () => createG1Fixture().library;
const request = (graph: CatalogGraph, ops: CatalogOperation[]) => ({
  projectId: graph.projectId,
  expectedRevision: graph.revision,
  ops,
  history: { kind: "record" as const, label: "edit" },
});
const entryOf = <K extends CatalogEntry["kind"]>(
  graph: CatalogGraph,
  id: string,
) => graph.getEntry(id) as Extract<CatalogEntry, { kind: K }>;

describe("ADR-248 Phase 4a-2 transaction impact", () => {
  it("reports owner and page for a paint-only leaf edit", () => {
    const graph = new CatalogGraph(fixture(), library());
    const result = applyCatalogTransaction(
      graph,
      request(graph, [
        {
          kind: "patchNodeVisual",
          id: "project:node:leafA3",
          key: "color",
          write: { kind: "set", value: "#00ff00" },
        },
      ]),
    );
    expect(result.impact).toEqual({
      affectedParents: new Set(["project:node:leafA2"]),
      affectedPages: new Set(["project:page:main"]),
      structural: false,
      layout: false,
    });
  });

  it("marks layout-relevant leaf edits", () => {
    const graph = new CatalogGraph(fixture(), library());
    for (const op of [
      {
        kind: "patchNodeVisual",
        id: "project:node:leafA3",
        key: "fontSize",
        write: { kind: "set", value: 20 },
      },
      {
        kind: "patchNodeProp",
        id: "project:node:leafA3",
        key: "children",
        write: { kind: "set", value: "longer text" },
      },
      {
        kind: "patchNodeLayout",
        id: "project:node:leafA2",
        key: "display",
        write: { kind: "set", value: "flex" },
      },
    ] as CatalogOperation[]) {
      const result = applyCatalogTransaction(graph, request(graph, [op]));
      expect(result.impact.layout).toBe(true);
      expect(result.impact.structural).toBe(false);
    }
  });

  it("reports both owners and both pages for a move across pages", () => {
    const graph = new CatalogGraph(fixture(), library());
    const frameA = entryOf<"node">(graph, "project:node:frameA");
    const frameB = entryOf<"node">(graph, "project:node:frameB");
    const result = applyCatalogTransaction(
      graph,
      request(graph, [
        {
          kind: "put",
          entry: {
            ...frameA,
            children: frameA.children.filter(
              (id) => id !== "project:node:leafA2",
            ),
          },
        },
        {
          kind: "put",
          entry: {
            ...frameB,
            children: [...frameB.children, "project:node:leafA2"],
          },
        },
      ]),
    );
    expect(result.impact.structural).toBe(true);
    expect(result.impact.layout).toBe(true);
    expect(result.impact.affectedParents).toEqual(
      new Set(["project:node:frameA", "project:node:frameB"]),
    );
    expect(result.impact.affectedPages).toEqual(
      new Set(["project:page:main", "project:page:second"]),
    );
  });

  it("fans a template node edit out to the pages of its instances", () => {
    const graph = new CatalogGraph(fixture(), library());
    const result = applyCatalogTransaction(
      graph,
      request(graph, [
        {
          kind: "patchNodeVisual",
          id: "project:node:tileText",
          key: "color",
          write: { kind: "set", value: "#0000ff" },
        },
      ]),
    );
    expect(result.impact.affectedParents).toEqual(
      new Set(["project:node:tileRoot"]),
    );
    expect(result.impact.affectedPages).toEqual(
      new Set(["project:page:main", "project:page:second"]),
    );
  });

  it("validates a 5k-sibling structural insert without a whole-graph pass", () => {
    const base = fixture();
    const entries: Record<string, CatalogEntry> = { ...base.entries };
    const leaves = Array.from({ length: 5000 }, (_, index) =>
      node(`bulk${index}`, "lib:definition:text"),
    );
    for (const leaf of leaves) entries[leaf.id] = leaf;
    const frameA = entries["project:node:frameA"] as NodeEntry;
    entries[frameA.id] = {
      ...frameA,
      children: [...frameA.children, ...leaves.map((leaf) => leaf.id)],
    };
    const graph = new CatalogGraph({ ...base, entries }, library());
    const inserted = node("inserted", "lib:definition:text");
    const current = entryOf<"node">(graph, frameA.id);
    const result = applyCatalogTransaction(
      graph,
      request(graph, [
        { kind: "put", entry: inserted },
        {
          kind: "put",
          entry: { ...current, children: [...current.children, inserted.id] },
        },
      ]),
    );
    expect(result.impact.structural).toBe(true);
    expect(graph.metrics.transactionEntriesTraversed).toBe(0);
    // Reads scale with the edited owner's child list, not with the graph (≈5,020 entries).
    expect(graph.metrics.transactionEntryReads).toBeLessThan(200);
  });
});

/** Deterministic PRNG so the differential cases are reproducible. */
function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("ADR-248 Phase 4a-2 local structural validation = full validation", () => {
  it("accepts and rejects exactly what the whole-document validator does", () => {
    const random = prng(248);
    const pick = <T>(items: readonly T[]): T =>
      items[Math.floor(random() * items.length)];
    const outcomes = { accepted: 0, rejected: 0 };
    for (let round = 0; round < 800; round++) {
      const document = fixture();
      const graph = new CatalogGraph(document, library());
      const entries = { ...document.entries };
      const ids = Object.keys(entries);
      const nodeIds = ids.filter((id) => entries[id].kind === "node");
      const owners = ids.filter(
        (id) => entries[id].kind === "node" || entries[id].kind === "page",
      );
      const ownerOf = (id: string) =>
        owners.find(
          (owner) =>
            owner in entries &&
            (entries[owner] as NodeEntry).children.includes(id as NodeId),
        );
      const ops: CatalogOperation[] = [];
      const stage = (op: CatalogOperation) => {
        ops.push(op);
        if (op.kind === "put") entries[op.entry.id] = op.entry;
        if (op.kind === "remove") delete entries[op.id];
      };
      const withChildren = (id: string, children: readonly string[]) =>
        ({ ...entries[id], children }) as CatalogEntry;
      const steps = 1 + Math.floor(random() * 3);
      for (let step = 0; step < steps; step++) {
        const choice = random();
        const target = pick(nodeIds.filter((id) => id in entries));
        if (!target) break;
        const from = ownerOf(target);
        if (choice < 0.3) {
          // Move (possibly into its own subtree, or into itself).
          const to = pick(owners.filter((id) => id in entries));
          if (from && from !== to)
            stage({
              kind: "put",
              entry: withChildren(
                from,
                (entries[from] as NodeEntry).children.filter(
                  (id) => id !== target,
                ),
              ),
            });
          if (to !== from || random() < 0.5)
            stage({
              kind: "put",
              entry: withChildren(to, [
                ...(entries[to] as NodeEntry).children.filter(
                  (id) => id !== target || to !== from,
                ),
                target,
              ]),
            });
        } else if (choice < 0.45) {
          // Claim without releasing (double ownership).
          const to = pick(owners.filter((id) => id in entries && id !== from));
          stage({
            kind: "put",
            entry: withChildren(to, [
              ...(entries[to] as NodeEntry).children,
              target,
            ]),
          });
        } else if (choice < 0.7) {
          // Remove, sometimes releasing it, sometimes also its subtree.
          if (from && random() < 0.8)
            stage({
              kind: "put",
              entry: withChildren(
                from,
                (entries[from] as NodeEntry).children.filter(
                  (id) => id !== target,
                ),
              ),
            });
          if (random() < 0.5) {
            const stack = [...(entries[target] as NodeEntry).children];
            while (stack.length) {
              const id = stack.pop()!;
              if (!(id in entries)) continue;
              stack.push(...(entries[id] as NodeEntry).children);
              stage({ kind: "remove", id: id as NodeId });
            }
          }
          stage({ kind: "remove", id: target as NodeId });
        } else if (choice < 0.85) {
          // Insert, owned or not.
          const created = node(`new${round}_${step}`, "lib:definition:text");
          stage({ kind: "put", entry: created });
          if (random() < 0.8) {
            const to = pick(owners.filter((id) => id in entries));
            stage({
              kind: "put",
              entry: withChildren(to, [
                ...(entries[to] as NodeEntry).children,
                created.id,
              ]),
            });
          }
        } else {
          // Remove a non-node entry some other entry references.
          const referenced = pick([
            "project:token:brand",
            "project:definition:tile",
            "project:stateVariable:open",
            "project:interaction:go",
            "project:theme:brand",
          ]);
          if (referenced in entries)
            stage({ kind: "remove", id: referenced as CatalogEntry["id"] });
          if (random() < 0.5) {
            const project = entries["project:project:g1"] as Extract<
              CatalogEntry,
              { kind: "project" }
            >;
            const without = (list: readonly string[]) =>
              list.filter((id) => id !== referenced);
            stage({
              kind: "put",
              entry: {
                ...project,
                definitionIds: without(project.definitionIds),
                themeIds: without(project.themeIds),
                tokenIds: without(project.tokenIds),
                stateVariableIds: without(project.stateVariableIds),
                interactionIds: without(project.interactionIds),
              } as CatalogEntry,
            });
          }
        }
      }
      if (!ops.length) continue;
      let expected = true;
      try {
        createCatalogGraph({ ...document, entries }, library());
      } catch {
        expected = false;
      }
      let actual = true;
      try {
        applyCatalogTransaction(graph, request(graph, ops));
      } catch {
        actual = false;
      }
      if (actual !== expected)
        throw new Error(
          `round ${round}: local=${actual} full=${expected} ops=${JSON.stringify(
            ops.map((op) =>
              op.kind === "put"
                ? {
                    put: op.entry.id,
                    children: (op.entry as NodeEntry).children,
                  }
                : op,
            ),
          )}`,
        );
      outcomes[actual ? "accepted" : "rejected"]++;
    }
    // Both verdicts must actually occur, or the oracle proves nothing.
    expect(outcomes.accepted).toBeGreaterThan(50);
    expect(outcomes.rejected).toBeGreaterThan(50);
  });
});
