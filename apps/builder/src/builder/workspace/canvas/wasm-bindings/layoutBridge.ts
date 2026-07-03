/**
 * Layout Engine Bridge (ADR-100)
 *
 * Factory that returns the appropriate layout engine based on feature flags.
 * USE_RUST_LAYOUT_ENGINE=false → existing TaffyLayout
 * USE_RUST_LAYOUT_ENGINE=true  → new compositionLayout (Phase 1 complete)
 */

import { isUnifiedFlag } from "./featureFlags";
import { TaffyLayout } from "./taffyLayout";
import type { LayoutResult } from "./taffyLayout";

/**
 * Common layout engine interface (ADR-916 Phase 0-A seam).
 *
 * PersistentTaffyTree 가 실제로 호출하는 batch 계약을 반영한다.
 * TaffyLayout(0.9) 와 compositionLayout(0.10) 이 모두 이 메서드를 구현하며,
 * Phase 1 의 composition-engine(Taffy 없는 자체 엔진)도 동일 계약으로 이 seam 에 꽂힌다.
 *
 * **Why batch 계약** (2026-07-03 실사): 기존 인터페이스는 per-node API
 * (createNode/computeLayout/getLayout) 만 선언했으나, PersistentTaffyTree 는
 * buildTreeBatch/getLayoutsBatch/setChildren/updateStyleRaw 등 batch 메서드를
 * 호출한다. 인터페이스가 실사용과 불일치하면 엔진 주입 시 타입 갭 발생 →
 * seam 이 성립하지 않는다. 실사용 batch 계약으로 정합.
 */
export interface LayoutEngineAPI {
  isAvailable(): boolean;

  // ── batch tree 구축 (PersistentTaffyTree.buildFull 경유) ──
  buildTreeBatch(nodesJson: string): number[];
  buildTreeBatchBinary(data: Uint8Array): number[];
  hasBinaryProtocol(): boolean;

  // ── 증분 갱신 ──
  createNodeRaw(styleJson: string): number;
  updateStyleRaw(handle: number, styleJson: string): void;
  setChildren(handle: number, children: number[]): void;
  markDirty(handle: number): void;
  removeNode(handle: number): void;

  // ── 레이아웃 계산/수집 ──
  computeLayout(root: number, availW: number, availH: number): void;
  getLayoutsBatch(handles: number[]): Map<number, LayoutResult>;

  // ── 상태 ──
  clear(): void;
  nodeCount(): number;
}

/**
 * Create a layout engine instance based on the current feature flag.
 *
 * When USE_RUST_LAYOUT_ENGINE is false (default), returns TaffyLayout.
 * When true, returns the new compositionLayout wrapper.
 *
 * **ADR-916 Phase 0-A (2026-07-03)**: seam 만 구축, flag 전환은 보류.
 * 이 factory 가 PersistentTaffyTree 의 엔진 주입 지점이다 (직접 `new TaffyLayout()`
 * 제거). flag true 경로의 compositionLayout(Taffy 0.10) 실배선은 의도적으로
 * 미활성 — 0.10 도 외부 Taffy 종속이라 Phase 1(Taffy 제거)에서 폐기되므로,
 * 폐기될 0.10 검증 비용을 피한다. Phase 1 의 composition-engine(자체 엔진)이
 * 아래 wiring 자리에 직접 꽂힌다.
 */
export function createLayoutEngine(): LayoutEngineAPI {
  if (isUnifiedFlag("USE_RUST_LAYOUT_ENGINE")) {
    // ADR-916 Phase 1 에서 활성화 (composition-engine 배선 지점):
    //   const { compositionLayout } = await import('./layoutEngine');
    //   return new compositionLayout();
    // flag 를 켜도 아직 여기로 오면 fallback — 실배선은 Phase 1 이관.
    console.warn(
      "[ADR-916] USE_RUST_LAYOUT_ENGINE flag is true but composition-engine not yet wired (Phase 0-A seam only). Falling back to TaffyLayout.",
    );
  }

  return new TaffyLayout() as unknown as LayoutEngineAPI;
}
