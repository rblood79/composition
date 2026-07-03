/**
 * ADR-916 Phase 1-D — Dual-run diff 하네스 계약 테스트 (TDD RED→GREEN)
 *
 * 두 LayoutEngineAPI 인스턴스(reference=Taffy, candidate=자체 엔진)에 동일 batch
 * 입력을 먹이고 getLayoutsBatch() 결과를 handle 별로 diff 한다. 판정 기준은
 * ADR-916 HC3 2단:
 *   (a) 수치 diff ≤ 1px (f32 sub-pixel tolerance) — 엔진 간 부동소수점 drift 허용
 *   (b) 1x zoom device pixel diff 0 — 수치 drift 가 동일 device pixel 로
 *       라운딩되는 범위만 허용. (a) 통과 + (b) 위반 시 (b) 가 우선 → FAIL
 *
 * candidate 엔진(composition-engine)은 Phase 1-A 이후 존재하므로, 본 세션은
 * self-diff(동일 엔진 두 인스턴스 = diff 0)로 하네스 자체의 정확성을 검증한다.
 * 하네스가 정확해야 flex.rs 착수 시 첫 실전 검증(G2)이 신뢰 가능하다.
 */

import { describe, it, expect, vi } from "vitest";
import {
  runDualLayout,
  diffLayoutMaps,
  type DualRunResult,
} from "./dualRunHarness";
import type { PersistentBatchNode } from "./persistentTaffyTree";
import type { LayoutEngineAPI } from "../../wasm-bindings/layoutBridge";
import type { LayoutResult } from "../../wasm-bindings/taffyLayout";

/**
 * 결정론적 mock 엔진 팩토리.
 *
 * buildTreeBatch 는 입력 노드 수만큼 순차 handle 반환.
 * getLayoutsBatch 는 handle 별로 주입된 layoutFn(handle) 결과를 돌려준다 —
 * 이 함수를 바꾸면 reference/candidate 의 결과 차이를 정밀 제어할 수 있다.
 */
function makeEngine(
  layoutFn: (handle: number, index: number) => LayoutResult,
): LayoutEngineAPI {
  let nextHandle = 1;
  const order: number[] = [];
  return {
    isAvailable: () => true,
    hasBinaryProtocol: () => false,
    buildTreeBatch(nodesJson: string): number[] {
      const parsed = JSON.parse(nodesJson) as unknown[];
      const handles = parsed.map(() => {
        const h = nextHandle++;
        order.push(h);
        return h;
      });
      return handles;
    },
    buildTreeBatchBinary(): number[] {
      throw new Error("mock: binary not supported");
    },
    createNodeRaw: () => nextHandle++,
    updateStyleRaw: vi.fn(),
    setChildren: vi.fn(),
    markDirty: vi.fn(),
    removeNode: vi.fn(),
    computeLayout: vi.fn(),
    getLayoutsBatch(handles: number[]): Map<number, LayoutResult> {
      const map = new Map<number, LayoutResult>();
      handles.forEach((h) => {
        map.set(h, layoutFn(h, order.indexOf(h)));
      });
      return map;
    },
    clear: vi.fn(),
    nodeCount: () => nextHandle - 1,
  };
}

const SIMPLE_BATCH: PersistentBatchNode[] = [
  {
    elementId: "child-1",
    style: { width: "10px", height: "10px" },
    children: [],
  },
  {
    elementId: "child-2",
    style: { width: "20px", height: "10px" },
    children: [],
  },
  {
    elementId: "root",
    style: { display: "flex", width: "100px", height: "50px" },
    children: [0, 1],
  },
];

describe("dual-run 하네스 (ADR-916 Phase 1-D)", () => {
  it("동일 엔진 self-diff → diff 0 (하네스 정확성 확증)", () => {
    // 같은 layoutFn 을 쓰는 두 엔진 = 완전 동일 결과
    const layoutFn = (_h: number, i: number): LayoutResult => ({
      x: i * 10,
      y: 0,
      width: 10,
      height: 10,
    });
    const ref = makeEngine(layoutFn);
    const cand = makeEngine(layoutFn);

    const result: DualRunResult = runDualLayout(
      SIMPLE_BATCH,
      "root",
      { availableWidth: 100, availableHeight: 50 },
      ref,
      cand,
    );

    expect(result.pass).toBe(true);
    expect(result.numericViolations).toHaveLength(0);
    expect(result.pixelViolations).toHaveLength(0);
    expect(result.nodeCount).toBe(SIMPLE_BATCH.length);
  });

  it("sub-pixel drift(≤1px, 같은 device pixel) → PASS (HC3 tolerance)", () => {
    // candidate 가 0.3px 만큼 벗어나지만 round 시 동일 pixel
    const refFn = (_h: number, i: number): LayoutResult => ({
      x: i * 10,
      y: 0,
      width: 10,
      height: 10,
    });
    const candFn = (_h: number, i: number): LayoutResult => ({
      x: i * 10 + 0.3,
      y: 0,
      width: 10,
      height: 10,
    });
    const result = runDualLayout(
      SIMPLE_BATCH,
      "root",
      { availableWidth: 100, availableHeight: 50 },
      makeEngine(refFn),
      makeEngine(candFn),
    );

    // (a) 수치 diff 0.3 ≤ 1px → 수치 위반 없음
    expect(result.numericViolations).toHaveLength(0);
    // (b) round(x)==round(x+0.3) 이면 pixel 위반 없음 (0→0, 10→10)
    expect(result.pixelViolations).toHaveLength(0);
    expect(result.pass).toBe(true);
  });

  it("수치 diff > 1px → 수치 위반 + FAIL", () => {
    const refFn = (): LayoutResult => ({ x: 0, y: 0, width: 10, height: 10 });
    const candFn = (): LayoutResult => ({ x: 3, y: 0, width: 10, height: 10 });
    const result = runDualLayout(
      SIMPLE_BATCH,
      "root",
      { availableWidth: 100, availableHeight: 50 },
      makeEngine(refFn),
      makeEngine(candFn),
    );

    expect(result.numericViolations.length).toBeGreaterThan(0);
    expect(result.pass).toBe(false);
    // 위반 항목은 어느 노드/필드/delta 인지 보고
    const v = result.numericViolations[0];
    expect(v.elementId).toBeDefined();
    expect(v.field).toBe("x");
    expect(v.delta).toBeCloseTo(3);
  });

  it("sub-pixel drift 가 pixel 경계 넘으면 → (b) 우선 FAIL", () => {
    // 0.5px drift 가 픽셀 경계(x=9.7 → round 10, x=10.2 → round 10... 조정)
    // ref x=9.6 (round 10), cand x=10.4 (round 10) 은 같은 pixel → PASS
    // ref x=9.4 (round 9), cand x=9.6 (round 10) 은 다른 pixel → (a) 통과 (0.2≤1) + (b) 위반
    const refFn = (): LayoutResult => ({ x: 9.4, y: 0, width: 10, height: 10 });
    const candFn = (): LayoutResult => ({
      x: 9.6,
      y: 0,
      width: 10,
      height: 10,
    });
    const result = runDualLayout(
      SIMPLE_BATCH,
      "root",
      { availableWidth: 100, availableHeight: 50 },
      makeEngine(refFn),
      makeEngine(candFn),
    );

    // (a) 수치 diff 0.2 ≤ 1px → 수치 위반 없음
    expect(result.numericViolations).toHaveLength(0);
    // (b) round(9.4)=9 vs round(9.6)=10 → pixel 위반
    expect(result.pixelViolations.length).toBeGreaterThan(0);
    // HC3: (b) 위반 시 (b) 우선 → FAIL
    expect(result.pass).toBe(false);
  });

  it("diffLayoutMaps 는 handle 정렬 무관하게 elementId 로 매칭한다", () => {
    const a = new Map<number, LayoutResult>([
      [1, { x: 0, y: 0, width: 10, height: 10 }],
      [2, { x: 10, y: 0, width: 20, height: 10 }],
    ]);
    const b = new Map<number, LayoutResult>([
      [2, { x: 10, y: 0, width: 20, height: 10 }],
      [1, { x: 0, y: 0, width: 10, height: 10 }],
    ]);
    const handleToId = new Map<number, string>([
      [1, "child-1"],
      [2, "child-2"],
    ]);

    const { numericViolations, pixelViolations } = diffLayoutMaps(
      a,
      b,
      handleToId,
    );
    expect(numericViolations).toHaveLength(0);
    expect(pixelViolations).toHaveLength(0);
  });
});
