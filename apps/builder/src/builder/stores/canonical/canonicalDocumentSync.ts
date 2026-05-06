/**
 * @fileoverview Canonical document project lifecycle sync — ADR-116 direct cutover
 *
 * direct cutover 이후 canonical document 의 actual hydration/write-through 는
 * canonical primary wrappers (`setElementsCanonicalPrimary`,
 * `mergeElementsCanonicalPrimary`) 가 담당한다.
 *
 * 본 모듈은 Builder route 의 active project id 를 canonical store 에 알려주는
 * lifecycle entrypoint 로만 남긴다. legacy snapshot 을 `CompositionDocument` 로
 * 재구성하는 projection sync 는 제거한다.
 *
 * **caller-driven 전환 사유 (Step 1b dev 검증)**:
 * - 초기 design 은 `useDataStore.currentProjectId` subscribe 로 trigger 했으나,
 *   사용자 dev 환경에서 `useDataStore.isInitialized === false` (init useEffect 가
 *   sequential await 중 stuck 또는 condition skip) 로 인해 currentProjectId 가
 *   영구 null. dataStore 의존 자체가 fragile.
 * - caller (BuilderCore) 는 `useParams<{ projectId }>()` 로 routing 시점에 즉시
 *   projectId 를 알고 있음 → caller 가 명시 전달이 robust.
 *
 * `setSyncScheduler` / `isSyncScheduled` 는 기존 tests/diagnostics 호환을 위해
 * no-op surface 로 유지한다.
 */

import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

// ─────────────────────────────────────────────
// Sync state
// ─────────────────────────────────────────────

let syncScheduled = false;

// ─────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────

/**
 * canonical document project lifecycle 시작.
 *
 * @param projectId — 활성 project id. caller (BuilderCore) 가 useParams 로
 *   가져온 routing 값을 명시 전달.
 * @returns cleanup 함수. 호출 시 canonical store
 *   currentProjectId 를 null 로 reset (다른 project sync 시작 시 충돌 방지).
 *
 * @example
 *   const stop = startCanonicalDocumentSync(projectId);
 *   // ... Builder 작업
 *   stop(); // cleanup (route 이탈 시)
 */
export function startCanonicalDocumentSync(projectId: string): () => void {
  const canonical = useCanonicalDocumentStore.getState();
  if (canonical.currentProjectId !== projectId) {
    canonical.setCurrentProject(projectId);
  }

  return () => {
    // canonical store 의 currentProjectId 를 null 로 reset — 다른 project sync
    // 시작 시 stale 데이터 노출 방지.
    useCanonicalDocumentStore.getState().setCurrentProject(null);
  };
}

// ─────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────

/**
 * scheduler override — vitest 에서 `(cb) => cb()` 로 즉시 실행하여
 * microtask flush 대기 없이 결과 검증.
 *
 * @internal — production 코드는 default `queueMicrotask` 의존.
 */
export function setSyncScheduler(fn: (cb: () => void) => void): void {
  void fn;
}

/** scheduler reset — projection sync 제거 이후 no-op. */
export function resetSyncScheduler(): void {
  syncScheduled = false;
}

/** test 전용 — 현재 schedule 대기 상태 노출. */
export function isSyncScheduled(): boolean {
  return syncScheduled;
}
