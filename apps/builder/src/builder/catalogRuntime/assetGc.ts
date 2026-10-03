import { CATALOG_SNAPSHOT_DB } from "./snapshots";
import { CATALOG_DB_NAME } from "./storage";

/**
 * ADR-248 4e: the asset GC (ADR-235 Phase 3) over the catalog storage. The old scheduler ran from
 * the old page manager only and its roots did not know the catalog databases, so with the catalog
 * Builder no GC ran: images a catalog project dropped stayed in the asset store. Here the GC runs
 * the same way (idle, once a day — the same last-run key) with the old durable roots (the old
 * projects' documents, data store, history, fonts) plus the catalog ones: the stored entries of
 * every live catalog project and the snapshot documents of live projects. Memory roots are the
 * open workspace's (documents, unsaved commits, undo/redo operations, the clipboard).
 * The GC module and the old root collector stay lazy.
 */
const LAST_RUN_KEY = "composition.asset-gc.last-run";
const RUN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** An existing database, read-only — a missing one is not created. */
function openExisting(
  factory: IDBFactory,
  name: string,
): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    const request = factory.open(name);
    request.onupgradeneeded = () => request.transaction?.abort();
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}
function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function readStore(
  db: IDBDatabase,
  store: string,
): Promise<{ keys: IDBValidKey[]; values: unknown[] }> {
  if (!db.objectStoreNames.contains(store)) return { keys: [], values: [] };
  const objects = db.transaction(store, "readonly").objectStore(store);
  const [keys, values] = await Promise.all([
    read(objects.getAllKeys()),
    read(objects.getAll()),
  ]);
  return { keys, values };
}

/**
 * The catalog durable roots: the stored entries and the snapshot documents of projects that have
 * a head (the dashboard removes a project's snapshots after the project; until then they are not
 * roots).
 */
export async function collectCatalogDurableAssetRoots(
  factory: IDBFactory = indexedDB,
): Promise<unknown[]> {
  const roots: unknown[] = [];
  const live = new Set<string>();
  const projects = await openExisting(factory, CATALOG_DB_NAME);
  if (projects) {
    try {
      const heads = await readStore(projects, "heads");
      for (const head of heads.values as { projectId: string }[])
        live.add(head.projectId);
      const entries = await readStore(projects, "entries");
      // Removing a project deletes its head and entries in one transaction: every row is live.
      roots.push((entries.values as { json: string }[]).map((row) => row.json));
    } finally {
      projects.close();
    }
  }
  const snapshots = await openExisting(factory, CATALOG_SNAPSHOT_DB);
  if (snapshots) {
    try {
      const rows = await readStore(snapshots, "snapshots");
      const kept = new Set(
        (rows.values as { id: string; projectId: string }[])
          .filter((row) => live.has(row.projectId))
          .map((row) => row.id),
      );
      const documents = await readStore(snapshots, "snapshotDocuments");
      roots.push(
        documents.values.filter((_, index) =>
          kept.has(String(documents.keys[index])),
        ),
      );
    } finally {
      snapshots.close();
    }
  }
  return roots;
}

export async function runCatalogAssetGcNow(
  memory: () => unknown[],
  options: { graceMs?: number } = {},
) {
  const [{ runAssetGc }, { collectDurableAssetRoots }] = await Promise.all([
    import("../../lib/assets/assetGc"),
    import("../../lib/assets/assetGcRoots"),
  ]);
  const report = await runAssetGc({
    roots: {
      durable: async () => [
        ...(await collectDurableAssetRoots()),
        ...(await collectCatalogDurableAssetRoots()),
      ],
      memory,
    },
    graceMs: options.graceMs,
  });
  try {
    localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
  } catch {
    /* not recorded: the next boot runs it again */
  }
  if (report.deleted.length > 0 || report.candidates > 0)
    console.info("[assets] GC", report);
  return report;
}

/** Once a day, at idle after the project opens; returns a cancel. */
export function scheduleCatalogAssetGc(memory: () => unknown[]): () => void {
  let last = 0;
  try {
    last = Number(localStorage.getItem(LAST_RUN_KEY) ?? 0);
  } catch {
    return () => {};
  }
  if (Date.now() - last < RUN_INTERVAL_MS) return () => {};
  const run = () =>
    void runCatalogAssetGcNow(memory).catch((error: unknown) => {
      console.warn("[assets] GC failed — only space reclaim waits", error);
    });
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(run, { timeout: 10_000 });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 5_000);
  return () => clearTimeout(handle);
}
