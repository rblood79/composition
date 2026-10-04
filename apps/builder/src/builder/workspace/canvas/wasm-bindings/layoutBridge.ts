/**
 * Layout Engine Bridge (ADR-100 / ADR-916)
 *
 * PersistentLayoutTree 의 엔진 주입 지점(factory).
 *
 * **ADR-916 Taffy 완전 제거 (2026-07-06)**: TaffyLayout 폴백 경로 삭제 — 자체
 * 엔진(engine, taffy-free)을 단독 반환한다. WASM 미준비(startup
 * init 전 호출 / 로드 실패) 시에도 폴백 없이 엔진 인스턴스를 반환하며,
 * `isAvailable()` lazy re-init + useCanvasRuntimeBootstrap 의 15초 폴링/재시도가
 * 준비를 담당한다 (설계 Q1=B — 폴백 코드 신규 작성 없음).
 */

import { EngineLayout } from "./engine";

/**
 * Common layout engine interface (ADR-916 Phase 0-A seam).
 *
 * PersistentLayoutTree 가 실제로 호출하는 batch 계약을 반영한다.
 * Taffy 완전 제거 후 자체 엔진(EngineLayout)이 이 계약의 유일 구현.
 *
 * **Why batch 계약** (2026-07-03 실사): 기존 인터페이스는 per-node API
 * (createNode/computeLayout/getLayout) 만 선언했으나, PersistentLayoutTree 는
 * buildTreeBatch/getLayoutsBatch/setChildren/updateStyleRaw 등 batch 메서드를
 * 호출한다. 인터페이스가 실사용과 불일치하면 엔진 주입 시 타입 갭 발생 →
 * seam 이 성립하지 않는다. 실사용 batch 계약으로 정합.
 */
import type { LayoutEngineAPI } from "../../../../../../../packages/shared/src/catalog/runtime/layoutEngine";
export type { LayoutEngineAPI } from "../../../../../../../packages/shared/src/catalog/runtime/layoutEngine";

/**
 * Layout engine factory — 자체 엔진 단독 반환.
 *
 * WASM 미준비 시에도 엔진 인스턴스를 반환한다: 미준비 상태의 메서드 호출은
 * throw 되고, `isAvailable()` 이 lazy re-init 을 시도하며, 부트스트랩의
 * 15초 폴링/재시도가 준비를 대기한다. 엔진 폴백 없음 (ADR-916 R4 소멸).
 */
export function createLayoutEngine(): LayoutEngineAPI {
  const engine = new EngineLayout() as unknown as LayoutEngineAPI;
  if (strictLayoutInput) engine.setStrictInput?.(true);
  return engine;
}

// ── strict 입력 스위치 (하니스 전용) ──────────────────────────────────
//
// `createLayoutEngine()` 은 `PersistentLayoutTree` 안에서 호출돼 호출자가 인스턴스를
// 잡을 수 없다. 그래서 프로세스 전역 플래그로 둔다 — **기본 false**, 켜는 곳은
// parity 하니스의 파이프라인 leg 뿐이다. production 에서 켜면 미지 키 하나로
// 레이아웃이 통째로 실패한다.
let strictLayoutInput = false;

/** 이후 생성되는 엔진에 strict 입력을 적용한다 (하니스 전용). */
export function setStrictLayoutInput(enabled: boolean): void {
  strictLayoutInput = enabled;
}

/** 현재 strict 입력 스위치 상태. */
export function isStrictLayoutInput(): boolean {
  return strictLayoutInput;
}
