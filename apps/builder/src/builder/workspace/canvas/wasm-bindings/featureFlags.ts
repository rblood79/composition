/**
 * WASM Feature Flags
 *
 * Canvas 렌더링 관련 WASM 모듈의 활성화 상태.
 * 모든 플래그는 하드코딩 — 환경변수 분기 없음.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §0.3 Feature Flag 인프라
 */

export const WASM_FLAGS = {
  /** Phase 1: SpatialIndex WASM 가속 (Rust wasm-pack 빌드 필요) */
  SPATIAL_INDEX: true,

  /** Phase 2: Layout Engine WASM 가속 (TaffyFlexEngine, TaffyGridEngine 의존) */
  LAYOUT_ENGINE: true,

  /** Phase 4: Layout Worker (Rust WASM 초기화 필요) */
  LAYOUT_WORKER: false,

  /** Phase 5: CanvasKit/Skia 렌더러 활성화 */
  CANVASKIT_RENDERER: true,

  /** Phase 6: 이중 Surface 캐싱 + Dirty Rect 렌더링 */
  DUAL_SURFACE_CACHE: true,
} as const;

/** 현재 렌더 모드 (skia 고정) */
export type RenderMode = "skia";

export function getRenderMode(): RenderMode {
  return "skia";
}

/** ADR-100: Unified Skia Engine — 점진 전환 flag */
export const UNIFIED_ENGINE_FLAGS = {
  // Phase 1: Layout Engine 교체
  // ADR-916 Phase 2-B seam C-2a (2026-07-04): 자체 taffy-free 엔진
  // (composition-engine) 으로 전환. dualRunLive 12/12(실전 대표 8형상 diff 0)
  // proof 확보 후 flip. rollback = 이 값을 false + UNIFIED_ENGINE global override
  // 확인(현재 UNIFIED_ENGINE:true 라 isUnifiedFlag 가 이미 true 반환 → 실제 rollback
  // 은 createLayoutEngine 진입 차단 또는 UNIFIED_ENGINE 조정 필요).
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
