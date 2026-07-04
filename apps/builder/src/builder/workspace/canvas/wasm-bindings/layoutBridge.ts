/**
 * Layout Engine Bridge (ADR-100)
 *
 * Factory that returns the appropriate layout engine based on feature flags.
 * USE_RUST_LAYOUT_ENGINE=false → existing TaffyLayout
 * USE_RUST_LAYOUT_ENGINE=true  → new compositionLayout (Phase 1 complete)
 */

import { CompositionEngineLayout } from "./compositionEngine";
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
 * **ADR-916 Phase 2-B seam C-2a (2026-07-04)**: flag true 경로에 자체 엔진
 * (`CompositionEngineLayout`) 실배선. flag(`USE_RUST_LAYOUT_ENGINE`)가 true 이고
 * 자체 WASM 이 로드 준비되면 자체 엔진을 반환한다. WASM 미준비(startup init 전 /
 * 로드 실패)면 TaffyLayout 으로 안전 폴백 — 회귀 시 flag false 로 즉시 rollback.
 *
 * flag 전환 전제: dualRunLive.test.ts 12/12(실전 대표 8형상 자체 vs Taffy diff 0)
 * proof 확보 후에만 flip([[feedback-no-dormant-foundation-ahead-of-flip]]).
 * 이 factory 가 PersistentTaffyTree 의 엔진 주입 지점이다(직접 `new TaffyLayout()`
 * 제거). Phase 0-A 의 compositionLayout(Taffy 0.10) 경로는 폐기 — 0.10 도 외부
 * Taffy 종속이라, Phase 1 자체 엔진(taffy-free)이 이 자리를 차지한다.
 */
export function createLayoutEngine(): LayoutEngineAPI {
  if (isUnifiedFlag("USE_RUST_LAYOUT_ENGINE")) {
    const engine = new CompositionEngineLayout();
    if (engine.isAvailable()) {
      return engine as unknown as LayoutEngineAPI;
    }
    // 자체 WASM 미준비(startup init 전 호출 / 로드 실패) → Taffy 안전 폴백.
    // startup(init.ts)이 initCompositionEngineWasm() 을 먼저 await 하므로 정상
    // 경로에서는 준비돼 있어야 한다. 미준비면 회귀 없이 기존 엔진 유지.
    if (import.meta.env.DEV) {
      console.warn(
        "[ADR-916] composition-engine WASM 미준비 — TaffyLayout 폴백(startup init 순서 확인).",
      );
    }
  }

  return new TaffyLayout() as unknown as LayoutEngineAPI;
}
