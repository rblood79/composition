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

/** ADR-100: Unified Skia Engine — 점진 전환 flag */
export const UNIFIED_ENGINE_FLAGS = {
  // Phase 1: Layout Engine — ADR-916 Taffy 완전 제거(2026-07-06) 후 자체 엔진
  // (composition-engine)이 상시 단독 경로. key 자체를 제거하면 init.ts 의
  // isUnifiedFlag("USE_RUST_LAYOUT_ENGINE") 가 UnifiedEngineFlag union 에서
  // 빠져 컴파일 에러 — 소비처 영향 최소화를 위해 key 를 상수 true 로 유지한다.
  USE_RUST_LAYOUT_ENGINE: true,

  // Phase 2: PixiJS 점진 제거
  //   `REMOVE_PIXI` 는 삭제됐다 (2026-08-15). 유일한 소비처였던
  //   `useCanvasRuntimeBootstrap.handlePixiAppInit`(PixiJS ticker 정지 +
  //   배경 alpha 0) 가 ADR-900 잔재 스윕에서 함께 제거되며 소비자 0건이 됐다.
  //   PixiJS 제거 완료 사실은 ADR-900 과 CHANGELOG 가 기록한다 — 소비자 없는
  //   플래그로 중복 보관하면 "토글할 수 있는 것" 으로 잘못 읽힌다.
  USE_DOM_HOVER: false,
  USE_DOM_CURSOR: false,
  USE_CAMERA_OBJECT: false,
  USE_SCENE_GRAPH: true,

  // Phase 3: 렌더링 확장
  USE_HYBRID_TEXT: false,
  USE_CSS3_EFFECTS: false,

  // Phase 4: 성능
  USE_TILE_CACHE: false,

  // 전체 전환 — Box/Text/Image Sprite 정밀 이�� 완료 (Phase 6.5-6.7)
  // useLayoutPublisher(store 기반) + StoreRenderBridge(순수 함수) 활성화
  UNIFIED_ENGINE: true,
} as const;

export type UnifiedEngineFlag = keyof typeof UNIFIED_ENGINE_FLAGS;

/**
 * 선언된 플래그 값을 그대로 돌려준다.
 *
 * **Why (2026-08-15)**: 구 구현은 `if (UNIFIED_ENGINE_FLAGS.UNIFIED_ENGINE) return true;`
 * 로 시작해 `UNIFIED_ENGINE: true` 인 지금 **모든 플래그가 true 로 읽혔다** — 위 표에
 * `false` 로 적힌 6개(USE_DOM_HOVER / USE_DOM_CURSOR / USE_CAMERA_OBJECT /
 * USE_HYBRID_TEXT / USE_CSS3_EFFECTS / USE_TILE_CACHE)가 거짓말이었다는 뜻이다.
 * 오늘은 그 6개의 소비자가 0건이라 무증상이지만, 새 소비자가 붙는 순간 표를 읽고
 * "꺼져 있다" 고 판단한 쪽과 실제 동작이 갈린다. 현행 소비자
 * (UNIFIED_ENGINE / USE_RUST_LAYOUT_ENGINE)는 전부 `true` 선언이라 단락 평가를
 * 걷어내도 동작은 동일하다.
 */
export function isUnifiedFlag(flag: UnifiedEngineFlag): boolean {
  return UNIFIED_ENGINE_FLAGS[flag];
}
