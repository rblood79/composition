import type {
  CatalogDocument,
  CatalogEntry,
  CatalogLibrary,
} from "../../../../../packages/shared/src/catalog/document/types";
import { createCatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";

export const CATALOG_DB_NAME = "composition-catalog-projects-v1";

export class CatalogStorageError extends Error {
  constructor(
    readonly code:
      | "PROJECT_EXISTS"
      | "PROJECT_NOT_FOUND"
      | "REVISION_CONFLICT"
      | "UNSUPPORTED_PROJECT_FORMAT"
      | "STORAGE_FAILURE",
  ) {
    super(code);
  }
}

interface StoredHead {
  projectId: string;
  format: CatalogDocument["format"];
  schemaVersion: CatalogDocument["schemaVersion"];
  libraryContractVersion: CatalogDocument["libraryContractVersion"];
  rootId: CatalogDocument["rootId"];
  revision: number;
}
interface StoredEntry {
  projectId: string;
  id: string;
  json: string;
}
export interface CatalogCommit {
  projectId: CatalogDocument["projectId"];
  expectedDurableRevision: number;
  revision: number;
  changed: readonly { id: string; json: string }[];
  removedIds: readonly string[];
}
export interface StorageHooks {
  beforeTransaction?: (commit: CatalogCommit) => Promise<void> | void;
  afterWritesBeforeCommit?: (commit: CatalogCommit) => void;
}

function failure(error: unknown): CatalogStorageError {
  return error instanceof CatalogStorageError
    ? error
    : new CatalogStorageError("STORAGE_FAILURE");
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(failure(transaction.error));
    transaction.onerror = () => reject(failure(transaction.error));
  });
}

/** New namespace only. All serialization and optional yielding finish before opening a write transaction. */
export class CatalogStorage {
  constructor(
    private readonly factory: IDBFactory = indexedDB,
    private readonly name = CATALOG_DB_NAME,
    private readonly hooks: StorageHooks = {},
  ) {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(this.name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("heads", { keyPath: "projectId" });
        db.createObjectStore("entries", { keyPath: ["projectId", "id"] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(failure(request.error));
    });
  }

  async create(
    document: CatalogDocument,
    library: CatalogLibrary,
  ): Promise<void> {
    createCatalogGraph(document, library);
    const entries: StoredEntry[] = Object.values(document.entries).map(
      (entry) => ({
        projectId: document.projectId,
        id: entry.id,
        json: JSON.stringify(entry),
      }),
    );
    await Promise.resolve();
    const db = await this.open();
    try {
      const transaction = db.transaction(["heads", "entries"], "readwrite");
      const done = transactionDone(transaction);
      const heads = transaction.objectStore("heads");
      const records = transaction.objectStore("entries");
      const lookup = heads.get(document.projectId);
      lookup.onsuccess = () => {
        if (lookup.result) {
          transaction.abort();
          return;
        }
        const head: StoredHead = {
          projectId: document.projectId,
          format: document.format,
          schemaVersion: document.schemaVersion,
          libraryContractVersion: document.libraryContractVersion,
          rootId: document.rootId,
          revision: document.revision,
        };
        heads.put(head);
        for (const entry of entries) records.put(entry);
      };
      try {
        await done;
      } catch (error) {
        if (lookup.result) throw new CatalogStorageError("PROJECT_EXISTS");
        throw error;
      }
    } finally {
      db.close();
    }
  }

  async commit(commit: CatalogCommit): Promise<void> {
    // The caller captures immutable changed records at each graph revision.
    const entries: StoredEntry[] = commit.changed.map(({ id, json }) => ({
      projectId: commit.projectId,
      id,
      json,
    }));
    await this.hooks.beforeTransaction?.(commit);
    await Promise.resolve();
    const db = await this.open();
    try {
      const transaction = db.transaction(["heads", "entries"], "readwrite");
      const done = transactionDone(transaction);
      const heads = transaction.objectStore("heads");
      const records = transaction.objectStore("entries");
      let conflict: CatalogStorageError | null = null;
      const lookup = heads.get(commit.projectId);
      lookup.onsuccess = () => {
        const old = lookup.result as StoredHead | undefined;
        if (
          old &&
          (old.format !== "composition-catalog" ||
            old.schemaVersion !== 1 ||
            old.libraryContractVersion !== 1)
        ) {
          conflict = new CatalogStorageError("UNSUPPORTED_PROJECT_FORMAT");
          transaction.abort();
          return;
        }
        if (
          !old ||
          old.revision !== commit.expectedDurableRevision ||
          commit.revision !== old.revision + 1
        ) {
          conflict = new CatalogStorageError(
            old ? "REVISION_CONFLICT" : "PROJECT_NOT_FOUND",
          );
          transaction.abort();
          return;
        }
        try {
          for (const entry of entries) records.put(entry);
          for (const id of commit.removedIds)
            records.delete([commit.projectId, id]);
          heads.put({ ...old, revision: commit.revision });
          this.hooks.afterWritesBeforeCommit?.(commit);
        } catch {
          transaction.abort();
        }
      };
      try {
        await done;
      } catch (error) {
        throw conflict ?? error;
      }
    } finally {
      db.close();
    }
  }

  async load(
    projectId: CatalogDocument["projectId"],
    library: CatalogLibrary,
  ): Promise<CatalogDocument> {
    const db = await this.open();
    try {
      const transaction = db.transaction(["heads", "entries"], "readonly");
      const done = transactionDone(transaction);
      const headRequest = transaction.objectStore("heads").get(projectId);
      const recordRequest = transaction
        .objectStore("entries")
        .getAll(IDBKeyRange.bound([projectId, ""], [projectId, "\uffff"]));
      await done;
      const head = headRequest.result as StoredHead | undefined;
      if (!head) throw new CatalogStorageError("PROJECT_NOT_FOUND");
      if (
        head.format !== "composition-catalog" ||
        head.schemaVersion !== 1 ||
        head.libraryContractVersion !== 1
      )
        throw new CatalogStorageError("UNSUPPORTED_PROJECT_FORMAT");
      const entries: Record<string, CatalogEntry> = {};
      for (const record of recordRequest.result as StoredEntry[])
        entries[record.id] = JSON.parse(record.json) as CatalogEntry;
      const document: CatalogDocument = {
        format: head.format,
        schemaVersion: head.schemaVersion,
        libraryContractVersion: head.libraryContractVersion,
        projectId,
        rootId: head.rootId,
        revision: head.revision,
        entries,
      };
      createCatalogGraph(document, library);
      return document;
    } finally {
      db.close();
    }
  }
}
