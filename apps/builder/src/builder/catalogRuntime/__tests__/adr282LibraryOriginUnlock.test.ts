import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogDocument,
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { resolveCatalogClickRecord } from "../canvasPick";
import { CatalogLayerTreeStore } from "../layerTree";
import { catalogComponentState } from "../componentActions";
import {
  CatalogOriginEditError,
  componentPageNodeId,
  COMPONENTS_VIEW,
  originCardId,
  originSampleId,
} from "../originView";
import {
  catalogOriginResetRequest,
  catalogOverriddenOrigins,
  confirmCatalogOriginReset,
} from "../originUnlock";
import { notifyEditRefusal, notifyOperationRefused } from "../operationNotice";
import {
  LIBRARY_COMPONENT_PAGE,
  projectInstancesOf,
} from "../../../../../../packages/shared/src/catalog/document/componentPages";
import { newCatalogProjectDocument } from "../project";
import { useToastStore } from "../../stores/toast";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-282 Phase 2 — the Library page's lock (user 2026-10-24 「Library 전체 해제」): the row toggle
 * unlocks the whole Library — every card's ◆ is its origin's copy root (an owned node — every edit
 * command works on it, Decision 3), the instances on the page and in other origins' parts follow
 * (결정 3-a) — and locks it again (copies nobody edited go back to the library; a locked copy takes
 * no edit). The row's reset (결정 2-a) asks first and takes the origins back to the library default.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const PICK = "project:node:pick" as NodeId;
const BUTTON = "lib:definition:origin-component-button" as LibraryDefinitionId;
const SELECT = "lib:definition:origin-component-select" as LibraryDefinitionId;
const MENU_ITEM =
  "lib:definition:origin-component-menu-item-default" as LibraryDefinitionId;

const PROJECT = "project:project:adr282" as EntryId<"project">;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const storage = new CatalogStorage(indexedDB, `adr282-${Math.random()}`);
  const workspaceOptions = {
    engine: await nodeLayoutEngine(),
    viewport: { width: 1920, height: 1080 },
    autosaveSchedule: () => {},
  };
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-282" }),
      library,
    ),
    storage,
    workspaceOptions,
  );
  // (The storage holds the project from its first revision — a round trip saves the steps.)
  await storage.create(workspace.runtime.graph.exportDocument(), library);
  for (const [id, definitionId] of [
    [PLACED, BUTTON],
    [PICK, SELECT],
  ] as const)
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id,
            definitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [id],
        newId: workspace.newId,
      }),
    );
  /** The project opened again from the storage (a reload). */
  const reopen = async () =>
    new CatalogWorkspace(
      new CatalogGraph(await storage.load(PROJECT, library), library),
      storage,
      workspaceOptions,
    );
  return { workspace, reopen, storage, library };
}
const texts = (workspace: CatalogWorkspace, id: NodeId): string[] => {
  const out: string[] = [];
  const walk = (record: ReturnType<typeof resolveCatalogNode>) => {
    if (typeof record.props.children === "string")
      out.push(record.props.children);
    record.children.forEach(walk);
  };
  walk(resolveCatalogNode(workspace.runtime.graph, id));
  return out;
};

describe("ADR-282 Phase 2 — the Library page's lock", () => {
  it("RED-1 · G3: locked, a ◆ refuses a child; unlocked, every ◆ is its copy root and a child reaches the instances; locked again, the edited copy stays and takes no edit", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.showDefinition(BUTTON);
    const sample = originSampleId(BUTTON);
    const text = (id: string) => ({
      kind: "node" as const,
      id: `project:node:${id}` as NodeId,
      definitionId: "lib:definition:text" as never,
      children: [],
      props: { children: { kind: "set" as const, value: "NEW" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    // Locked (the default): the ◆ is a view sample — a child is refused (root props · styles only).
    expect(workspace.isLibraryUnlocked).toBe(false);
    expect(() =>
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: sample },
          entries: [text("locked")],
          rootIds: [text("locked").id],
          newId: workspace.newId,
        }),
      ),
    ).toThrow(new CatalogOriginEditError("LIBRARY_LOCKED"));
    // The ◆ cell's rows are read (a click on the sample) before the unlock …
    expect(
      workspace.itemOfRecord(workspace.itemsOfNode(sample, 1)[0]!.identity),
    ).toBeDefined();
    // The row toggle: the whole Library, nothing to select first (user 2026-10-24).
    workspace.setLibraryUnlocked(true);
    expect(workspace.isLibraryUnlocked).toBe(true);
    expect(workspace.history.getSnapshot().labels.at(-1)).toBe(
      "Unlock library",
    );
    const root = graph.getDefinitionOverride(BUTTON)!.templateRootId!;
    expect(graph.getDefinitionOverride(SELECT)?.templateRootId).toBeTruthy();
    // The page was laid out again: the card's origin cell draws the copy root (its own record).
    expect(workspace.libraryOriginItems(root)).toHaveLength(1);
    expect(workspace.itemsOfNode(sample, 1)).toHaveLength(0);
    // 「Go to origin」 selects the copy root.
    workspace.showDefinition(undefined);
    workspace.showDefinition(BUTTON);
    expect(workspace.session.getSnapshot().selection).toEqual(
      workspace.libraryOriginItems(root),
    );
    // The card's ◆ draws the copy root with the origin's defaults bound (not 「{label}」).
    expect(texts(workspace, root)).toEqual(["Button"]);
    // An item ◆ (the Menu card's MenuItem — its label is its holder's prop) shows its sample's
    // 「Item」, not 「{label}」.
    const itemRoot = graph.getDefinitionOverride(MENU_ITEM)!.templateRootId!;
    expect(workspace.libraryOriginItems(itemRoot)).toHaveLength(1);
    // (`{shortcut}` · `{description}` are empty — `presentWhen: nonEmptyText` drops them.)
    expect(texts(workspace, itemRoot).filter(Boolean)).toEqual(["Item"]);
    // A Canvas click on the ◆ (its label text) picks the copy root, as it picked the sample.
    const records = workspace.root.domInputs;
    const rootRecord = workspace.libraryOriginItems(root)[0]!.identity;
    const label = [...records.values()].find(
      (record) => record.parentId === rootRecord,
    )!;
    expect(resolveCatalogClickRecord(records, label.id, undefined)).toBe(
      rootRecord,
    );
    // … and the click selects it: the cell's cached rows follow the copy root (not the sample).
    workspace.selectRecords([rootRecord]);
    expect(workspace.session.getSnapshot().selection).toEqual(
      workspace.libraryOriginItems(root),
    );
    // Component section: the ◆ is the origin, unlocked (its defaults are its override's).
    expect(catalogComponentState(graph, root, COMPONENTS_VIEW)).toMatchObject({
      originOf: { definitionId: BUTTON, project: false },
      unlocked: true,
    });
    // Layers (ADR-282 Phase 3 — the stored Library is a page): body > card > Origin line > ◆, the
    // copy root's row is the origin, without a delete button.
    const store = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      COMPONENTS_VIEW,
    );
    const path = rootRecord.split("::")[0]!.split("/");
    store.setExpanded(
      new Set(path.map((id, at) => `${path.slice(0, at + 1).join("/")}::${id}`)),
    );
    const rowOf = (
      rows: ReturnType<typeof store.getSnapshot>,
    ): (typeof rows)[number] | undefined => {
      for (const row of rows) {
        if (row.id === rootRecord) return row;
        const found = rowOf(row.children ?? []);
        if (found) return found;
      }
      return undefined;
    };
    const originRow = rowOf(store.getSnapshot())!;
    expect(originRow.role).toBe("origin");
    expect(originRow.keptOrigin).toBe(true);
    // A child on the ◆ reaches the placed Button and the Select's Button part.
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: root },
        entries: [text("new")],
        rootIds: [text("new").id],
        newId: workspace.newId,
      }),
    );
    expect(texts(workspace, PLACED)).toContain("NEW");
    expect(texts(workspace, PICK)).toContain("NEW");
    // The copy root itself is not deleted (its reset is the row's) — the notice says it is the
    // origin (not a list's item template).
    let fixed: unknown;
    try {
      workspace.execute(
        removeTargets({
          targets: [{ kind: "node", id: root }],
          newId: workspace.newId,
        }),
      );
    } catch (error) {
      fixed = error;
    }
    expect(fixed).toMatchObject({ code: "TEMPLATE_ROOT_FIXED" });
    notifyOperationRefused(fixed);
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      messageKey: "operation.originRootFixed",
    });
    // Lock: the copies nobody edited go back to the library; the Button's stays (edited).
    workspace.setLibraryUnlocked(false);
    expect(workspace.isLibraryUnlocked).toBe(false);
    expect(workspace.history.getSnapshot().labels.at(-1)).toBe("Lock library");
    expect(graph.getDefinitionOverride(BUTTON)?.templateRootId).toBe(root);
    expect(graph.getDefinitionOverride(SELECT)).toBeUndefined();
    expect(texts(workspace, PICK)).toContain("NEW");
    // Locked, the copy takes no edit — a refusal the user is told about (an info toast, not a
    // console error: the edit met the lock, nothing failed).
    let refusal: unknown;
    try {
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: root },
          entries: [text("again")],
          rootIds: [text("again").id],
          newId: workspace.newId,
        }),
      );
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(CatalogOriginEditError);
    expect((refusal as CatalogOriginEditError).code).toBe("LIBRARY_LOCKED");
    expect(notifyEditRefusal(refusal)).toBe(true);
    expect(useToastStore.getState().toasts.at(-1)).toMatchObject({
      type: "info",
      messageKey: "operation.libraryLocked",
    });
    expect(notifyEditRefusal(new Error("other"))).toBe(false);
    workspace.dispose();
  });

  it("the row's reset asks first (origins · instances · contents that go), takes the origins back and locks", async () => {
    const { workspace } = await open();
    const graph = workspace.runtime.graph;
    workspace.showDefinition(BUTTON);
    workspace.setLibraryUnlocked(true);
    expect(catalogOverriddenOrigins(graph).length).toBeGreaterThan(50);
    expect(catalogOriginResetRequest(graph, [BUTTON])).toEqual({
      originCount: 1,
      // (The project's own instances — not the Library page's showcase ◇.)
      instanceCount: projectInstancesOf(graph, BUTTON).length,
      lostInstanceCount: 0,
      lostNodeCount: 0,
    });
    const run = (command: Parameters<typeof workspace.execute>[0]) =>
      workspace.execute(command);
    // Cancel: nothing runs.
    expect(
      await confirmCatalogOriginReset(graph, run, undefined, async () => false),
    ).toBe(false);
    expect(graph.getDefinitionOverride(BUTTON)?.templateRootId).toBeTruthy();
    expect(
      await confirmCatalogOriginReset(graph, run, undefined, async () => true),
    ).toBe(true);
    expect(catalogOverriddenOrigins(graph)).toEqual([]);
    expect(workspace.history.getSnapshot().labels.at(-1)).toBe("Reset origins");
    expect(workspace.isLibraryUnlocked).toBe(false);
    // The card's ◆ is the library sample again.
    expect(workspace.itemsOfNode(originSampleId(BUTTON), 1)).toHaveLength(1);
    // ⌘Z: the copies back, drawn on the cards.
    workspace.undo();
    const root = graph.getDefinitionOverride(BUTTON)!.templateRootId!;
    expect(workspace.libraryOriginItems(root)).toHaveLength(1);
    workspace.dispose();
  });

  it("the Library opens locked: the copies a session left unlocked and nobody edited go back (saved, no history entry)", async () => {
    const { workspace, reopen, storage, library } = await open();
    workspace.showDefinition(BUTTON);
    workspace.setLibraryUnlocked(true);
    const root = workspace.runtime.graph.getDefinitionOverride(BUTTON)!
      .templateRootId!;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: root },
        entries: [
          {
            kind: "node",
            id: "project:node:kept" as NodeId,
            definitionId: "lib:definition:text" as never,
            children: [],
            props: { children: { kind: "set", value: "KEPT" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: ["project:node:kept" as NodeId],
        newId: workspace.newId,
      }),
    );
    // A reload while unlocked: every copy is in the storage.
    await workspace.runtime.save();
    workspace.dispose();
    expect(
      catalogOverriddenOrigins(
        new CatalogGraph(await storage.load(PROJECT, library), library),
      ).length,
    ).toBeGreaterThan(50);
    const reopened = await reopen();
    expect(reopened.isLibraryUnlocked).toBe(false);
    expect(catalogOverriddenOrigins(reopened.runtime.graph)).toEqual([BUTTON]);
    expect(texts(reopened, PLACED)).toContain("KEPT");
    expect(reopened.history.getSnapshot().labels).toEqual([]);
    // The prune is saved: the next open finds only the edited copy.
    await reopened.runtime.save();
    reopened.dispose();
    expect(
      catalogOverriddenOrigins(
        new CatalogGraph(await storage.load(PROJECT, library), library),
      ),
    ).toEqual([BUTTON]);
  });

  it("Phase 3 · G6: the Library is the project's page — made on the first open (no history entry), its ◆ cells draw the origin but never store it, Preview never sees the page, a reopen keeps it", async () => {
    const { workspace, reopen, storage, library } = await open();
    const graph = workspace.runtime.graph;
    const posts: { type: string; document?: CatalogDocument; changed?: { id: string }[] }[] = [];
    const preview = workspace.attachPreview({
      post: (message) => posts.push(message as (typeof posts)[number]),
    });
    preview.onReady();
    workspace.showDefinition(BUTTON);
    // Made on the first open: a component page, not a route; no history entry.
    const project = graph.getEntry(graph.projectId) as ProjectEntry;
    expect(project.componentPageIds).toEqual([LIBRARY_COMPONENT_PAGE]);
    expect(project.pageIds).not.toContain(LIBRARY_COMPONENT_PAGE);
    expect(workspace.history.getSnapshot().labels).toEqual(["Insert", "Insert"]);
    // The Origin line draws the origin's sample first; the document keeps its other cells.
    const cell = componentPageNodeId(
      `${originCardId(BUTTON).slice(0, -"/card".length)}/line/origin/1`,
    );
    const sample = originSampleId(BUTTON);
    expect((graph.getEntry(cell) as NodeEntry).children[0]).toBe(sample);
    expect((graph.storedEntry(cell) as NodeEntry).children).not.toContain(sample);
    expect((graph.storedEntry(cell) as NodeEntry).originOf).toBe(BUTTON);
    // Locked, the page takes no edit (user 2026-10-25 「잠금해제 하지 않아도 수정 가능하다」).
    expect(() =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: cell }],
          visual: { paddingTop: { kind: "set", value: 8 } },
        }),
      ),
    ).toThrow(CatalogOriginEditError);
    // Unlocked, the cell is a page frame: a layout edit, its undo while the view is closed, its
    // redo — none of them stores the drawn origin (the copy root, once unlocked).
    workspace.setLibraryUnlocked(true);
    const copyRoot = graph.getDefinitionOverride(BUTTON)!.templateRootId!;
    expect((graph.getEntry(cell) as NodeEntry).children[0]).toBe(copyRoot);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: cell }],
        visual: { paddingTop: { kind: "set", value: 8 } },
      }),
    );
    expect((graph.storedEntry(cell) as NodeEntry).children).not.toContain(copyRoot);
    workspace.showDefinition(undefined);
    workspace.undo();
    workspace.redo();
    expect((graph.storedEntry(cell) as NodeEntry).visual.paddingTop).toEqual({
      kind: "set",
      value: 8,
    });
    expect((graph.storedEntry(cell) as NodeEntry).children).not.toContain(copyRoot);
    // Preview: no component page in the snapshot or in a delta (nor the project's list of them).
    preview.onReady(); // (a new Preview document after the page was made)
    const snapshots = posts.filter((post) => post.type === "CATALOG_SNAPSHOT");
    expect(snapshots.length).toBeGreaterThan(0);
    for (const post of snapshots) {
      expect(post.document!.entries[LIBRARY_COMPONENT_PAGE]).toBeUndefined();
      expect(post.document!.entries[cell]).toBeUndefined();
    }
    const deltas = posts.filter((post) => post.type === "CATALOG_DELTA");
    for (const post of deltas)
      for (const entry of post.changed!) {
        expect(entry.id).not.toBe(cell);
        expect(entry.id).not.toBe(LIBRARY_COMPONENT_PAGE);
        if (entry.id === graph.projectId)
          expect(
            (entry as unknown as ProjectEntry).componentPageIds,
          ).toBeUndefined();
      }
    // An edit of the cell while the page is drawn saves the cell as stored — not with the origin
    // it draws (user 2026-10-25: saved with it, the project no longer opened —
    // `entry.children[0]`).
    workspace.showDefinition(BUTTON);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: cell }],
        visual: { paddingBottom: { kind: "set", value: 4 } },
      }),
    );
    // Saved and opened again: the page as it was (its edit kept), drawn from the document.
    await workspace.runtime.save();
    workspace.dispose();
    const loaded = new CatalogGraph(await storage.load(PROJECT, library), library);
    expect((loaded.storedEntry(cell) as NodeEntry).children).not.toContain(copyRoot);
    expect((loaded.storedEntry(cell) as NodeEntry).visual.paddingTop).toEqual({
      kind: "set",
      value: 8,
    });
    const reopened = await reopen();
    reopened.showDefinition(BUTTON);
    expect(reopened.history.getSnapshot().labels).toEqual([]);
    expect(reopened.itemsOfNode(sample, 1)).toHaveLength(1);
    reopened.dispose();
  });
});
