import { beforeEach, describe, expect, it, vi } from "vitest";

const { wasmMock } = vi.hoisted(() => {
  class FakeSpatialIndex {
    private readonly bounds = new Map<
      number,
      [number, number, number, number]
    >();

    upsert(id: number, x: number, y: number, w: number, h: number): void {
      if (w <= 0 || h <= 0) {
        this.remove(id);
        return;
      }
      this.bounds.set(id, [x, y, w, h]);
    }

    batch_upsert(data: Float32Array): void {
      for (let i = 0; i < data.length; i += 5) {
        this.upsert(
          data[i],
          data[i + 1],
          data[i + 2],
          data[i + 3],
          data[i + 4],
        );
      }
    }

    remove(id: number): void {
      this.bounds.delete(id);
    }

    clear(): void {
      this.bounds.clear();
    }

    count(): number {
      return this.bounds.size;
    }

    query_viewport(): Uint32Array {
      return new Uint32Array();
    }

    query_rect(): Uint32Array {
      return new Uint32Array();
    }

    query_point(): Uint32Array {
      return new Uint32Array();
    }
  }

  return { wasmMock: { SpatialIndex: FakeSpatialIndex } };
});

vi.mock("./compositionEngineWasm", () => ({
  getCompositionEngineWasm: () => wasmMock,
}));

import {
  batchUpdate,
  clearAll,
  getSpatialIndex,
  initSpatialIndex,
} from "./spatialIndex";

describe("SpatialIndex full snapshot synchronization", () => {
  beforeEach(() => {
    initSpatialIndex();
    clearAll();
  });

  it("removes IDs omitted from the next render snapshot", () => {
    batchUpdate([
      { id: "stale", x: 0, y: 0, w: 100, h: 100 },
      { id: "keep", x: 200, y: 0, w: 100, h: 100 },
    ]);
    expect(getSpatialIndex()?.count()).toBe(2);

    batchUpdate([{ id: "keep", x: 210, y: 0, w: 100, h: 100 }]);

    expect(getSpatialIndex()?.count()).toBe(1);
  });

  it("clears the previous snapshot when the clip-aware map becomes empty", () => {
    batchUpdate([{ id: "clipped", x: 0, y: 0, w: 100, h: 100 }]);
    expect(getSpatialIndex()?.count()).toBe(1);

    batchUpdate([]);

    expect(getSpatialIndex()?.count()).toBe(0);
  });
});
