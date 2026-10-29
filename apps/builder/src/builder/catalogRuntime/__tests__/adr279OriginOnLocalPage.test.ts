import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogValidationError } from "../../../../../../packages/shared/src/catalog/document/validation";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import {
  duplicateNodes,
  insertNodes,
  moveNodes,
  removeTargets,
  renameDefinition,
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogComponentCommands,
  catalogComponentRole,
} from "../componentActions";
import {
  confirmCatalogDissolve,
  promptCatalogComponentName,
  watchCatalogComponentEdits,
} from "../componentConfirm";
import { catalogProjectComponentCardFrames } from "../componentsPage";
import { catalogCanvasMenuItems } from "../canvasMenu";
import { CatalogLayerTreeStore } from "../layerTree";
import {
  COMPONENTS_VIEW,
  PROJECT_COMPONENTS_VIEW,
  projectComponentCardId,
  componentPageNodeId,
  PROJECT_ORIGIN_VIEW_NODE,
  projectComponentOriginCellId,
} from "../originView";
import { catalogMenuHost } from "../shortcuts";
import {
  requestComponentName,
  resolveComponentNameRequest,
  subscribeComponentNameRequest,
} from "../../utils/componentNamePrompt";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-279 — the Local page (project components page) is where a component's origin lives and is
 * edited: the card's ◆ cell draws the template root itself, and every edit a page node takes
 * (children · order · sizing · breakpoint layer · fill) goes through; deleting the root or moving
 * it out of its card is refused (R1 · G0 (b) · G2).
 */
const PROJECT = "project:project:adr279" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const set = <V>(value: V) => ({ kind: "set" as const, value });
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-279" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr279-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("card", "lib:definition:type-frame", [id("title")]),
        {
          ...node("title", "lib:definition:text"),
          props: { children: set("Hello") },
        },
      ],
      rootIds: [id("card")],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  // Create component: the definition owns the card, an instance stands in its place (Decision 2).
  const created = workspace.execute(
    catalogComponentCommands.create(id("card"), "Card", workspace.newId),
  );
  const instance = created.plan.selectAfter![0]!;
  const definitionId = graph.ownerOf(id("card"))! as EntryId<"definition">;
  expect(graph.getEntry(definitionId)?.kind).toBe("definition");
  const copy = workspace.execute(
    duplicateNodes({ ids: [instance], newId: workspace.newId }),
  ).plan.selectAfter![0]!;
  workspace.showDefinition(PROJECT_COMPONENTS_VIEW);
  return { workspace, graph, definitionId, instance, copy };
}

/** The outcome of a command: ACCEPTED, or the refusal's code / error name. */
const attempt = (action: () => unknown): string => {
  try {
    action();
  } catch (error) {
    if (error instanceof CatalogValidationError) return error.code;
    return (error as Error).name;
  }
  return "ACCEPTED";
};

describe("ADR-279 Decision 4 — the Local page card is where the origin is edited", () => {
  it("takes every edit a page node takes; the instances follow", async () => {
    const { workspace, graph, instance, copy } = await open();
    const card = () => graph.getEntry(id("card")) as NodeEntry;
    const drawn = (nodeId: NodeId) =>
      workspace.root.recordsOfSource(nodeId).length;
    const instanceShows = (needle: string) =>
      [instance, copy].every((at) =>
        JSON.stringify(resolveCatalogNode(graph, at)).includes(needle),
      );
    // The ◆ cell draws the template root itself (the page instances are not drawn here).
    expect(drawn(id("card"))).toBe(1);
    expect(drawn(instance)).toBe(0);
    // 1. a child added (the palette's Button into the root)
    expect(
      attempt(() =>
        workspace.execute(
          insertNodes({
            parent: { kind: "node", id: id("card") },
            entries: [node("btn", "lib:definition:origin-component-button")],
            rootIds: [id("btn")],
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("ACCEPTED");
    expect(card().children).toEqual([id("title"), id("btn")]);
    expect(drawn(id("btn"))).toBe(1);
    expect(instanceShows("origin-component-button")).toBe(true);
    // 2. children reordered
    expect(
      attempt(() =>
        workspace.execute(
          moveNodes({
            ids: [id("btn")],
            parent: { kind: "node", id: id("card") },
            index: 0,
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("ACCEPTED");
    expect(card().children).toEqual([id("btn"), id("title")]);
    // 3. a child deleted
    expect(
      attempt(() =>
        workspace.execute(
          removeTargets({ targets: [{ kind: "node", id: id("title") }] }),
        ),
      ),
    ).toBe("ACCEPTED");
    expect(card().children).toEqual([id("btn")]);
    expect(instanceShows("Hello")).toBe(false);
    // 4. the root's sizing
    expect(
      attempt(() =>
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: id("card") }],
            sizing: { width: set(320) },
          }),
        ),
      ),
    ).toBe("ACCEPTED");
    expect(card().sizing.width).toEqual(set(320));
    // 5. a breakpoint layer
    expect(
      attempt(() =>
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: id("card") }],
            breakpoint: "mobile",
            layout: { rowGap: set("8px") },
          }),
        ),
      ),
    ).toBe("ACCEPTED");
    expect(card().responsive?.mobile?.layout?.rowGap).toEqual(set("8px"));
    // 6. a fill
    expect(
      attempt(() =>
        workspace.execute(
          setWholeField({
            targets: [{ kind: "node", id: id("card") }],
            field: "fills",
            value: [
              {
                kind: "color",
                id: "f1",
                enabled: true,
                opacity: 1,
                blendMode: "normal",
                color: "#ff0000ff",
              },
            ],
          }),
        ),
      ),
    ).toBe("ACCEPTED");
    expect(card().fills).toHaveLength(1);
    expect(resolveCatalogNode(graph, instance).children[0]?.fills).toHaveLength(
      1,
    );
    // (7. slot contents: the shared fixture (a) — a Picker's own list item — and the live Dialog
    // flow of G3.)
    workspace.dispose();
  });

  it("refuses deleting the root, moving it out of its card, and dropping into the card's frames", async () => {
    const { workspace, graph, definitionId } = await open();
    expect(
      attempt(() =>
        workspace.execute(
          removeTargets({ targets: [{ kind: "node", id: id("card") }] }),
        ),
      ),
    ).not.toBe("ACCEPTED");
    expect(graph.getEntry(id("card"))?.kind).toBe("node");
    expect(
      attempt(() =>
        workspace.execute(
          moveNodes({
            ids: [id("card")],
            parent: { kind: "node", id: BODY },
            newId: workspace.newId,
          }),
        ),
      ),
    ).not.toBe("ACCEPTED");
    expect(graph.ownerOf(id("card"))).toBe(definitionId);
    expect(
      attempt(() =>
        workspace.execute(
          insertNodes({
            parent: { kind: "node", id: projectComponentCardId(definitionId) },
            entries: [node("stray", "lib:definition:text")],
            rootIds: [id("stray")],
            newId: workspace.newId,
          }),
        ),
      ),
    ).not.toBe("ACCEPTED");
    expect(graph.getEntry(id("stray"))).toBeUndefined();
    workspace.dispose();
  });
});

describe("ADR-279 Decision 3a — Create component asks for the name", () => {
  it("no host: the default name at once; a host: Enter = the typed name, Escape = no step", async () => {
    const ran: string[] = [];
    expect(promptCatalogComponentName("Card", (name) => ran.push(name))).toBe(
      "Card",
    );
    expect(ran).toEqual(["Card"]);
    // A host answers the request (the dialog): the typed name, trimmed; empty = cancel.
    const seen: (string | null)[] = [];
    const stop = subscribeComponentNameRequest((request) =>
      seen.push(request?.defaultName ?? null),
    );
    const typed = promptCatalogComponentName("Card", (name) => ran.push(name));
    expect(typed).toBeInstanceOf(Promise);
    resolveComponentNameRequest("  Promo card ");
    expect(await typed).toBe("Promo card");
    expect(ran).toEqual(["Card", "Promo card"]);
    const cancelled = promptCatalogComponentName("Card", (name) =>
      ran.push(name),
    );
    resolveComponentNameRequest(null);
    expect(await cancelled).toBeNull();
    const empty = requestComponentName({ defaultName: "Card" });
    resolveComponentNameRequest("   ");
    expect(await empty).toBeNull();
    expect(ran).toEqual(["Card", "Promo card"]);
    expect(seen).toEqual([null, "Card", null, "Card", null, "Card", null]);
    stop();
  });

  it("the Canvas menu's Create component takes the dialog's name", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-279" }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr279-name-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node("box", "lib:definition:type-frame")],
        rootIds: [id("box")],
        newId: workspace.newId,
      }),
    );
    const graph = workspace.runtime.graph;
    const record = workspace.root.recordsOfSource(id("box"))[0]!;
    workspace.selectRecords([record]);
    const stop = subscribeComponentNameRequest(() => {});
    const item = catalogCanvasMenuItems(
      catalogMenuHost(workspace),
      "canvas-element",
      record,
    ).find((entry) => entry.id === "toggle-component-origin");
    expect(item).toMatchObject({ labelKey: "componentAction.createComponent" });
    if (item?.kind === "action") void item.run();
    const before = graph.revision;
    resolveComponentNameRequest("Hero");
    await flush();
    expect(graph.revision).toBe(before + 1);
    const project = graph.getEntry(graph.projectId);
    const definition =
      project?.kind === "project"
        ? graph.getEntry(project.definitionIds[0]!)
        : undefined;
    expect(definition).toMatchObject({ kind: "definition", name: "Hero" });
    expect(graph.ownerOf(id("box"))).toBe(
      definition?.kind === "definition" ? definition.id : "",
    );
    stop();
    workspace.dispose();
  });
});

type CatalogLayerNodeLike = ReturnType<
  CatalogLayerTreeStore["getSnapshot"]
>[number];

describe("ADR-279 Decision 3b · 6 · 7 — the Local page card: header, rename, delete, duplicate", () => {
  it("the Local page's cards have header frames (the component's name) and the Library page none", async () => {
    const { workspace, graph, definitionId } = await open();
    const frames = catalogProjectComponentCardFrames(graph, workspace.root);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toMatchObject({ id: definitionId, title: "Card" });
    expect(frames[0]!.width).toBeGreaterThan(0);
    expect(frames[0]!.height).toBeGreaterThan(0);
    // The ◆ root is the origin, its instance an instance (Canvas chrome · Layers).
    expect(catalogComponentRole(graph, id("card"))).toBe("origin");
    const pageRoot = workspace.readModel.definitionRows(
      PROJECT_COMPONENTS_VIEW,
    )[0]!;
    // The page is the project's (ADR-282 Phase 3): the component's card, its ◆ cell — which
    // draws the template root its definition owns, and stores only the reference.
    expect(pageRoot.target).toEqual({
      kind: "node",
      id: PROJECT_ORIGIN_VIEW_NODE,
    });
    expect(
      graph.storedEntry(
        componentPageNodeId(projectComponentCardId(definitionId)),
      ),
    ).toBeDefined();
    const cell = componentPageNodeId(
      projectComponentOriginCellId(definitionId),
    );
    expect((graph.getEntry(cell) as NodeEntry).children[0]).toBe(id("card"));
    expect((graph.storedEntry(cell) as NodeEntry).children).not.toContain(
      id("card"),
    );
    expect((graph.storedEntry(cell) as NodeEntry).originOf).toBe(definitionId);
    workspace.showDefinition(COMPONENTS_VIEW);
    expect(catalogProjectComponentCardFrames(graph, workspace.root)).toEqual(
      [],
    );
    workspace.showDefinition(undefined);
    expect(catalogProjectComponentCardFrames(graph, workspace.root)).toEqual(
      [],
    );
    workspace.dispose();
  });

  it("rename (the header's editor · the Component section's field) updates the card and the frames", async () => {
    const { workspace, graph, definitionId, instance } = await open();
    workspace.execute(
      renameDefinition({
        id: definitionId,
        name: "Promo card",
        label: "Rename component",
      }),
    );
    expect(
      catalogProjectComponentCardFrames(graph, workspace.root)[0],
    ).toMatchObject({ title: "Promo card" });
    const title = graph.getEntry(
      componentPageNodeId(
        `${projectComponentCardId(definitionId).slice(0, -"/card".length)}/title`,
      ),
    ) as NodeEntry;
    expect(JSON.stringify(title.props.children)).toContain("PROMO CARD");
    expect(catalogComponentRole(graph, instance)).toBe("instance");
    workspace.undo();
    expect(
      catalogProjectComponentCardFrames(graph, workspace.root)[0],
    ).toMatchObject({ title: "Card" });
    // A title the user wrote stays through a rename (the page's own title is its node's name —
    // no `NN.` number to tell it by since 2026-10-25).
    const titleId = title.id;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: titleId }],
        props: { children: set("My card") },
      }),
    );
    workspace.execute(
      renameDefinition({
        id: definitionId,
        name: "Hero card",
        label: "Rename component",
      }),
    );
    expect(
      JSON.stringify((graph.getEntry(titleId) as NodeEntry).props.children),
    ).toContain("My card");
    workspace.dispose();
  });

  it("⌘D on the ◆ root makes a new component 「Card copy」 with its own card", async () => {
    const { workspace, graph, definitionId } = await open();
    const record = workspace.root.recordsOfSource(id("card"))[0]!;
    workspace.selectRecords([record]);
    const item = catalogCanvasMenuItems(
      catalogMenuHost(workspace),
      "canvas-element",
      record,
    ).find((entry) => entry.id === "duplicate");
    expect(item?.kind).toBe("action");
    if (item?.kind === "action") void item.run();
    const project = graph.getEntry(graph.projectId);
    const ids = project?.kind === "project" ? project.definitionIds : [];
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(definitionId);
    const copy = graph.getEntry(ids[1]!);
    expect(copy).toMatchObject({ kind: "definition", name: "Card copy" });
    const copyRoot =
      copy?.kind === "definition" ? copy.templateRootId! : ("" as NodeId);
    expect(graph.ownerOf(copyRoot)).toBe(ids[1]);
    expect(workspace.root.recordsOfSource(copyRoot)).toHaveLength(1);
    expect(
      catalogProjectComponentCardFrames(graph, workspace.root).map(
        (frame) => frame.title,
      ),
    ).toEqual(["Card", "Card copy"]);
    // The copy's instances are none; the original keeps its own.
    expect(graph.instancesOf(ids[1]!).size).toBe(0);
    workspace.undo();
    const after = graph.getEntry(graph.projectId);
    expect(after?.kind === "project" ? after.definitionIds : []).toEqual([
      definitionId,
    ]);
    workspace.dispose();
  });

  it("the card's × asks (2 instances) and deletes the component: the instances stay as ordinary nodes, undo brings it back", async () => {
    const { workspace, graph, definitionId, instance, copy } = await open();
    const asked: number[] = [];
    let answer = false;
    const confirm = {
      detach: async () => true,
      impact: async (request: { instanceCount: number }) => {
        asked.push(request.instanceCount);
        return answer;
      },
    };
    const run = () =>
      workspace.execute(
        catalogComponentCommands.dissolve(definitionId, workspace.newId),
      );
    expect(
      await confirmCatalogDissolve(graph, definitionId, run, confirm),
    ).toBe(false);
    expect(graph.getEntry(definitionId)?.kind).toBe("definition");
    answer = true;
    expect(
      await confirmCatalogDissolve(graph, definitionId, run, confirm),
    ).toBe(true);
    expect(asked).toEqual([2, 2]);
    expect(graph.getEntry(definitionId)).toBeUndefined();
    expect(graph.getEntry(id("card"))).toBeUndefined();
    for (const at of [instance, copy])
      expect(graph.getEntry(at)).toMatchObject({
        kind: "node",
        definitionId: "lib:definition:type-frame",
      });
    expect(catalogProjectComponentCardFrames(graph, workspace.root)).toEqual(
      [],
    );
    workspace.undo();
    expect(graph.getEntry(definitionId)?.kind).toBe("definition");
    expect(graph.ownerOf(id("card"))).toBe(definitionId);
    expect(
      catalogProjectComponentCardFrames(graph, workspace.root),
    ).toHaveLength(1);
    workspace.dispose();
  });
});

describe("ADR-279 — Delete component while the Local page Layers list the card (user 2026-10-21)", () => {
  it("the Layers rebuild on the dissolve step does not read the deleted ◆ (the card's rows are read at the step's revision)", async () => {
    const { workspace, graph, definitionId } = await open();
    const layers = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
        subscribeRoot: (listener) => workspace.subscribeRoot(listener),
      },
      PROJECT_COMPONENTS_VIEW as never,
    );
    layers.connect();
    // Body → ◆ → its parts expanded, as the user had them.
    const expand = () => {
      const keys = new Set<string>();
      const walk = (rows: readonly { id: string; children?: unknown }[]) => {
        for (const row of rows) {
          keys.add(row.id);
          layers.setExpanded(new Set(keys));
          const built = layers.node(row.id);
          if (built?.children) walk(built.children);
        }
      };
      walk(layers.getSnapshot());
    };
    expand();
    // The page lists the component's card under the body, the card its ◆ (2026-10-22 — the
    // Library page's group rows).
    // (A page tree — body > card > ◆ cell > ◆, ADR-282 Phase 3.)
    const find = (
      rows: readonly CatalogLayerNodeLike[] | undefined,
    ): CatalogLayerNodeLike | undefined => {
      for (const row of rows ?? []) {
        if (
          row.position.target.kind === "node" &&
          row.position.target.id === id("card")
        )
          return row;
        const found = find(row.children);
        if (found) return found;
      }
      return undefined;
    };
    const originRow = find(layers.getSnapshot());
    expect(originRow?.role).toBe("origin");
    expect(originRow?.children?.map((row) => row.name)).toEqual(["Text"]);
    // Before: the step's listeners (Layers) threw CatalogValidationError DANGLING_CHILD project:node:card.
    expect(
      attempt(() =>
        workspace.execute(
          catalogComponentCommands.dissolve(definitionId, workspace.newId),
        ),
      ),
    ).toBe("ACCEPTED");
    expect(graph.getEntry(id("card"))).toBeUndefined();
    // The page follows: the component's card is gone with it — no ◆ row.
    expand();
    expect(find(layers.getSnapshot())).toBeUndefined();
    workspace.undo();
    expand();
    const back = find(layers.getSnapshot());
    expect([back?.name, back?.role]).toEqual(["frame", "origin"]);
    expect(back?.children?.map((row) => row.name)).toEqual(["Text"]);
    layers.dispose();
    workspace.dispose();
  });
});

describe("ADR-279 Decision 4 — the first edit of an origin with instances asks; Create component itself does not", () => {
  it("Create component (the instance made with it) asks nothing; the first edit of the ◆ asks once", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-279" }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr279-watch-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    const asked: number[] = [];
    const stop = watchCatalogComponentEdits(workspace, {
      detach: async () => true,
      impact: async (request) => {
        asked.push(request.instanceCount);
        return true;
      },
    });
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node("card", "lib:definition:type-frame", [id("title")]),
          {
            ...node("title", "lib:definition:text"),
            props: { children: set("Hello") },
          },
        ],
        rootIds: [id("card")],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      catalogComponentCommands.create(id("card"), "Card", workspace.newId),
    );
    await flush();
    expect(asked).toEqual([]);
    workspace.showDefinition(PROJECT_COMPONENTS_VIEW);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("title") }],
        props: { children: set("Edited") },
      }),
    );
    await flush();
    expect(asked).toEqual([1]);
    stop();
    workspace.dispose();
  });
});

describe("ADR-279 후속 — the Local page card draws an overlay component's body open (user 2026-10-22)", () => {
  const lib = (name: string) =>
    `lib:definition:origin-component-${name}` as NodeEntry["definitionId"];
  /** The records under `owner`'s first record whose type is `type`. */
  const recordsOf = (
    root: CatalogWorkspace["root"],
    owner: NodeId,
    type: string,
  ) => {
    const under = (id: string): string[] => [
      id,
      ...root.canvasInputs.get(id)!.children.flatMap(under),
    ];
    return root
      .recordsOfSource(owner)
      .flatMap(under)
      .map((id) => root.canvasInputs.get(id)!)
      .filter((record) => root.typeOf(record) === type);
  };
  async function openWith(name: string, nodeId: string) {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-279" }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr279-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [node(nodeId, lib(name))],
        rootIds: [id(nodeId)],
        newId: workspace.newId,
      }),
    );
    const instance = workspace.execute(
      catalogComponentCommands.create(id(nodeId), name, workspace.newId),
    ).plan.selectAfter![0]!;
    return { workspace, instance };
  }

  it("Dialog · Popover · Menu components: the ◆ root's Modal · Popover is shown with a box on the Local page; the page instance keeps it closed", async () => {
    for (const [name, type] of [
      ["dialog", "Modal"],
      ["popover", "Popover"],
      ["menu", "Popover"],
    ] as const) {
      const { workspace, instance } = await openWith(name, `${name}-origin`);
      // On the page: the instance's overlay is the closed one (ADR-278).
      const onPage = recordsOf(workspace.root, instance, type);
      expect(onPage.length, name).toBeGreaterThan(0);
      expect(
        onPage.every((record) => record.hidden === true),
        name,
      ).toBe(true);
      // On the Local page (its own root): the origin's body is open — a box the user edits.
      workspace.showDefinition(PROJECT_COMPONENTS_VIEW);
      const root = workspace.root;
      const onCard = recordsOf(root, id(`${name}-origin`), type);
      expect(onCard.length, name).toBeGreaterThan(0);
      expect(
        onCard.every((record) => record.hidden !== true),
        name,
      ).toBe(true);
      const box = root.getGeometry([onCard[0]!.id]).get(onCard[0]!.id)!;
      expect(box.width, name).toBeGreaterThan(0);
      expect(box.height, name).toBeGreaterThan(0);
      workspace.dispose();
    }
  });

  it("the Modal has no padding of its own (RAC starter — user 2026-10-22): the Dialog sits at the Modal's edge", async () => {
    const { workspace } = await openWith("dialog", "dialog-origin");
    workspace.showDefinition(PROJECT_COMPONENTS_VIEW);
    const root = workspace.root;
    const modal = recordsOf(root, id("dialog-origin"), "Modal")[0]!;
    expect(modal.visual.paddingLeft ?? modal.visual.padding ?? 0).toBe(0);
    const dialog = recordsOf(root, id("dialog-origin"), "Dialog")[0]!;
    const box = root.getGeometry([dialog.id]).get(dialog.id)!;
    expect([box.x, box.y]).toEqual([0, 0]);
    workspace.dispose();
  });

  it("a picker component (Select) keeps its Popover closed on the Local page — its body is a part, not a slot", async () => {
    const { workspace } = await openWith("select", "select-origin");
    workspace.showDefinition(PROJECT_COMPONENTS_VIEW);
    const popovers = recordsOf(workspace.root, id("select-origin"), "Popover");
    expect(popovers.length).toBeGreaterThan(0);
    expect(popovers.every((record) => record.hidden === true)).toBe(true);
    workspace.dispose();
  });
});
