import type { CatalogAutosave } from "./autosave";
import { CatalogStorageError } from "./storage";

/**
 * ADR-248 Phase 4e (gap audit G, ADR-235 Phase 5 on the catalog storage): a save that fails on the
 * browser's storage quota clears the disposable caches and retries once; failing again, the user
 * is told (the header's retry button stays). The first completed save asks the browser to keep the
 * site's storage (`navigator.storage.persist`, once).
 */
export function watchCatalogStorageQuota(
  autosave: Pick<CatalogAutosave, "subscribe" | "getSnapshot" | "retry">,
  effects: {
    clearCaches(): Promise<void>;
    notifyQuotaExceeded(): void;
    requestPersistence(): void;
  },
): () => void {
  let persistenceAsked = false;
  /** The quota failure already retried after clearing caches (reset by the next save). */
  let retried = false;
  let handled: unknown;
  const check = () => {
    const status = autosave.getSnapshot();
    if (status.state === "saved") {
      retried = false;
      if (!persistenceAsked) {
        persistenceAsked = true;
        effects.requestPersistence();
      }
      return;
    }
    if (status.state !== "failed" || status.error === handled) return;
    if (
      !(status.error instanceof CatalogStorageError) ||
      status.error.code !== "QUOTA_EXCEEDED"
    )
      return;
    handled = status.error;
    if (retried) {
      effects.notifyQuotaExceeded();
      return;
    }
    retried = true;
    void effects
      .clearCaches()
      .catch(() => {})
      .then(() => autosave.retry());
  };
  return autosave.subscribe(check);
}
