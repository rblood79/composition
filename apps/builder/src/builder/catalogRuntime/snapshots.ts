import type { CatalogDocument } from "../../../../../packages/shared/src/catalog/document/types";

/**
 * ADR-248 Phase 4e-6-32: History snapshots of a catalog project — whole-document restore points
 * that survive the linear history (사용자 승인 2026-10-01, 방향 (a)). The old runtime restored a
 * snapshot as an undoable history entry; the catalog runtime replaces the stored document and
 * reopens the project (a fresh history), so a restore first saves the current document as a
 * `system` snapshot — restoring that one undoes the restore.
 *
 * Limits (the old ADR-180 contract): `user` snapshots stop at {@link CATALOG_USER_SNAPSHOT_LIMIT}
 * per project (never deleted automatically — user data); `system` snapshots keep the newest
 * {@link CATALOG_SYSTEM_SNAPSHOT_LIMIT}; past {@link CATALOG_SNAPSHOT_BYTES_LIMIT} a user snapshot
 * is refused and the oldest system snapshots go. The list (`snapshots`) and the document JSON
 * (`snapshotDocuments`) are separate stores, so listing never reads the documents.
 */
export const CATALOG_SNAPSHOT_DB = "composition-catalog-snapshots-v1";
export const CATALOG_USER_SNAPSHOT_LIMIT = 10;
export const CATALOG_SYSTEM_SNAPSHOT_LIMIT = 5;
export const CATALOG_SNAPSHOT_BYTES_LIMIT = 50 * 1024 * 1024;

export interface CatalogSnapshot {
  id: string;
  projectId: string;
  kind: "user" | "system";
  createdAt: number;
  /** JSON characters of the document (the panel's size hint and the bytes limit). */
  size: number;
  /** A user snapshot's sequence number: its default name is "Snapshot N" in the UI language. */
  ordinal?: number;
  /** A renamed user snapshot's name. */
  name?: string;
  /** A system snapshot: the display name of the snapshot whose restore saved it. */
  restoredFrom?: string;
}

export class CatalogSnapshotLimitError extends Error {
  constructor() {
    super("CATALOG_SNAPSHOT_LIMIT");
    this.name = "CatalogSnapshotLimitError";
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function done(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}
function openDb(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore("snapshots", { keyPath: "id" }).createIndex(
        "projectId",
        "projectId",
      );
      db.createObjectStore("snapshotDocuments");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** One project's snapshots: a newest-first list (external store) over IndexedDB. */
export class CatalogSnapshots {
  private list: readonly CatalogSnapshot[] = [];
  private loading: Promise<void> | undefined;
  private readonly listeners = new Set<() => void>();
  /** The snapshot the open document was restored from, until the next edit (the panel's "active"). */
  private restored: string | null = null;

  constructor(
    readonly projectId: string,
    private readonly factory: IDBFactory = indexedDB,
    private readonly dbName = CATALOG_SNAPSHOT_DB,
    private readonly now: () => number = Date.now,
    private readonly newId: () => string = () =>
      `snapshot:${crypto.randomUUID()}`,
  ) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = (): readonly CatalogSnapshot[] => this.list;
  private set(next: readonly CatalogSnapshot[]): void {
    this.list = next;
    for (const listener of this.listeners) listener();
  }

  /** Reads the stored list once (later calls wait for the same read). */
  load(): Promise<void> {
    this.loading ??= (async () => {
      const db = await openDb(this.factory, this.dbName);
      try {
        const transaction = db.transaction("snapshots", "readonly");
        const stored = await request(
          transaction
            .objectStore("snapshots")
            .index("projectId")
            .getAll(this.projectId) as IDBRequest<CatalogSnapshot[]>,
        );
        // Snapshots made while the read ran are newer than the stored list.
        const known = new Set(this.list.map((item) => item.id));
        this.set(
          [...this.list, ...stored.filter((item) => !known.has(item.id))].sort(
            (a, b) => b.createdAt - a.createdAt,
          ),
        );
      } finally {
        db.close();
      }
    })();
    return this.loading;
  }

  userCount(): number {
    return this.list.filter((item) => item.kind === "user").length;
  }
  canCreateUser(): boolean {
    return this.userCount() < CATALOG_USER_SNAPSHOT_LIMIT;
  }

  /**
   * Saves `document` as a snapshot (durable before it resolves). A user snapshot past the limits
   * throws `CatalogSnapshotLimitError`; a system snapshot rolls the oldest system ones out.
   */
  async create(
    document: CatalogDocument,
    options: { kind: CatalogSnapshot["kind"]; restoredFrom?: string },
  ): Promise<CatalogSnapshot> {
    await this.load();
    const json = JSON.stringify(document);
    const used = (items: readonly CatalogSnapshot[]) =>
      items.reduce((sum, item) => sum + item.size, 0);
    if (
      options.kind === "user" &&
      (!this.canCreateUser() ||
        used(this.list) + json.length > CATALOG_SNAPSHOT_BYTES_LIMIT)
    )
      throw new CatalogSnapshotLimitError();
    const snapshot: CatalogSnapshot = {
      id: this.newId(),
      projectId: this.projectId,
      kind: options.kind,
      createdAt: this.now(),
      size: json.length,
      ...(options.kind === "user"
        ? {
            ordinal:
              Math.max(0, ...this.list.map((item) => item.ordinal ?? 0)) + 1,
          }
        : {}),
      ...(options.restoredFrom !== undefined
        ? { restoredFrom: options.restoredFrom }
        : {}),
    };
    let next = [snapshot, ...this.list];
    const dropped: string[] = [];
    if (options.kind === "system") {
      // Newest first: system snapshots past the count, then the oldest past the bytes limit.
      const systems = next.filter((item) => item.kind === "system");
      for (const item of systems.slice(CATALOG_SYSTEM_SNAPSHOT_LIMIT))
        dropped.push(item.id);
      for (const item of systems
        .slice(0, CATALOG_SYSTEM_SNAPSHOT_LIMIT)
        .reverse()) {
        if (item === snapshot) break;
        const kept = next.filter((other) => !dropped.includes(other.id));
        if (used(kept) <= CATALOG_SNAPSHOT_BYTES_LIMIT) break;
        dropped.push(item.id);
      }
      next = next.filter((item) => !dropped.includes(item.id));
    }
    const db = await openDb(this.factory, this.dbName);
    try {
      const transaction = db.transaction(
        ["snapshots", "snapshotDocuments"],
        "readwrite",
      );
      const written = done(transaction);
      transaction.objectStore("snapshots").put(snapshot);
      transaction.objectStore("snapshotDocuments").put(json, snapshot.id);
      for (const id of dropped) {
        transaction.objectStore("snapshots").delete(id);
        transaction.objectStore("snapshotDocuments").delete(id);
      }
      await written;
    } finally {
      db.close();
    }
    this.set(next);
    return snapshot;
  }

  async rename(id: string, name: string): Promise<void> {
    const trimmed = name.trim();
    const current = this.list.find((item) => item.id === id);
    if (!current || !trimmed || current.kind !== "user") return;
    const renamed = { ...current, name: trimmed };
    const db = await openDb(this.factory, this.dbName);
    try {
      const transaction = db.transaction("snapshots", "readwrite");
      const written = done(transaction);
      transaction.objectStore("snapshots").put(renamed);
      await written;
    } finally {
      db.close();
    }
    this.set(this.list.map((item) => (item.id === id ? renamed : item)));
  }

  async remove(id: string): Promise<void> {
    if (!this.list.some((item) => item.id === id)) return;
    const db = await openDb(this.factory, this.dbName);
    try {
      const transaction = db.transaction(
        ["snapshots", "snapshotDocuments"],
        "readwrite",
      );
      const written = done(transaction);
      transaction.objectStore("snapshots").delete(id);
      transaction.objectStore("snapshotDocuments").delete(id);
      await written;
    } finally {
      db.close();
    }
    if (this.restored === id) this.restored = null;
    this.set(this.list.filter((item) => item.id !== id));
  }

  /** The stored document of a snapshot. */
  async document(id: string): Promise<CatalogDocument> {
    const db = await openDb(this.factory, this.dbName);
    try {
      const transaction = db.transaction("snapshotDocuments", "readonly");
      const json = await request(
        transaction.objectStore("snapshotDocuments").get(id) as IDBRequest<
          string | undefined
        >,
      );
      if (json === undefined) throw new Error(`SNAPSHOT_NOT_FOUND:${id}`);
      return JSON.parse(json) as CatalogDocument;
    } finally {
      db.close();
    }
  }

  restoredId(): string | null {
    return this.restored;
  }
  markRestored(id: string | null): void {
    if (this.restored === id) return;
    this.restored = id;
    this.set([...this.list]);
  }
}

/**
 * Restores a snapshot into the stored project: reads it, saves `current` (the open document) as a
 * system snapshot, then `replace`s the stored document — the caller reopens the project. The
 * project keeps its current name (a dashboard property, not an edit to undo). Nothing is replaced
 * when the read or the system snapshot fails.
 */
export async function restoreCatalogSnapshot(options: {
  snapshots: CatalogSnapshots;
  id: string;
  current: CatalogDocument;
  restoredFrom: string;
  replace: (document: CatalogDocument) => Promise<unknown>;
}): Promise<CatalogDocument> {
  const { snapshots, id, current } = options;
  const stored = await snapshots.document(id);
  const currentProject = current.entries[current.projectId];
  const storedProject = stored.entries[stored.projectId];
  const document: CatalogDocument =
    currentProject?.kind === "project" && storedProject?.kind === "project"
      ? {
          ...stored,
          entries: {
            ...stored.entries,
            [stored.projectId]: { ...storedProject, name: currentProject.name },
          },
        }
      : stored;
  await snapshots.create(current, {
    kind: "system",
    restoredFrom: options.restoredFrom,
  });
  await options.replace(document);
  snapshots.markRestored(id);
  return document;
}

/** Deletes every snapshot of a project (the project was deleted). */
export async function removeCatalogProjectSnapshots(
  projectId: string,
  factory: IDBFactory = indexedDB,
  dbName = CATALOG_SNAPSHOT_DB,
): Promise<void> {
  const db = await openDb(factory, dbName);
  try {
    const transaction = db.transaction(
      ["snapshots", "snapshotDocuments"],
      "readwrite",
    );
    const written = done(transaction);
    const ids = await request(
      transaction
        .objectStore("snapshots")
        .index("projectId")
        .getAllKeys(projectId),
    );
    for (const id of ids) {
      transaction.objectStore("snapshots").delete(id);
      transaction.objectStore("snapshotDocuments").delete(id);
    }
    await written;
  } finally {
    db.close();
  }
}
