/**
 * ADR-263 Phase 0 — 그리기 명령 층의 결정적 카운트.
 *
 * 프레임 하니스 (`perf-baseline.mjs` frame lane) 가 부류마다 reset → snapshot 해
 * `results.<부류>.counts.counters` 로 기록하고, ratchet (ADR-246) 이 그 값을 상한으로 막는다.
 * 호출부는 전부 `process.env.NODE_ENV === "development"` 게이트 안이라 production 빌드에서는
 * 사라진다. 고정 필드에 정수만 더한다 — 명령 하나마다 지나는 자리라 Map 조회를 두지 않는다.
 */
export interface RenderCounters {
  /** executeCommandRange 가 지난 명령 수 (record 재진입 포함). */
  execVisited: number;
  /** 그중 컬링 · 숨김으로 건너뛴 서브트리 안에서 소비한 명령 수. */
  execSkipped: number;
  /** 노드 picture 재생으로 건너뛴 self-draw 명령 수 (방문하지 않은 명령). */
  execPictureJumped: number;
  /** 컬링 · 숨김 서브트리를 끝으로 점프해 방문하지 않은 명령 수 (ADR-263 Phase 2). */
  execCulledJumped: number;
  /** full 재기록이 viewport 공간 질의 sequence 로 실행된 횟수. */
  viewportSequences: number;
  /** 공간 질의를 쓸 수 없어 선형 실행으로 간 횟수. */
  viewportFallbacks: number;
  /** content 재기록 중 damage 부분 재기록으로 끝난 수 (ADR-263 Phase 3). */
  contentDamageRenders: number;
  /** damage 가 있었으나 full 로 간 수 (전제 불충족 · 실패). */
  contentDamageFallbacks: number;
  /** full 재기록 수. */
  contentFullRenders: number;
  /** executeRenderCommands 호출 수. */
  execCalls: number;
  /** piece-table Proxy 의 index 읽기 수. */
  bufferProxyReads: number;
  /** executeRenderCommands 호출 시점의 segment 수 합계 (평평한 배열이면 0). */
  bufferSegmentsAtExec: number;
  /** scroll/auto 상자 extent 의 전체 descent 가 방문한 자손 수. */
  scrollRangeVisits: number;
  /** 전체 descent 횟수 (ADR-263 Phase 4 전에는 범위 계산마다 한 번). */
  scrollRangeCalls: number;
  /** extent 증분 갱신이 읽은 바뀐 서브트리 노드 수 (전 · 후 합). */
  scrollSubtreeVisits: number;
  /** applyCommitSubtreeCommandPatch 검증이 읽은 명령 수 (span 순회 합). */
  patchScanCommands: number;
  /** applyCommitSubtreeCommandPatch 호출 수. */
  patchCalls: number;
  /** 성공한 patch 의 교체 명령 수 (patch root 서브트리 크기). */
  patchWrites: number;
}

const counters: RenderCounters = {
  execVisited: 0,
  execSkipped: 0,
  execPictureJumped: 0,
  execCulledJumped: 0,
  viewportSequences: 0,
  viewportFallbacks: 0,
  contentDamageRenders: 0,
  contentDamageFallbacks: 0,
  contentFullRenders: 0,
  execCalls: 0,
  bufferProxyReads: 0,
  bufferSegmentsAtExec: 0,
  scrollRangeVisits: 0,
  scrollRangeCalls: 0,
  scrollSubtreeVisits: 0,
  patchScanCommands: 0,
  patchCalls: 0,
  patchWrites: 0,
};

/** 카운터 객체 — 호출부가 필드를 직접 더한다 (dev 게이트 안에서만). */
export const renderCounters: RenderCounters = counters;

export function snapshotRenderCounters(): RenderCounters {
  return { ...counters };
}

export function resetRenderCounters(): void {
  for (const key of Object.keys(counters) as Array<keyof RenderCounters>)
    counters[key] = 0;
}

/**
 * live 픽셀 대조용 스위치 (dev 전용) — 같은 상태를 다른 경로로 그려 비교한다.
 * `linearOnly`: full 재기록이 viewport 공간 질의 대신 선형 실행 (컬링 점프 없음) 으로 간다.
 * `damageOff`: damage 부분 재기록 대신 full 로 그린다.
 */
export const renderDebug = { linearOnly: false, damageOff: false };

if (process.env.NODE_ENV === "development" && typeof window !== "undefined") {
  const debug = ((
    window as unknown as Record<string, unknown>
  ).__composition_RENDER_PATH_DEBUG__ ??= {}) as Record<string, unknown>;
  debug.setLinearOnly = (on: boolean) => {
    renderDebug.linearOnly = on;
  };
  debug.setDamageOff = (on: boolean) => {
    renderDebug.damageOff = on;
  };
  (
    window as unknown as {
      __composition_RENDER_COUNTERS__?: {
        snapshot: typeof snapshotRenderCounters;
        reset: typeof resetRenderCounters;
      };
    }
  ).__composition_RENDER_COUNTERS__ = {
    snapshot: snapshotRenderCounters,
    reset: resetRenderCounters,
  };
}
