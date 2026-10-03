import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogFillLayer,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  copyNodes,
  insertNodes,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import { IndexedDBAdapter } from "../../../lib/db/indexedDB/adapter";
import { closeAssetDb } from "../../../lib/assets/assetDb";
import { runAssetGc } from "../../../lib/assets/assetGc";
import { readAssetBlob, storeAssetBytes } from "../../../lib/assets/assetStore";
import { collectCatalogDurableAssetRoots } from "../assetGc";
import { newCatalogProjectDocument } from "../project";
import { CatalogSnapshots } from "../snapshots";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e: the asset GC over the catalog storage — an image a live catalog project (or its
 * snapshot) shows is a root, a removed project's rows are not; the open workspace keeps what undo
 * or the clipboard can bring back.
 */
const BODY = "project:node:home-body" as NodeId;
const FRAME = "project:node:frame" as NodeId;
let adapter: IndexedDBAdapter;

beforeEach(async () => {
  (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  adapter = new IndexedDBAdapter();
  await adapter.init();
});
afterEach(async () => {
  await closeAssetDb();
  await adapter.close();
});

const image = (url: string): CatalogFillLayer => ({
  kind: "image",
  id: "fill",
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  url,
  mode: "fill",
});
async function asset(seed: number) {
  return storeAssetBytes(
    { bytes: new Uint8Array([seed, seed + 1, seed + 2]), mime: "image/png" },
    "tab-ended",
  );
}
/** A workspace over a new project; `saved` stores it first and saves each step right away. */
async function open(projectId: string, factory: IDBFactory, saved = false) {
  const library = await buildCodeCatalogLibrary();
  const document = newCatalogProjectDocument({
    projectId: projectId as EntryId<"project">,
    name: projectId,
  });
  const storage = new CatalogStorage(factory, `workspace-${Math.random()}`);
  if (saved) await storage.create(document, library);
  const workspace = new CatalogWorkspace(
    new CatalogGraph(document, library),
    storage,
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: saved ? (run) => run() : () => {},
    },
  );
  const frame: NodeEntry = {
    kind: "node",
    id: FRAME,
    definitionId: "lib:definition:type-frame" as NodeEntry["definitionId"],
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [frame],
      rootIds: [FRAME],
      newId: workspace.newId,
    }),
  );
  return { workspace, library };
}
const setFill = (workspace: CatalogWorkspace, url?: string) =>
  workspace.execute(
    setWholeField({
      targets: [{ kind: "node", id: FRAME }],
      field: "fills",
      value: url ? [image(url)] : undefined,
    }),
  );
const mentions = (roots: unknown[], ref: string) =>
  JSON.stringify(roots).includes(ref);
async function saved(workspace: CatalogWorkspace) {
  while (workspace.runtime.pendingCount > 0)
    await new Promise((resolve) => setTimeout(resolve, 5));
}

describe("ADR-248 4e asset GC roots", () => {
  it("roots are the live catalog projects' entries and their snapshots, not a removed project's", async () => {
    const factory = new IDBFactory();
    const storage = new CatalogStorage(factory);
    const kept = await open("project:project:kept", factory);
    setFill(kept.workspace, "asset:sha256-" + "a".repeat(64));
    await storage.create(
      kept.workspace.runtime.graph.exportDocument(),
      kept.library,
    );
    setFill(kept.workspace, "asset:sha256-" + "b".repeat(64));
    await new CatalogSnapshots("project:project:kept", factory).create(
      kept.workspace.runtime.graph.exportDocument(),
      { kind: "user" },
    );
    const gone = await open("project:project:gone", factory);
    setFill(gone.workspace, "asset:sha256-" + "c".repeat(64));
    const goneDocument = gone.workspace.runtime.graph.exportDocument();
    await storage.create(goneDocument, gone.library);
    await new CatalogSnapshots("project:project:gone", factory).create(
      goneDocument,
      { kind: "user" },
    );
    await storage.remove(goneDocument.projectId);

    const roots = await collectCatalogDurableAssetRoots(factory);
    expect(mentions(roots, "a".repeat(64))).toBe(true);
    expect(mentions(roots, "b".repeat(64))).toBe(true);
    expect(mentions(roots, "c".repeat(64))).toBe(false);
    kept.workspace.dispose();
    gone.workspace.dispose();
  });

  it("the open workspace keeps an image its undo, unsaved commits or clipboard can bring back", async () => {
    const { workspace } = await open(
      "project:project:memory",
      new IDBFactory(),
      true,
    );
    // An unsaved commit carries the image even after the history is cleared.
    const queued = "asset:sha256-" + "f".repeat(64);
    setFill(workspace, queued);
    setFill(workspace);
    workspace.runtime.clearHistory();
    expect(workspace.runtime.pendingCount).toBeGreaterThan(0);
    expect(mentions(workspace.assetRootPayloads(), queued)).toBe(true);
    await saved(workspace);
    expect(mentions(workspace.assetRootPayloads(), queued)).toBe(false);

    // Saved and removed from the document: the undo entry keeps it until the history is cleared.
    const undone = "asset:sha256-" + "d".repeat(64);
    setFill(workspace, undone);
    setFill(workspace);
    await saved(workspace);
    expect(
      JSON.stringify(workspace.runtime.graph.exportDocument()).includes(undone),
    ).toBe(false);
    expect(mentions(workspace.assetRootPayloads(), undone)).toBe(true);
    workspace.runtime.clearHistory();
    expect(mentions(workspace.assetRootPayloads(), undone)).toBe(false);

    const copied = "asset:sha256-" + "e".repeat(64);
    setFill(workspace, copied);
    workspace.clipboard = copyNodes(workspace.runtime.graph, [FRAME]);
    setFill(workspace);
    await saved(workspace);
    workspace.runtime.clearHistory();
    expect(mentions(workspace.assetRootPayloads(), copied)).toBe(true);
    workspace.dispose();
  });

  it("the GC keeps an asset only a catalog project references and removes an unreferenced one", async () => {
    const factory = new IDBFactory();
    const used = await asset(1);
    const unused = await asset(2);
    const { workspace, library } = await open("project:project:gc", factory);
    setFill(workspace, used.ref);
    await new CatalogStorage(factory).create(
      workspace.runtime.graph.exportDocument(),
      library,
    );
    workspace.dispose();
    const gc = () =>
      runAssetGc({
        roots: {
          durable: () => collectCatalogDurableAssetRoots(factory),
          memory: () => [],
        },
        graceMs: 0,
        sessionId: "tab-self",
        liveSessions: async () => new Set(["tab-self"]),
      });
    await gc();
    const second = await gc();
    expect(second.deleted).toEqual([unused.hash]);
    expect(await readAssetBlob(used.ref)).not.toBeNull();
  });
});
