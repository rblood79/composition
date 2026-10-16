// ADR-263 Phase 4 (G4) — 스크롤 범위 증분: 바뀐 서브트리의 전 · 후 기여로 갱신한 extent 가 전체
// 재계산과 같다 (무작위 2,000 건). 갱신이 읽는 노드는 바뀐 서브트리뿐이다.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  catalogOverflowClips,
  catalogScrollExtent,
  catalogSubtreeScrollExtent,
  catalogUpdatedScrollExtent,
  type CatalogOverflowTree,
} from "../canvasOverflow";
import {
  resetRenderCounters,
  snapshotRenderCounters,
} from "../../workspace/canvas/skia/renderCounters";

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rect = { x: number; y: number; width: number; height: number };

describe("ADR-263 Phase 4 — scroll extent 증분", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("무작위 트리 · 무작위 이동 · 크기 변경 2,000 건에서 증분 = 전체 재계산", () => {
    const random = rng(2634);
    const value = () =>
      Math.round((random() * 400 - 50) * (random() < 0.3 ? 1.5 : 1)) +
      (random() < 0.2 ? 0.25 : 0);
    let incremental = 0;
    let recomputed = 0;
    for (let trial = 0; trial < 2000; trial += 1) {
      const count = 2 + Math.floor(random() * 25);
      const parent = new Map<string, string>();
      const children = new Map<string, string[]>([["o", []]]);
      const overflow = new Map<string, string>([["o", "auto"]]);
      const rects = new Map<string, Rect>([
        ["o", { x: 0, y: 0, width: 300, height: 300 }],
      ]);
      const ids = ["o"];
      for (let i = 0; i < count; i += 1) {
        const id = `n${i}`;
        const p = ids[Math.floor(random() * ids.length)]!;
        parent.set(id, p);
        children.set(id, []);
        children.get(p)!.push(id);
        if (random() < 0.1) overflow.set(id, "hidden");
        rects.set(id, {
          x: value(),
          y: value(),
          width: Math.abs(value()),
          height: Math.abs(value()),
        });
        ids.push(id);
      }
      const tree: CatalogOverflowTree = {
        overflowOf: (id) => overflow.get(id) ?? "visible",
        childrenOf: (id) => children.get(id) ?? [],
        parentOf: (id) => parent.get(id),
      };
      const owner = (id: string) => {
        for (let c = parent.get(id); c; c = parent.get(c))
          if (catalogOverflowClips(tree.overflowOf(c))) return c;
        return undefined;
      };
      const before = new Map(rects);
      const previous = catalogScrollExtent("o", tree, (id) => before.get(id));
      const changed = new Set<string>();
      const changes = 1 + Math.floor(random() * 3);
      for (let k = 0; k < changes; k += 1) {
        const id = ids[1 + Math.floor(random() * (ids.length - 1))]!;
        const r = rects.get(id)!;
        rects.set(id, {
          x: random() < 0.5 ? value() : r.x,
          y: random() < 0.5 ? value() : r.y,
          width: random() < 0.5 ? Math.abs(value()) : r.width,
          height: random() < 0.5 ? Math.abs(value()) : r.height,
        });
        changed.add(id);
      }
      // the binding's rule: changed ids whose nearest clipping ancestor is "o", top-most only
      const top = [...changed].filter((id) => {
        if (owner(id) !== "o") return false;
        for (let c = parent.get(id); c && c !== "o"; c = parent.get(c))
          if (changed.has(c)) return false;
        return true;
      });
      const next = catalogUpdatedScrollExtent(
        previous,
        top.map((id) =>
          catalogSubtreeScrollExtent("o", id, tree, (n) => before.get(n)),
        ),
        top.map((id) =>
          catalogSubtreeScrollExtent("o", id, tree, (n) => rects.get(n)),
        ),
      );
      const full = catalogScrollExtent("o", tree, (id) => rects.get(id));
      if (next === null) {
        recomputed += 1;
        continue;
      }
      incremental += 1;
      expect(next.right).toBeCloseTo(full.right, 9);
      expect(next.bottom).toBeCloseTo(full.bottom, 9);
    }
    expect(incremental).toBeGreaterThan(1000);
    expect(recomputed).toBeGreaterThan(20);
  });

  it("갱신이 읽는 노드는 바뀐 서브트리뿐이다 (owner 아래 5,000 자식)", () => {
    vi.stubEnv("NODE_ENV", "development");
    const kids = Array.from({ length: 5000 }, (_, i) => `k${i}`);
    const rects = new Map<string, Rect>(
      kids.map((id, i) => [id, { x: 0, y: i * 10, width: 50, height: 10 }]),
    );
    const tree: CatalogOverflowTree = {
      overflowOf: (id) => (id === "o" ? "auto" : "visible"),
      childrenOf: (id) => (id === "o" ? kids : []),
      parentOf: (id) => (id === "o" ? undefined : "o"),
    };
    const previous = catalogScrollExtent("o", tree, (id) => rects.get(id));
    const before = catalogSubtreeScrollExtent("o", "k10", tree, (id) =>
      rects.get(id),
    );
    rects.set("k10", { x: 0, y: 100, width: 400, height: 10 });
    resetRenderCounters();
    const after = catalogSubtreeScrollExtent("o", "k10", tree, (id) =>
      rects.get(id),
    );
    const next = catalogUpdatedScrollExtent(previous, [before], [after]);
    expect(snapshotRenderCounters()).toMatchObject({
      scrollSubtreeVisits: 1,
      scrollRangeVisits: 0,
    });
    expect(next).toEqual({ right: 400, bottom: 50000 });
  });
});
