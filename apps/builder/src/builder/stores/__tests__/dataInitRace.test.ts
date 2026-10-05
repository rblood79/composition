/**
 * 2026-10-05 감사 L2 — 프로젝트 A 를 읽는 중 B 로 옮기면, 늦게 끝난 A 의 응답이 B 의 data store
 * 를 덮지 않는다 (collections · currentProjectId).
 */
import { createStore } from "zustand";
import { describe, expect, it, vi } from "vitest";

const pendingA: { resolve?: (rows: unknown[]) => void } = {};
const table = (id: string, projectId: string) => ({
  id,
  name: id,
  project_id: projectId,
  schema: [{ id: "f", key: "name", type: "string" }],
  mockData: [],
  useMockData: true,
});

vi.mock("../../../lib/db", () => ({
  getDB: async () => ({
    collections: {
      getByProject: (projectId: string) =>
        projectId === "A"
          ? new Promise((resolve) => {
              pendingA.resolve = resolve;
            })
          : Promise.resolve([table("b-table", "B")]),
    },
    variables: { getByProject: async () => [] },
    api_endpoints: { getByProject: async () => [] },
    collection_runtime: { getByProject: async () => [] },
  }),
}));

const { createDataSlice } = await import("../data");

describe("data store — 프로젝트 전환 경합", () => {
  it("늦게 끝난 A 의 collections 가 B 를 덮지 않는다", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const store = createStore(createDataSlice);
    const a = store.getState().initializeForProject("A");
    await Promise.resolve();
    await store.getState().initializeForProject("B");
    expect([...store.getState().collections.keys()]).toEqual(["b-table"]);

    pendingA.resolve!([table("a-table", "A")]);
    await a;

    expect(store.getState().currentProjectId).toBe("B");
    expect([...store.getState().collections.keys()]).toEqual(["b-table"]);
    expect(store.getState().isInitialized).toBe(true);
  });
});
