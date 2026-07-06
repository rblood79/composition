/**
 * Layout Engine Bridge (ADR-100 / ADR-916)
 *
 * PersistentTaffyTree 의 엔진 주입 지점(factory).
 *
 * **ADR-916 Taffy 완전 제거 (2026-07-06)**: TaffyLayout 폴백 경로 삭제 — 자체
 * 엔진(composition-engine, taffy-free)을 단독 반환한다. WASM 미준비(startup
 * init 전 호출 / 로드 실패) 시에도 폴백 없이 엔진 인스턴스를 반환하며,
 * `isAvailable()` lazy re-init + useCanvasRuntimeBootstrap 의 15초 폴링/재시도가
 * 준비를 담당한다 (설계 Q1=B — 폴백 코드 신규 작성 없음).
 */

import { CompositionEngineLayout } from "./compositionEngine";
import type { LayoutResult } from "./compositionEngine";

/**
 * Common layout engine interface (ADR-916 Phase 0-A seam).
 *
 * PersistentTaffyTree 가 실제로 호출하는 batch 계약을 반영한다.
 * Taffy 완전 제거 후 자체 엔진(CompositionEngineLayout)이 이 계약의 유일 구현.
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
 * Layout engine factory — 자체 엔진 단독 반환.
 *
 * WASM 미준비 시에도 엔진 인스턴스를 반환한다: 미준비 상태의 메서드 호출은
 * throw 되고, `isAvailable()` 이 lazy re-init 을 시도하며, 부트스트랩의
 * 15초 폴링/재시도가 준비를 대기한다. Taffy 폴백 없음 (ADR-916 R4 소멸).
 */
export function createLayoutEngine(): LayoutEngineAPI {
  return new CompositionEngineLayout() as unknown as LayoutEngineAPI;
}
