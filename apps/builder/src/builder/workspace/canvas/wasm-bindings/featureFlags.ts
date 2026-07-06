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
  USE_DOM_HOVER: false,
  USE_DOM_CURSOR: false,
  USE_CAMERA_OBJECT: false,
  USE_SCENE_GRAPH: true,
  REMOVE_PIXI: true,

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

export function isUnifiedFlag(flag: UnifiedEngineFlag): boolean {
  if (UNIFIED_ENGINE_FLAGS.UNIFIED_ENGINE) return true;
  return UNIFIED_ENGINE_FLAGS[flag];
}
