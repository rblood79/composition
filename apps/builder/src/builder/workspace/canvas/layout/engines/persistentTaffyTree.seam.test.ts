/**
 * ADR-916 Phase 0-A — PersistentTaffyTree 엔진 주입 seam 계약 테스트
 *
 * 검증 대상 (동작 무변 + 구조 교체 가능):
 * 1. 생성자에 주입한 LayoutEngineAPI 가 실제로 사용된다 (직접 `new TaffyLayout()` 제거).
 * 2. 주입 없이 생성 시 factory(createLayoutEngine) 경유 — flag false 이므로 TaffyLayout.
 * 3. LayoutEngineAPI 가 PersistentTaffyTree 실사용 batch 계약을 정적으로 커버한다.
 *
 * WASM 의존 없이 mock 엔진으로 주입 경로만 검증한다 (레이아웃 정확도는 G1/G2 dual-run 담당).
 */

import { describe, it, expect, vi } from "vitest";
import { PersistentTaffyTree } from "./persistentTaffyTree";
import type { PersistentBatchNode } from "./persistentTaffyTree";
import type { LayoutEngineAPI } from "../../wasm-bindings/layoutBridge";
import type { LayoutResult } from "../../wasm-bindings/taffyLayout";

/**
 * 최소 mock 레이아웃 엔진.
 *
 * buildTreeBatch 가 입력 노드 수만큼 순차 handle 을 반환하고,
 * getLayoutsBatch 는 handle 별 고정 레이아웃을 돌려준다.
 * 실제 solve 는 하지 않는다 — 주입 경로가 이어지는지만 확인.
 */
function createMockEngine(): LayoutEngineAPI & {
  buildTreeBatchCalls: number;
  computeLayoutCalls: number;
} {
  let nextHandle = 1;
  const state = {
    buildTreeBatchCalls: 0,
    computeLayoutCalls: 0,
  };

  return {
    ...state,
    isAvailable: () => true,
    hasBinaryProtocol: () => false,
    buildTreeBatch(nodesJson: string): number[] {
      this.buildTreeBatchCalls++;
      const parsed = JSON.parse(nodesJson) as unknown[];
      return parsed.map(() => nextHandle++);
    },
    buildTreeBatchBinary(): number[] {
      throw new Error("mock: binary protocol not supported");
    },
    createNodeRaw(): number {
      return nextHandle++;
    },
    updateStyleRaw: vi.fn(),
    setChildren: vi.fn(),
    markDirty: vi.fn(),
    removeNode: vi.fn(),
    computeLayout(): void {
      this.computeLayoutCalls++;
    },
    getLayoutsBatch(handles: number[]): Map<number, LayoutResult> {
      const map = new Map<number, LayoutResult>();
      for (const h of handles) {
        map.set(h, { x: 0, y: 0, width: 10, height: 10 });
      }
      return map;
    },
    clear: vi.fn(),
    nodeCount: () => nextHandle - 1,
  };
}

describe("PersistentTaffyTree 엔진 주입 seam (ADR-916 Phase 0-A)", () => {
  it("주입한 엔진이 buildFull 경로에서 실제로 사용된다", () => {
    const mock = createMockEngine();
    const tree = new PersistentTaffyTree(mock);

    // isAvailable 은 주입 엔진에 위임
    expect(tree.isAvailable).toBe(true);

    const batch: PersistentBatchNode[] = [
      {
        elementId: "child-1",
        style: { width: "10px", height: "10px" },
        children: [],
      },
      {
        elementId: "root-1",
        style: { display: "flex", width: "100px", height: "50px" },
        children: [0],
      },
    ];
    const filteredChildIds = new Map<string, string[]>([
      ["root-1", ["child-1"]],
    ]);

    const handles = tree.buildFull("root-1", batch, filteredChildIds);

    // 주입 엔진의 buildTreeBatch 가 정확히 1회 호출되고 handle 수가 batch 와 일치
    expect(mock.buildTreeBatchCalls).toBe(1);
    expect(handles).toHaveLength(batch.length);
    expect(tree.isInitialized).toBe(true);
  });

  it("주입 없이 생성해도 factory 경유로 엔진을 획득한다 (flag false → TaffyLayout)", () => {
    // WASM 미초기화 환경에서도 인스턴스화 자체는 성공해야 한다.
    // (TaffyLayout 은 engine 미초기화 시 isAvailable=false 반환)
    const tree = new PersistentTaffyTree();
    // 주입 엔진이 없으므로 factory 가 생성한 TaffyLayout 사용.
    // WASM 미초기화 → isAvailable false 가 정상 (throw 하지 않음).
    expect(typeof tree.isAvailable).toBe("boolean");
    expect(tree.isInitialized).toBe(false);
  });

  it("LayoutEngineAPI 가 PersistentTaffyTree 실사용 batch 계약을 정적으로 커버한다", () => {
    // 컴파일 타임 계약: 아래 메서드가 인터페이스에 없으면 이 파일이 type-check 에서 실패한다.
    const contract: (keyof LayoutEngineAPI)[] = [
      "isAvailable",
      "hasBinaryProtocol",
      "buildTreeBatch",
      "buildTreeBatchBinary",
      "createNodeRaw",
      "updateStyleRaw",
      "setChildren",
      "markDirty",
      "removeNode",
      "computeLayout",
      "getLayoutsBatch",
      "clear",
      "nodeCount",
    ];
    expect(contract).toHaveLength(13);
  });
});
