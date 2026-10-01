import { createContext } from "react";
import type { EntryId } from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogStorage } from "../../catalogRuntime/storage";
import {
  restoreCatalogSnapshot,
  type CatalogSnapshot,
  type CatalogSnapshots,
} from "../../catalogRuntime/snapshots";
import type { CatalogWorkspace } from "../../catalogRuntime/workspace";

/**
 * ADR-248 Phase 4e-6-32: the History panel's and the header menu's snapshot actions over the open
 * catalog project. `snapshots` outlives a reopen (the Builder keeps one list per project route);
 * `restore` saves the open document as a system snapshot, replaces the stored document and reopens
 * the project on the same page.
 */
export interface CatalogSnapshotHost {
  snapshots: CatalogSnapshots;
  /** A user snapshot of the open document (refused at the limit). */
  create(): Promise<void>;
  restore(id: string, restoredFrom: string): Promise<void>;
}

export const CatalogSnapshotHostContext =
  createContext<CatalogSnapshotHost | null>(null);

export function createCatalogSnapshotHost(
  workspace: CatalogWorkspace,
  snapshots: CatalogSnapshots,
  reopen: (pageId: string | undefined) => void,
  storage: Pick<CatalogStorage, "replace"> = new CatalogStorage(),
): CatalogSnapshotHost {
  const graph = workspace.runtime.graph;
  return {
    snapshots,
    create: async () => {
      await snapshots.create(graph.exportDocument(), { kind: "user" });
    },
    restore: async (id, restoredFrom) => {
      const pageId = workspace.session.getSnapshot().pageId;
      const restored = await restoreCatalogSnapshot({
        snapshots,
        id,
        current: graph.exportDocument(),
        restoredFrom,
        replace: (document) => storage.replace(document, graph.library),
      });
      reopen(
        pageId && restored.entries[pageId as EntryId<"page">]?.kind === "page"
          ? pageId
          : undefined,
      );
    },
  };
}

/**
 * What a restore of `snapshot` names in its "Before restore" snapshot: the snapshot's name — for a
 * system snapshot the snapshot it was saved before, so restoring back does not nest the names.
 */
export function catalogSnapshotRestoredFrom(
  snapshot: CatalogSnapshot,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return snapshot.kind === "system" && snapshot.restoredFrom !== undefined
    ? snapshot.restoredFrom
    : catalogSnapshotName(snapshot, t);
}

/** A snapshot's display name: a user snapshot's own or "Snapshot N"; a system one names its restore. */
export function catalogSnapshotName(
  snapshot: CatalogSnapshot,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  return snapshot.kind === "system"
    ? t("history.snapshotBeforeRestore", { name: snapshot.restoredFrom ?? "" })
    : (snapshot.name ??
        t("history.snapshotDefaultName", { index: snapshot.ordinal ?? 1 }));
}
