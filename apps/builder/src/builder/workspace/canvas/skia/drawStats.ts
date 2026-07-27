/**
 * Draw-call 카운터 (ADR-153 Phase 1-b)
 *
 * executeRenderCommands 의 커맨드 수 + CMD_DRAW 디스패치 수를 프레임 단위로
 * 누적한다. 호출부는 전부 `process.env.NODE_ENV === "development"` 게이트 안에
 * 있어 production 빌드에서는 dead-code 제거된다.
 *
 * 소비: SkiaRenderer.renderContent 가 content 렌더 직후 takeDrawStats() 로
 * 회수하여 wasmTrackers (commandCount / drawCallCount) 에 기록한다.
 */

let commandCount = 0;
let drawCallCount = 0;

/** 커맨드 스트림 실행 시 스트림 길이를 누적한다. */
export function addCommandCount(n: number): void {
  commandCount += n;
}

/** CMD_DRAW 타입별 렌더 디스패치 1회를 누적한다 (컬링 통과분만). */
export function incrementDrawCall(): void {
  drawCallCount++;
}

/** 누적치를 회수하고 카운터를 리셋한다 (content 렌더 1회 단위). */
export function takeDrawStats(): { commands: number; draws: number } {
  const stats = { commands: commandCount, draws: drawCallCount };
  commandCount = 0;
  drawCallCount = 0;
  return stats;
}
