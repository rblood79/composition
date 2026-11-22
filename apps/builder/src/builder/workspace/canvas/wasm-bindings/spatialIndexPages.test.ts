import { describe, expect, it, vi } from "vitest";

/**
 * 2026-11-22 — page 별 grid: 요소는 page 원점 기준으로 저장되고 질의가 그 원점 (`PageSpace`) 을 더해
 * 읽는다. page 를 옮기면 색인 쓰기 없이 질의 결과가 장면 좌표로 따라간다 — 같은 장면 상자를 전수로
 * 대조한 결과와 같다.
 */
vi.mock("./engineWasm", () => {
  /** Rust `SpatialIndex` 대역 — 상자 목록 (경계 포함 교차 · 점은 닫힌 상자). */
  class FakeIndex {
    private readonly items = new Map<
      number,
      [number, number, number, number]
    >();
    upsert(id: number, x: number, y: number, w: number, h: number) {
      if (w <= 0 || h <= 0) this.items.delete(id);
      else this.items.set(id, [x, y, w, h]);
    }
    batch_upsert(data: Float32Array) {
      for (let i = 0; i < data.length; i += 5)
        this.upsert(
          data[i]!,
          data[i + 1]!,
          data[i + 2]!,
          data[i + 3]!,
          data[i + 4]!,
        );
    }
    query_rect(l: number, t: number, r: number, b: number) {
      return Uint32Array.from(
        [...this.items]
          .filter(
            ([, [x, y, w, h]]) => x < r && x + w > l && y < b && y + h > t,
          )
          .map(([id]) => id),
      );
    }
    query_viewport(l: number, t: number, r: number, b: number) {
      return this.query_rect(l, t, r, b);
    }
    query_point(px: number, py: number) {
      return Uint32Array.from(
        [...this.items]
          .filter(
            ([, [x, y, w, h]]) =>
              px >= x && px <= x + w && py >= y && py <= y + h,
          )
          .map(([id]) => id),
      );
    }
    remove(id: number) {
      this.items.delete(id);
    }
    clear() {
      this.items.clear();
    }
    count() {
      return this.items.size;
    }
    take_query_stat() {
      return 0;
    }
    free() {}
  }
  return { getEngineWasm: () => ({ SpatialIndex: FakeIndex }) };
});

const { PageSpace } = await import("../skia/pageSpace");
const index = await import("./spatialIndex");

function random(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

describe("2026-11-22 spatial index — page 별 grid 와 page 원점", () => {
  it("무작위 200 벌: page 를 옮기고 · 요소를 고치고 · 지운 뒤 rect · point 질의가 장면 상자 전수 대조와 같다", () => {
    index.initSpatialIndex();
    for (let seed = 1; seed <= 200; seed += 1) {
      const next = random(seed);
      const int = (min: number, max: number) =>
        min + Math.floor(next() * (max - min + 1));
      const space = new PageSpace();
      /** 장면 상자 (정답). */
      const scene = new Map<
        string,
        { x: number; y: number; w: number; h: number }
      >();
      const pages = ["A", "B", "C"];
      for (let i = 0; i < 60; i += 1) {
        const page = pages[i % 3]!;
        const id = `${page}${i}`;
        space.assign(id, page);
        scene.set(id, {
          x: int(0, 600),
          y: (i % 3) * 1000 + int(0, 900),
          w: int(1, 200),
          h: int(1, 200),
        });
      }
      index.batchUpdate(
        [...scene].map(([id, r]) => ({ id, ...r })),
        space,
      );
      for (let step = 0; step < 6; step += 1) {
        const roll = next();
        if (roll < 0.4) {
          // page 이동 — 색인 쓰기 없이 원점만.
          const page = pages[int(0, 2)]!;
          const dx = int(-300, 300);
          const dy = int(-500, 500);
          space.movePage(page, dx, dy);
          for (const [id, r] of scene)
            if (space.pageOf(id) === page)
              scene.set(id, { ...r, x: r.x + dx, y: r.y + dy });
        } else if (roll < 0.8) {
          // 요소 갱신 (장면 좌표) — 다른 page 로 옮겨 가는 것 포함.
          const id = [...scene.keys()][int(0, scene.size - 1)]!;
          const page = pages[int(0, 2)]!;
          space.assign(id, page);
          const r = {
            x: int(-200, 800),
            y: int(-200, 3000),
            w: int(0, 150),
            h: int(1, 150),
          };
          index.updateElement(id, r.x, r.y, r.w, r.h);
          if (r.w > 0) scene.set(id, r);
          else scene.delete(id);
        } else {
          const id = [...scene.keys()][int(0, scene.size - 1)];
          if (id) {
            index.removeElement(id);
            scene.delete(id);
          }
        }
        for (let q = 0; q < 8; q += 1) {
          const l = int(-300, 900);
          const t = int(-600, 3200);
          const r = l + int(1, 700);
          const b = t + int(1, 900);
          const expected = [...scene]
            .filter(
              ([, s]) => s.x < r && s.x + s.w > l && s.y < b && s.y + s.h > t,
            )
            .map(([id]) => id)
            .sort();
          expect(index.queryRect(l, t, r, b).sort(), `seed ${seed}`).toEqual(
            expected,
          );
          const px = int(-100, 900);
          const py = int(-300, 3100);
          const expectedPoint = [...scene]
            .filter(
              ([, s]) =>
                px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h,
            )
            .map(([id]) => id)
            .sort();
          expect(
            index.hitTestPoint(px, py).sort(),
            `seed ${seed} point`,
          ).toEqual(expectedPoint);
        }
      }
      index.clearAll();
    }
  });
});
