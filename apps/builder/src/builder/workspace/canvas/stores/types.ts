export interface GPUMetrics {
  vramUsed: number;
  textureCount: number;
  spriteCount: number;
  lastFrameTime: number;
  averageFps: number;
  boundsLookupAvgMs: number;
  cullingFilterAvgMs: number;
  blockLayoutAvgMs: number;
  gridLayoutAvgMs: number;
  skiaFrameTimeAvgMs: number;
  elementCount: number;
  contentRenderTimeMs: number;
  blitTimeMs: number;
  idleFrameRatio: number;
  dirtyRectCountAvg: number;
  contentRendersPerSec: number;
  registryChangesPerSec: number;
  presentFramesPerSec: number;
  skiaTreeBuildTimeMs: number;
  selectionBuildTimeMs: number;
  aiBoundsBuildTimeMs: number;
  /** ADR-153 Phase 1-b: content 렌더당 커맨드 스트림 길이 (이동 평균) */
  commandCountAvg: number;
  /** ADR-153 Phase 1-b: content 렌더당 CMD_DRAW 디스패치 수 (컬링 통과분, 이동 평균) */
  drawCallCountAvg: number;
  /** ADR-153 Phase 1-c: GPU 측 프레임 실행 시간 ms (timer query, 미지원 시 0 유지) */
  gpuFrameTimeMs: number;
}

export interface CanvasViewportSnapshot {
  panOffset: { x: number; y: number };
  zoom: number;
}
