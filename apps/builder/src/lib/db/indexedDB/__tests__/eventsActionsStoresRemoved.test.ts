// @vitest-environment node
/**
 * ADR-248 G4 (live R10, 2026-10-03): the old document's `events` / `actions` fan-out mirrors are
 * gone. A fresh profile does not create the two stores; a DB of version 23 drops them on upgrade
 * and keeps the data stores (collections · api_endpoints · variables) and their rows (H1).
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IndexedDBAdapter } from "../adapter";

const DATA_STORES = ["collections", "api_endpoints", "variables"];

function storeNames(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("composition");
    request.onsuccess = () => {
      resolve([...request.result.objectStoreNames]);
      request.result.close();
    };
    request.onerror = () => reject(request.error);
  });
}

describe("ADR-248 G4 — events/actions mirror stores", () => {
  let adapter: IndexedDBAdapter;
  beforeEach(() => {
    (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
    adapter = new IndexedDBAdapter();
  });
  afterEach(async () => {
    await adapter.close();
  });

  it("a fresh profile has the data stores and no events/actions stores", async () => {
    await adapter.init();
    await adapter.close();
    const names = await storeNames();
    expect(names).not.toContain("events");
    expect(names).not.toContain("actions");
    for (const store of DATA_STORES) expect(names).toContain(store);
  });

  it("upgrading a version 23 DB drops events/actions and keeps the data rows", async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("composition", 23);
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const store of [...DATA_STORES, "events", "actions"])
          db.createObjectStore(store, { keyPath: "id" }).createIndex(
            "project_id",
            "project_id",
          );
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction(["collections", "events"], "readwrite");
        tx.objectStore("collections").put({
          id: "c1",
          project_id: "p",
          name: "t",
        });
        tx.objectStore("events").put({ id: "e1", project_id: "p" });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });
    await adapter.init();
    expect(await adapter.collections.getByProject("p")).toMatchObject([
      { id: "c1", name: "t" },
    ]);
    await adapter.close();
    const names = await storeNames();
    expect(names).not.toContain("events");
    expect(names).not.toContain("actions");
  });
});
