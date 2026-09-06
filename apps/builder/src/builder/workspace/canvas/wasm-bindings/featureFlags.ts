/**
 * Canvas Feature Flags — 게이트/플래그 단일 registry
 *
 * Canvas 렌더링 관련 게이트의 **유일 정의처**. 모든 플래그는 하드코딩 —
 * 환경변수 분기 없음. 이 파일 밖에 boolean 게이트 상수를 두지 않는다
 * (`featureFlags.test.ts` 의 registry 계약이 기계 집행).
 *
 * 소비자 0건 규칙: 코드 소비처가 사라진 플래그는 표에서 삭제한다 — 전환
 * 계획·완료 사실은 ADR/CHANGELOG 가 기록하고, 소비자 없는 플래그로 중복
 * 보관하면 "토글할 수 있는 것" 으로 잘못 읽힌다 (2026-08-15 스윕에서
 * 구 렌더 게이트 등 9개가 그렇게 죽은 채 남아 있었다). 의도적으로 보존할
 * 0-소비자 게이트는 `featureFlags.test.ts` 의 `INTENT_PRESERVED` allowlist
 * 에 사유와 함께 등재한다.
 *
 * @see docs/legacy/RENDERING_ARCHITECTURE.md §0.3 Feature Flag 인프라
 */

export const WASM_FLAGS = {
  /** SpatialIndex WASM 가속 (composition-engine pkg — ADR-916 crate 분리 편입) */
  SPATIAL_INDEX: true,

  /** CanvasKit/Skia 렌더러 활성화 */
  CANVASKIT_RENDERER: true,
} as const;

/**
 * Canvas 2D 텍스트 측정 활성화 (ADR-051)
 *
 * false → 기존 CanvasKit Paragraph 경로 (즉시 원복)
 * true  → Canvas 2D 세그먼트 캐시 + 3-Tier 파이프라인
 *
 * 소비처: nodeRendererText, canvaskitTextMeasurer.
 * (2026-08-15 registry 통합 — 구 정의처 `utils/canvas2dSegmentCache.ts`)
 */
export const USE_CANVAS2D_MEASURE = true;

/** 측정 하니스가 navigation 전에 명시적으로 요청하는 production 계측. 렌더 정책과 독립. */
export function isFrameCaptureRequested(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __composition_FRAME_CAPTURE_REQUESTED__?: boolean })
      .__composition_FRAME_CAPTURE_REQUESTED__ === true
  );
}

/**
 * GPU 프레임 시간 계측 (GpuTimer) 요청. frame capture 와 **별도 opt-in** 이다.
 *
 * Why: GpuTimer 는 출하 production 에 없는 객체이고 poll 이 GL 동기 조회
 * (getParameter(GPU_DISJOINT_EXT) — Chrome 에서 GPU 프로세스 왕복) 를 측정 구간
 * 안에서 돌린다. capture 에 묶어두면 "계측만 켠 production" 의 CPU A/B 를 잴
 * 방법이 없어 CPU delta 에 GPU 계측 비용이 섞인다 (2026-09-06 판정 철회 사유).
 */
export function isGpuTimerRequested(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as { __composition_GPU_TIMER_REQUESTED__?: boolean })
      .__composition_GPU_TIMER_REQUESTED__ === true
  );
}

/** Unified engine flags with live consumers. */
export const UNIFIED_ENGINE_FLAGS = {
  // Layout Engine — ADR-916 Taffy 완전 제거(2026-07-06) 후 자체 엔진
  // (composition-engine)이 상시 단독 경로. key 를 제거하면 init.ts 의
  // isUnifiedFlag("USE_RUST_LAYOUT_ENGINE") 가 union 에서 빠져 컴파일 에러 —
  // 소비처 영향 최소화를 위해 key 를 상수 true 로 유지한다.
  USE_RUST_LAYOUT_ENGINE: true,

  // 전체 전환 — useLayoutPublisher(store 기반) + StoreRenderBridge(순수 함수) 활성화.
  // 소비처: BuilderCanvas, useCanvasRuntimeBootstrap.
  UNIFIED_ENGINE: true,
} as const;

export type UnifiedEngineFlag = keyof typeof UNIFIED_ENGINE_FLAGS;

/**
 * 선언된 플래그 값을 그대로 돌려준다.
 *
 * **Why (2026-08-15)**: 구 구현은 `if (UNIFIED_ENGINE_FLAGS.UNIFIED_ENGINE) return true;`
 * 로 시작해 `UNIFIED_ENGINE: true` 인 지금 **모든 플래그가 true 로 읽혔다** — 당시 표에
 * `false` 로 적혀 있던 6개가 거짓말이었다는 뜻이다. 소비자가 0건이라 무증상이었을 뿐,
 * 새 소비자가 붙는 순간 표를 읽고 "꺼져 있다" 고 판단한 쪽과 동작이 갈린다.
 *
 * 지금은 표에 `false` 항목이 하나도 없어 **런타임 값 비교로는 이 회귀를 잡을 수 없다** —
 * 그래서 `featureFlags.test.ts` 가 단락 평가 부재를 소스 텍스트로 확인한다.
 * `false` 플래그를 다시 도입하면 그때는 값 비교가 다시 물린다.
 */
export function isUnifiedFlag(flag: UnifiedEngineFlag): boolean {
  return UNIFIED_ENGINE_FLAGS[flag];
}
