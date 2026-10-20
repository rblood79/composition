/**
 * ADR-260 — component commands with the origin in place (and the old owned shape).
 */
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../document/graph";
import type {
  CatalogDocument,
  CatalogEntry,
  DefinitionEntry,
  InstanceAddress,
  NodeEntry,
  NodeId,
  ProjectEntry,
  TokenEntry,
} from "../../document/types";
import { resolveCatalogNode } from "../../resolution/resolver";
import {
  createComponent,
  detachInstances,
  dissolveComponent,
  restoreOrigin,
} from "../components";
import {
  copyNodes,
  duplicateNodes,
  pasteNodes,
  removeTargets,
  type CatalogClipboard,
} from "../structure";
import {
  allocator,
  code,
  documentOf,
  graphOf,
  library,
  node,
  run,
  snapshot,
  undo,
  view,
} from "./fixture";

const DEF = "project:definition:comp" as const;
const ROOT = "project:node:root" as const;
const definition = (extra: Partial<DefinitionEntry> = {}): DefinitionEntry => ({
  kind: "definition",
  id: DEF,
  name: "Comp",
  mode: "composite",
  accepts: {},
  defaults: {},
  visual: {},
  stateRules: {},
  templateRootId: ROOT,
  ...extra,
});
/** The list position of a Picker node (`lib:definition:picker`). */
const pickerList = (owner: NodeId): InstanceAddress => ({
  instances: [owner],
  templatePath: ["lib:template:pickRoot", "lib:template:list"],
});
const item = (id: string, value: string) =>
  node(id, "lib:definition:item", {
    props: { children: { kind: "set", value } },
  });
/** A component whose origin is a Picker holding its own list item (placed slot contents). */
const component = (shape: Partial<DefinitionEntry>, onPage: boolean) => {
  const own = item("own", "Own item");
  const origin: NodeEntry = node("root", "lib:definition:picker", {
    descendantOverrides: [
      { kind: "fillSlot", address: pickerList(ROOT), childIds: [own.id] },
    ],
  });
  const instance = node("inst", DEF);
  return graphOf(
    [origin, own, instance],
    [...(onPage ? ["root"] : []), "inst"],
    [definition(shape)],
  );
};
const shapes = [
  ["referenced origin", { originRef: true }, true],
  ["owned template (old shape)", {}, false],
] as const;

describe("ADR-260 Decision 11 — detach materializes the origin's own slot contents", () => {
  it.each(shapes)(
    "detaches into owned copies of the template node's slot contents (%s)",
    (_, shape, onPage) => {
      const graph = component(shape, onPage);
      const instance = "project:node:inst" as NodeId;
      const before = view(resolveCatalogNode(graph, instance));
      expect(JSON.stringify(before)).toContain("Own item");
      const start = snapshot(graph);
      const { result } = run(
        graph,
        detachInstances({ ids: [instance], newId: allocator() }),
      );
      // (A project instance draws its template root inside it; the detached node is that root.)
      expect(view(resolveCatalogNode(graph, instance))).toEqual(
        (before as { children: unknown[] }).children[0],
      );
      const detached = graph.getEntry(instance) as NodeEntry;
      const fill = detached.descendantOverrides.find(
        (item) => item.kind === "fillSlot",
      );
      expect(fill?.kind).toBe("fillSlot");
      // The copy owns its own item; the origin's item stays the origin's.
      const copies = fill?.kind === "fillSlot" ? fill.childIds : [];
      expect(copies).not.toContain("project:node:own");
      expect(graph.ownerOf("project:node:own")).toBe(ROOT);
      expect(graph.ownerOf(copies[0])).toBe(instance);
      undo(graph, result.inverse);
      expect(snapshot(graph)).toBe(start);
    },
  );

  it("keeps only the instance's own list when it filled the same position", () => {
    const own = item("own", "Own item");
    const mine = item("mine", "Instance item");
    const instance = "project:node:inst" as NodeId;
    const graph = graphOf(
      [
        node("root", "lib:definition:picker", {
          descendantOverrides: [
            { kind: "fillSlot", address: pickerList(ROOT), childIds: [own.id] },
          ],
        }),
        own,
        mine,
        node("inst", DEF, {
          descendantOverrides: [
            {
              kind: "fillSlot",
              address: {
                instances: [instance, ROOT],
                templatePath: ["lib:template:pickRoot", "lib:template:list"],
              },
              childIds: [mine.id],
            },
          ],
        }),
      ],
      ["root", "inst"],
      [definition({ originRef: true })],
    );
    const before = JSON.stringify(view(resolveCatalogNode(graph, instance)));
    expect(before).toContain("Instance item");
    expect(before).not.toContain("Own item");
    run(graph, detachInstances({ ids: [instance], newId: allocator() }));
    const after = JSON.stringify(view(resolveCatalogNode(graph, instance)));
    expect(after).toContain("Instance item");
    expect(after).not.toContain("Own item");
    expect(graph.ownerOf(mine.id)).toBe(instance);
  });
});

const PAGE = "project:page:main" as const;
const pageChildren = (graph: ReturnType<typeof graphOf>) =>
  (graph.getEntry(PAGE) as { children: readonly string[] }).children;
const def = (graph: ReturnType<typeof graphOf>, id: string = DEF) =>
  graph.getEntry(id) as DefinitionEntry;

describe("ADR-260 Decision 2 · 5 — Create component keeps the node in place; Detach component keeps it", () => {
  it("makes the node the origin where it stands, its slot contents kept, in one undo step", () => {
    const own = item("own", "Own item");
    const graph = graphOf(
      [
        node("root", "lib:definition:picker", {
          descendantOverrides: [
            { kind: "fillSlot", address: pickerList(ROOT), childIds: [own.id] },
          ],
        }),
        own,
      ],
      ["root"],
    );
    const start = snapshot(graph);
    const newId = allocator();
    const { plan, result } = run(
      graph,
      createComponent({ id: ROOT, name: "Comp", newId }),
    );
    expect(plan.selectAfter).toEqual([ROOT]);
    expect(pageChildren(graph)).toEqual([ROOT]);
    expect(graph.ownerOf(ROOT)).toBe(PAGE);
    const created = graph.definitionOfTemplateRoot(ROOT)!;
    expect(def(graph, created)).toMatchObject({
      originRef: true,
      templateRootId: ROOT,
    });
    expect(JSON.stringify(view(resolveCatalogNode(graph, ROOT)))).toContain(
      "Own item",
    );
    expect(
      code(() => run(graph, createComponent({ id: ROOT, name: "X", newId }))),
    ).toBe("ALREADY_COMPONENT_ORIGIN");
    undo(graph, result.inverse);
    expect(snapshot(graph)).toBe(start);
  });

  it("dissolves into detached instances and leaves the origin an ordinary node", () => {
    const graph = component({ originRef: true }, true);
    const before = view(resolveCatalogNode(graph, "project:node:inst"));
    run(graph, dissolveComponent({ definitionId: DEF, newId: allocator() }));
    expect(graph.getEntry(DEF)).toBeUndefined();
    expect(pageChildren(graph)).toContain(ROOT);
    expect(graph.getEntry(ROOT)?.kind).toBe("node");
    expect(view(resolveCatalogNode(graph, "project:node:inst"))).toEqual(
      (before as { children: unknown[] }).children[0],
    );
  });
});

describe("ADR-260 Decision 6 — deleting the origin keeps the instances; Restore origin", () => {
  it("hides the origin in its definition and restores it beside the instance", () => {
    const graph = component({ originRef: true }, true);
    const instance = "project:node:inst" as NodeId;
    const shown = view(resolveCatalogNode(graph, instance));
    const start = snapshot(graph);
    const removal = run(
      graph,
      removeTargets({ targets: [{ kind: "node", id: ROOT }] }),
    );
    expect(pageChildren(graph)).toEqual([instance]);
    expect(def(graph).originRef).toBe(false);
    expect(graph.ownerOf(ROOT)).toBe(DEF);
    expect(view(resolveCatalogNode(graph, instance))).toEqual(shown);
    // (Restore only for a hidden origin.)
    const restore = run(graph, restoreOrigin({ instanceId: instance }));
    expect(restore.plan.selectAfter).toEqual([ROOT]);
    expect(pageChildren(graph)).toEqual([instance, ROOT]);
    expect(def(graph).originRef).toBe(true);
    expect(graph.ownerOf(ROOT)).toBe(PAGE);
    expect(
      code(() => run(graph, restoreOrigin({ instanceId: instance }))),
    ).toBe("ORIGIN_NOT_HIDDEN");
    undo(graph, restore.result.inverse);
    undo(graph, removal.result.inverse);
    expect(snapshot(graph)).toBe(start);
  });

  it("restores an absolutely placed instance's origin 10 px off it", () => {
    const graph = component({ originRef: true }, true);
    const instance = graph.getEntry("project:node:inst") as NodeEntry;
    run(graph, (reader) => ({
      label: "place",
      ops: [
        {
          kind: "put",
          entry: { ...instance, layout: { position: { kind: "set", value: "absolute" }, insetLeft: { kind: "set", value: "40px" }, insetTop: { kind: "set", value: "50px" } } },
        },
      ],
    }));
    run(graph, removeTargets({ targets: [{ kind: "node", id: ROOT }] }));
    run(graph, restoreOrigin({ instanceId: instance.id }));
    // ADR-275: the instance's position (layout insets), shifted 10.
    expect((graph.getEntry(ROOT) as NodeEntry).layout).toMatchObject({ position: { kind: "set", value: "absolute" }, insetLeft: { kind: "set", value: "50px" }, insetTop: { kind: "set", value: "60px" } });
  });

  it("moves only the outermost origin of a deleted subtree; the inner one stays referenced", () => {
    const INNER_DEF = "project:definition:inner" as const;
    const inner = node("inner", "lib:definition:badge");
    const frame = node("frame", "lib:definition:section", {
      children: [ROOT],
    });
    const origin = node("root", "lib:definition:section", {
      children: [inner.id],
    });
    const graph = graphOf(
      [frame, origin, inner, node("inst", DEF), node("innerInst", INNER_DEF)],
      ["frame", "inst", "innerInst"],
      [
        definition({ originRef: true }),
        definition({
          id: INNER_DEF,
          name: "Inner",
          templateRootId: inner.id,
          originRef: true,
        }),
      ],
    );
    run(graph, removeTargets({ targets: [{ kind: "node", id: frame.id }] }));
    expect(graph.getEntry(frame.id)).toBeUndefined();
    expect(def(graph).originRef).toBe(false);
    expect(def(graph, INNER_DEF).originRef).toBe(true);
    expect(graph.ownerOf(inner.id)).toBe(ROOT);
    // Restoring the outer origin brings the inner one back with it.
    run(graph, restoreOrigin({ instanceId: "project:node:inst" as NodeId }));
    expect(graph.ownerOf(inner.id)).toBe(ROOT);
    expect(graph.ownerOf(ROOT)).toBe(PAGE);
    // Deleting the inner origin alone hides it in its own definition.
    run(graph, removeTargets({ targets: [{ kind: "node", id: inner.id }] }));
    expect(def(graph, INNER_DEF).originRef).toBe(false);
    expect(graph.ownerOf(inner.id)).toBe(INNER_DEF);
  });
});

describe("ADR-260 Decision 8 — a copy of the origin is an instance (pen.dev)", () => {
  it("duplicates the origin as an instance, and an origin inside a duplicated frame too", () => {
    const frame = node("frame", "lib:definition:section", { children: [ROOT] });
    const graph = graphOf(
      [frame, node("root", "lib:definition:badge")],
      ["frame"],
      [definition({ originRef: true })],
    );
    const newId = allocator();
    const { plan } = run(graph, duplicateNodes({ ids: [ROOT], newId }));
    const copy = graph.getEntry(plan.selectAfter![0]) as NodeEntry;
    expect(copy.definitionId).toBe(DEF);
    expect(copy.children).toEqual([]);
    expect(graph.definitionOfTemplateRoot(copy.id)).toBeUndefined();
    const frameCopy = run(graph, duplicateNodes({ ids: [frame.id], newId }));
    const copiedFrame = graph.getEntry(
      frameCopy.plan.selectAfter![0],
    ) as NodeEntry;
    const inside = graph.getEntry(copiedFrame.children[0]) as NodeEntry;
    expect(inside.definitionId).toBe(DEF);
    // (The frame already held the first copy: origin copy + that instance copy + the first copy.)
    expect(graph.instancesOf(DEF).size).toBe(3);
  });
});

describe("ADR-260 Decision 13 — the clipboard knows origins, definitions and tokens", () => {
  const TOKEN = "project:token:brand" as const;
  const brand = (id: string = TOKEN, value = "#123456"): TokenEntry => ({
    kind: "token",
    id: id as TokenEntry["id"],
    name: "brand",
    tokenType: "color",
    value,
    source: "user-defined",
  });
  /** A document with tokens listed on the project (and another project id when given). */
  const withTokens = (
    document: CatalogDocument,
    tokens: readonly TokenEntry[],
    projectId?: string,
  ): CatalogDocument => {
    const project = document.entries[document.projectId] as ProjectEntry;
    const id = (projectId ?? document.projectId) as ProjectEntry["id"];
    const entries: Record<string, CatalogEntry> = { ...document.entries };
    delete entries[document.projectId];
    entries[id] = { ...project, id, tokenIds: tokens.map((token) => token.id) };
    for (const token of tokens) entries[token.id] = token;
    return { ...document, projectId: id, rootId: id, entries };
  };
  /** The source: a component (origin with its own item) whose origin paints with the brand token. */
  const sourceGraph = () => {
    const own = item("own", "Own item");
    const origin = node("root", "lib:definition:picker", {
      visual: {
        backgroundColor: {
          kind: "set",
          value: { kind: "token", tokenId: TOKEN },
        },
      },
      descendantOverrides: [
        { kind: "fillSlot", address: pickerList(ROOT), childIds: [own.id] },
      ],
    });
    return new CatalogGraph(
      withTokens(
        documentOf(
          [origin, own, node("inst", DEF)],
          ["root", "inst"],
          [definition({ originRef: true })],
        ),
        [brand()],
      ),
      library(),
    );
  };
  const targetGraph = (tokens: readonly TokenEntry[] = []) =>
    new CatalogGraph(
      withTokens(documentOf([], []), tokens, "project:project:other"),
      library(),
    );
  const paste = (graph: CatalogGraph, clipboard: CatalogClipboard) => {
    const newId = allocator();
    const { plan } = run(
      graph,
      pasteNodes({
        clipboard: JSON.parse(JSON.stringify(clipboard)),
        parent: { kind: "page", id: PAGE },
        newId: (kind) => `${newId(kind)}x` as never,
      }),
    );
    return graph.getEntry(plan.selectAfter![0]) as NodeEntry;
  };
  const projectDefinitions = (graph: CatalogGraph) =>
    Object.values(graph.exportDocument().entries).filter(
      (entry) =>
        entry.kind === "node" &&
        entry.definitionId.startsWith("project:definition:"),
    );

  it("pastes a copied origin as an instance in the same project (also after a round trip)", () => {
    const graph = sourceGraph();
    const clipboard = copyNodes(graph, [ROOT]);
    expect(clipboard.origins).toEqual({ [ROOT]: DEF });
    expect(paste(graph, clipboard).definitionId).toBe(DEF);
  });

  it("pastes the origin as an instance after the origin was deleted (hidden definition)", () => {
    const graph = sourceGraph();
    const clipboard = copyNodes(graph, [ROOT]);
    run(graph, removeTargets({ targets: [{ kind: "node", id: ROOT }] }));
    expect(paste(graph, clipboard).definitionId).toBe(DEF);
  });

  it("pastes ordinary nodes after the component was dissolved — the origin and its instances", () => {
    const graph = sourceGraph();
    const clipboard = copyNodes(graph, [ROOT, "project:node:inst" as NodeId]);
    run(graph, dissolveComponent({ definitionId: DEF, newId: allocator() }));
    const pasted = paste(graph, clipboard);
    expect(pasted.definitionId).toBe("lib:definition:picker");
    expect(projectDefinitions(graph)).toEqual([]);
  });

  it("pastes into another project as ordinary nodes, the instance materialized from the snapshot", () => {
    const source = sourceGraph();
    const clipboard = copyNodes(source, ["project:node:inst" as NodeId]);
    const target = targetGraph();
    const pasted = paste(target, clipboard);
    expect(pasted.definitionId).toBe("lib:definition:picker");
    expect(projectDefinitions(target)).toEqual([]);
    expect(
      JSON.stringify(view(resolveCatalogNode(target, pasted.id))),
    ).toContain("Own item");
    // The token the target lacks is fixed at its copied value.
    expect(pasted.visual.backgroundColor).toEqual({
      kind: "set",
      value: "#123456",
    });
  });

  it("maps a missing token to the target's token of the same name and type", () => {
    const target = targetGraph([brand("project:token:theirs", "#abcdef")]);
    const pasted = paste(target, copyNodes(sourceGraph(), [ROOT]));
    expect(pasted.definitionId).toBe("lib:definition:picker");
    expect(pasted.visual.backgroundColor).toEqual({
      kind: "set",
      value: { kind: "token", tokenId: "project:token:theirs" },
    });
  });

  it("materializes a nested definition dependency in another project", () => {
    const OUTER = "project:definition:outer" as const;
    const outerRoot = node("outerRoot", "lib:definition:section", {
      children: ["project:node:innerInst"],
    });
    const source = graphOf(
      [
        node("root", "lib:definition:badge"),
        outerRoot,
        node("innerInst", DEF),
        node("outerInst", OUTER),
      ],
      ["root", "outerRoot", "outerInst"],
      [
        definition({ originRef: true }),
        definition({
          id: OUTER,
          name: "Outer",
          templateRootId: outerRoot.id,
          originRef: true,
        }),
      ],
    );
    const clipboard = copyNodes(source, ["project:node:outerInst" as NodeId]);
    expect(
      clipboard.definitions?.filter((entry) => entry.kind === "definition")
        .length,
    ).toBe(2);
    const target = targetGraph();
    paste(target, clipboard);
    expect(projectDefinitions(target)).toEqual([]);
  });
});
