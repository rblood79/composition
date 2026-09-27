/**
 * ADR-247 Phase 2 — presented 직후 idle 에 스냅샷을 한 번 쓴다. 기록기 (`shellSnapshot.ts`) 는 이때
 * 동적 import 한다 — cold entry 의 initial 번들에 싣지 않는다 (HC5).
 * 반환값은 취소 함수 (presented 뒤 곧바로 unmount · 프로젝트 전환).
 */
export function scheduleShellSnapshotWrite(): () => void {
  let cancelled = false;
  const write = () => {
    void import("./shellSnapshot")
      .then((module) => {
        if (!cancelled) module.writeShellSnapshot();
      })
      .catch(() => {
        // chunk 로드 실패 — 다음 진입은 최소 셸이다 (HC6).
      });
  };
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(write, { timeout: 2000 });
    return () => {
      cancelled = true;
      cancelIdleCallback(handle);
    };
  }
  const handle = window.setTimeout(write, 0);
  return () => {
    cancelled = true;
    window.clearTimeout(handle);
  };
}
