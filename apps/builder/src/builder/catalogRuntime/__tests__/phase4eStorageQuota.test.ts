import { describe, expect, it, vi } from "vitest";
import type { CatalogSaveStatus } from "../autosave";
import { CatalogStorageError, failure } from "../storage";
import { watchCatalogStorageQuota } from "../storageQuota";

/**
 * ADR-248 Phase 4e (gap audit G): the catalog storage reports the browser quota as its own code;
 * a save over the quota clears the caches and retries once, failing again tells the user; the
 * first completed save asks for persistent storage once.
 */
function fakeAutosave() {
  let status: CatalogSaveStatus = {
    projectId: "p",
    state: "saving",
    revision: 1,
    durableRevision: 0,
  };
  const listeners = new Set<() => void>();
  const retry = vi.fn(async () => {});
  return {
    retry,
    getSnapshot: () => status,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next: Partial<CatalogSaveStatus>) {
      status = { ...status, ...next };
      for (const listener of listeners) listener();
    },
  };
}
const quota = () => new CatalogStorageError("QUOTA_EXCEEDED");

describe("ADR-248 Phase 4e storage quota", () => {
  it("maps the browser's quota error to QUOTA_EXCEEDED, others to STORAGE_FAILURE", () => {
    expect(failure(new DOMException("full", "QuotaExceededError")).code).toBe(
      "QUOTA_EXCEEDED",
    );
    expect(failure({ name: "NS_ERROR_DOM_QUOTA_REACHED" }).code).toBe(
      "QUOTA_EXCEEDED",
    );
    expect(failure(new DOMException("x", "AbortError")).code).toBe(
      "STORAGE_FAILURE",
    );
  });

  it("clears caches and retries once, then notifies; persistence is asked after the first save", async () => {
    const autosave = fakeAutosave();
    const effects = {
      clearCaches: vi.fn(async () => {}),
      notifyQuotaExceeded: vi.fn(),
      requestPersistence: vi.fn(),
    };
    const stop = watchCatalogStorageQuota(autosave, effects);
    autosave.set({ state: "saved", durableRevision: 1 });
    autosave.set({ state: "saved", revision: 2, durableRevision: 2 });
    expect(effects.requestPersistence).toHaveBeenCalledTimes(1);

    autosave.set({ state: "failed", error: quota() });
    await vi.waitFor(() => expect(autosave.retry).toHaveBeenCalledTimes(1));
    expect(effects.clearCaches).toHaveBeenCalledTimes(1);
    expect(effects.notifyQuotaExceeded).not.toHaveBeenCalled();
    // The retry fails on the quota again: the user is told (once per failure).
    const again = quota();
    autosave.set({ state: "failed", error: again });
    autosave.set({ state: "failed", error: again });
    expect(effects.notifyQuotaExceeded).toHaveBeenCalledTimes(1);
    expect(autosave.retry).toHaveBeenCalledTimes(1);
    // Another kind of failure is not a quota notice.
    autosave.set({
      state: "failed",
      error: new CatalogStorageError("STORAGE_FAILURE"),
    });
    expect(effects.notifyQuotaExceeded).toHaveBeenCalledTimes(1);
    // A save resets the retry: the next quota failure clears and retries again.
    autosave.set({ state: "saved" });
    autosave.set({ state: "failed", error: quota() });
    await vi.waitFor(() => expect(autosave.retry).toHaveBeenCalledTimes(2));
    stop();
  });
});
