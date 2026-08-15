export interface GPUMetrics {
  // `vramUsed` / `textureCount` / `spriteCount` / `elementCount` 는 삭제됐다
  //   (2026-08-15). 제거된 렌더러 시대 지표라 setter 호출부가 0건이었다 —
  //   앞의 3개는 상시 0 인 채로 성능 오버레이에 표시되고 있었고, `elementCount`
  //   는 판독자조차 없었다. 요소 수는 `utils/performanceMonitor.ts` 의
  //   `PerformanceMetrics.elementCount` 가 canonical 에서 실측한다 (별개·live).
  //   Skia 대응물이 필요하면 CanvasKit 계측을 새로 붙이고 그때 필드를 추가한다.
  lastFrameTime: number;
  averageFps: number;
  boundsLookupAvgMs: number;
  cullingFilterAvgMs: number;
  blockLayoutAvgMs: number;
  gridLayoutAvgMs: number;
  skiaFrameTimeAvgMs: number;
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
