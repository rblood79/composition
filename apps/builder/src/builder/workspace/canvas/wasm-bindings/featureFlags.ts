/**
 * WASM Feature Flags
 *
 * Canvas 렌더링 관련 WASM 모듈의 활성화 상태.
 * 모든 플래그는 하드코딩 — 환경변수 분기 없음.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §0.3 Feature Flag 인프라
 */

export const WASM_FLAGS = {
  /** SpatialIndex WASM 가속 (composition-engine pkg — ADR-916 crate 분리 편입) */
  SPATIAL_INDEX: true,

  /** CanvasKit/Skia 렌더러 활성화 */
  CANVASKIT_RENDERER: true,

  /** 이중 Surface 캐싱 + Dirty Rect 렌더링 */
  DUAL_SURFACE_CACHE: true,
} as const;

/** 현재 렌더 모드 (skia 고정) */
export type RenderMode = "skia";

export function getRenderMode(): RenderMode {
  return "skia";
}

/**
 * ADR-100 Unified Skia Engine 전환 flag — **전환 완료 후 잔존 2개**.
 *
 * 2026-08-15 잔재 스윕에서 소비자 0건인 8개
 * (`USE_DOM_HOVER` / `USE_DOM_CURSOR` / `USE_CAMERA_OBJECT` / `USE_SCENE_GRAPH` /
 * `USE_HYBRID_TEXT` / `USE_CSS3_EFFECTS` / `USE_TILE_CACHE` / `REMOVE_PIXI`)를
 * 삭제했다. 전환 계획과 완료 사실은 ADR-100/900 과 CHANGELOG 가 기록한다 —
 * 소비자 없는 플래그로 중복 보관하면 **"토글할 수 있는 것" 으로 잘못 읽힌다.**
 * 실제로 `USE_CAMERA_OBJECT` 는 같은 날 삭제된 `viewport/Camera.ts` 를,
 * `REMOVE_PIXI` 는 이미 사라진 PixiJS ticker 정지 경로를 가리키고 있었다.
 *
 * 남은 2개는 **실소비자가 있어서** 남는다. 새 플래그를 넣을 때도 같은 기준:
 * 소비처가 없으면 표가 아니라 문서에 적을 것.
 */
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
