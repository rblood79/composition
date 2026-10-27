/**
 * 2026-10-05 감사 L2 — 프로젝트 A 를 읽는 중 B 로 옮기면, 늦게 끝난 A 의 응답이 B 의 data store
 * 를 덮지 않는다. ADR-286: 정의는 문서 투영이라 읽기 경합은 API 행 캐시 (ADR-218) 에만 남는다.
 */
import { createStore } from "zustand";
import { describe, expect, it, vi } from "vitest";

const pendingA: { resolve?: (rows: unknown[]) => void } = {};
vi.mock("../../../lib/db", () => ({
  getDB: async () => ({
    collection_runtime: {
      getByProject: (projectId: string) =>
        projectId === "A"
          ? new Promise((resolve) => {
              pendingA.resolve = resolve;
            })
          : Promise.resolve([]),
      delete: async () => {},
    },
  }),
}));

const { createDataSlice } = await import("../data");

describe("data store — 프로젝트 전환 경합", () => {
  it("늦게 끝난 A 의 캐시 hydration 이 B 를 덮지 않는다", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const store = createStore(createDataSlice);
    const a = store.getState().initializeForProject("A");
    await Promise.resolve();
    await store.getState().initializeForProject("B");
    pendingA.resolve!([
      {
        collectionId: "a-table",
        project_id: "A",
        runtimeData: [{ n: 1 }],
        sourceRev: "r",
      },
    ]);
    await a;

    expect(store.getState().currentProjectId).toBe("B");
    expect(store.getState().runtimeRows.size).toBe(0);
    expect(store.getState().isInitialized).toBe(true);
  });
});
