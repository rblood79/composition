/**
 * 문서 저장 호출 추적 — ADR-243 HC3 완료 시간 종점.
 *
 * 저장 트랜잭션이 아니라 **저장 호출**을 센다: `IncrementalDocuments.put` 이 호출되는 순간
 * (직렬화 `splitDocument` 전) 대기 수 +1, 그 작업이 끝나면 (성공 · 실패 모두) −1. 하니스는
 * `__composition_PERF__.persistState()` 로 읽는다. 동작 변경 0 — 호출 결과를 그대로 돌려준다.
 */

export interface PersistActivityState {
  /** 시작했지만 끝나지 않은 저장 호출 수 */
  pending: number;
  /** 지금까지 시작한 저장 호출 수 */
  started: number;
  /** 마지막 저장 호출 시작 시각 (performance.now, 없으면 null) */
  lastStartAt: number | null;
  /** 마지막 저장 호출 종료 시각 (performance.now, 없으면 null) */
  lastEndAt: number | null;
}

const state: PersistActivityState = {
  pending: 0,
  started: 0,
  lastStartAt: null,
  lastEndAt: null,
};

export function trackPersistCall<T>(work: () => Promise<T>): Promise<T> {
  state.pending += 1;
  state.started += 1;
  state.lastStartAt = performance.now();
  const settle = () => {
    state.pending -= 1;
    state.lastEndAt = performance.now();
  };
  let result: Promise<T>;
  try {
    result = work();
  } catch (error) {
    settle();
    throw error;
  }
  result.then(settle, settle);
  return result;
}

export function getPersistActivityState(): PersistActivityState {
  return { ...state };
}
