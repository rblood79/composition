import type { CompositionDocument } from "@composition/shared";
import { IncrementalDocuments } from "./incrementalDocuments";
import type { CanonicalDocumentBackupRecord, DocumentPersistOptions } from "./types";

export type { CanonicalDocumentBackupRecord, DocumentPersistOptions };

/** Old projects' canonical documents in the `composition` DB, written as the old Builder did. */
export interface LegacyDocuments {
  put(
    projectId: string,
    document: CompositionDocument,
    options?: DocumentPersistOptions,
  ): Promise<CompositionDocument>;
  get(projectId: string): Promise<CompositionDocument | null>;
  delete(projectId: string): Promise<void>;
  backupNow(projectId: string): Promise<boolean>;
  getBackups(projectId: string): Promise<CanonicalDocumentBackupRecord[]>;
  close(): void;
}

/** Opens the `composition` DB the adapter created (call after `adapter.init()`). */
export async function openLegacyDocuments(): Promise<LegacyDocuments> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("composition");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const documents = new IncrementalDocuments(() => db);
  return {
    put: (projectId, document, options) =>
      documents.put(projectId, document, options),
    get: (projectId) => documents.get(projectId),
    delete: (projectId) => documents.delete(projectId),
    backupNow: (projectId) => documents.backupNow(projectId),
    getBackups: (projectId) =>
      new Promise((resolve, reject) => {
        const request = db
          .transaction("documents_backup")
          .objectStore("documents_backup")
          .index("project_id")
          .getAll(projectId);
        request.onsuccess = () =>
          resolve(
            (request.result as CanonicalDocumentBackupRecord[]).sort((a, b) =>
              b.updated_at.localeCompare(a.updated_at),
            ),
          );
        request.onerror = () => reject(request.error);
      }),
    close: () => db.close(),
  };
}
