// @vitest-environment node
/**
 * ADR-235 Phase 5 — 저장소 보호 (quota 재시도 · persist 요청 · 캐시 상한).
 */
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompositionDocument } from "@composition/shared";

describe("withQuotaRetry", () => {
  it("quota 초과면 캐시를 비우고 1회 재시도해 성공한다", async () => {
    const { withQuotaRetry } = await import("../storageProtection");
    let calls = 0;
    const clear = vi.fn(async () => {});
    const result = await withQuotaRetry(async () => {
      calls += 1;
      if (calls === 1) throw new DOMException("full", "QuotaExceededError");
      return "ok";
    }, clear);
    expect(result).toBe("ok");
    expect(clear).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
  });

  it("재시도도 실패하면 알림 이벤트 뒤 throw · quota 가 아닌 오류는 재시도하지 않는다", async () => {
    const { withQuotaRetry, STORAGE_QUOTA_EVENT } =
      await import("../storageProtection");
    const events: string[] = [];
    vi.stubGlobal("window", {
      dispatchEvent: (event: Event) => events.push(event.type),
    });
    await expect(
      withQuotaRetry(
        async () => {
          throw new DOMException("full", "QuotaExceededError");
        },
        async () => {},
      ),
    ).rejects.toMatchObject({ name: "QuotaExceededError" });
    expect(events).toEqual([STORAGE_QUOTA_EVENT]);
    const clear = vi.fn(async () => {});
    await expect(
      withQuotaRetry(async () => {
        throw new Error("other");
      }, clear),
    ).rejects.toThrow("other");
    expect(clear).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("requestPersistenceOnce", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("이미 persisted 면 요청하지 않고 granted", async () => {
    const persist = vi.fn(async () => true);
    vi.stubGlobal("navigator", {
      storage: {
        persisted: async () => true,
        persist,
        estimate: async () => ({ usage: 10, quota: 100 }),
      },
    });
    const mod = await import("../storageProtection");
    const status = await mod.requestPersistenceOnce();
    expect(status).toMatchObject({ persist: "granted", usage: 10, quota: 100 });
    expect(persist).not.toHaveBeenCalled();
  });

  it("거부되면 denied (UI 가 상시 경고) · 두 번째 호출은 다시 묻지 않는다 · 사용률 판정", async () => {
    const persist = vi.fn(async () => false);
    let usage = 1;
    vi.stubGlobal("navigator", {
      storage: {
        persisted: async () => false,
        persist,
        estimate: async () => ({ usage, quota: 10 }),
      },
    });
    const mod = await import("../storageProtection");
    expect((await mod.requestPersistenceOnce()).persist).toBe("denied");
    await mod.requestPersistenceOnce();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(await mod.shouldPreemptivelyClearCaches()).toBe(false);
    usage = 9;
    expect(await mod.shouldPreemptivelyClearCaches()).toBe(true);
  });

  it("미지원 브라우저는 unsupported", async () => {
    vi.stubGlobal("navigator", {});
    const mod = await import("../storageProtection");
    expect((await mod.requestPersistenceOnce()).persist).toBe("unsupported");
  });
});

describe("adapter — 원본 저장 quota 재시도 · 캐시 상한", () => {
  beforeEach(() => {
    (globalThis as { indexedDB?: IDBFactory }).indexedDB = new IDBFactory();
  });

  it("documents.put 이 quota 로 실패하면 캐시를 비우고 재시도해 저장한다", async () => {
    const { IndexedDBAdapter } = await import("../../db/indexedDB/adapter");
    const adapter = new IndexedDBAdapter();
    await adapter.init();
    await adapter.collection_runtime.put({
      collectionId: "c1",
      project_id: "p1",
      runtimeData: [{ a: 1 }],
    } as never);
    const inner = (
      adapter as unknown as {
        incrementalDocuments: { put: (...a: unknown[]) => Promise<unknown> };
      }
    ).incrementalDocuments;
    const original = inner.put.bind(inner);
    let first = true;
    inner.put = async (...args: unknown[]) => {
      if (first) {
        first = false;
        throw new DOMException("full", "QuotaExceededError");
      }
      return original(...args);
    };
    const doc = {
      version: "composition-1.0",
      children: [],
    } as unknown as CompositionDocument;
    await adapter.documents.put("p1", doc);
    expect(await adapter.documents.get("p1")).toEqual(doc);
    expect(await adapter.collection_runtime.get("c1")).toBeNull(); // 캐시가 비워졌다
    await adapter.close();
  });

  it("캐시 용량 상한을 넘으면 오래된 행부터 지운다", async () => {
    const { IndexedDBAdapter } = await import("../../db/indexedDB/adapter");
    const { CACHE_BYTES_LIMIT } = await import("../storageProtection");
    const adapter = new IndexedDBAdapter();
    await adapter.init();
    const big = "x".repeat(Math.ceil(CACHE_BYTES_LIMIT / 2));
    for (const [id, at] of [
      ["old", "2026-01-01"],
      ["mid", "2026-02-01"],
      ["new", "2026-03-01"],
    ]) {
      await adapter.collection_runtime.put({
        collectionId: id,
        project_id: "p1",
        runtimeData: [big],
        updated_at: at,
      } as never);
    }
    const kept = (await adapter.collection_runtime.getByProject("p1"))
      .map((r) => r.collectionId)
      .sort();
    expect(kept).toEqual(["new"]);
    await adapter.close();
  });
});
