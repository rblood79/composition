import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * ADR-272 Phase 0 — Rust 공간 인덱스의 작업량 (`take_query_stat`) 이 하니스의 render 카운터
 * snapshot · reset 때 옮겨진다 (질의 · 갱신마다 wasm 을 건너지 않는다).
 */
const { stats } = vi.hoisted(() => ({
  stats: { taken: 0, next: [2, 30, 7, 5, 11] },
}));

vi.mock("./engineWasm", () => ({
  getEngineWasm: () => ({
    SpatialIndex: class {
      take_query_stat(i: number): number {
        if (i === 0) stats.taken += 1;
        const out = stats.next[i];
        stats.next[i] = 0;
        return out;
      }
    },
  }),
}));

describe("ADR-272 Phase 0 — 공간 질의 작업량 카운터", () => {
  afterAll(() => vi.unstubAllEnvs());

  it("snapshot 이 Rust 누적을 읽어 spatial* 에 더하고, reset 은 읽고 버린다", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const counters = await import("../skia/renderCounters");
    const { initSpatialIndex } = await import("./spatialIndex");
    initSpatialIndex();
    expect(stats.taken).toBe(0);

    const snap = counters.snapshotRenderCounters();
    expect(stats.taken).toBe(1);
    expect([
      snap.spatialQueries,
      snap.spatialCellsVisited,
      snap.spatialItemsVisited,
      snap.spatialResults,
      snap.spatialUpsertCells,
    ]).toEqual([2, 30, 7, 5, 11]);

    stats.next = [9, 9, 9, 9, 9];
    counters.resetRenderCounters();
    expect(stats.taken).toBe(2);
    const after = counters.snapshotRenderCounters();
    expect(after.spatialQueries).toBe(0);
    expect(after.spatialCellsVisited).toBe(0);
  });
});
