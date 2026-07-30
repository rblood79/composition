/**
 * WASM 객체 지연 폐기 큐 (2026-07-30 텍스트 소실 수정)
 *
 * CanvasKit canvas 의 draw 호출은 surface `flush` 까지 **deferred** 다 —
 * `drawParagraph`/`drawPicture` 로 제출된 Paragraph/SkPicture 를 flush 전에
 * `.delete()` 하면 use-after-free 가 되어 해당 draw 가 조용히 소실된다
 * (에러도 로그도 없이 그 텍스트/노드만 화면에서 빠진다).
 *
 * 실측 (2026-07-30, 5,046 요소 문서): 가시 텍스트 1,416 > paragraphCache
 * 상한 1000 → 한 walk 안에서 먼저 그린 paragraph 가 LRU 퇴거로 파괴 →
 * "컴포넌트 텍스트가 불특정하게 렌더되지 않는" 사용자 보고. nodePictureCache
 * (상한 1024, evict 30만 회 관측) 도 같은 병리.
 *
 * 규율: 프레임 중 발생하는 캐시 퇴거/교체/무효화의 `.delete()` 는 전부 이
 * 큐를 경유하고, SkiaRenderer 가 프레임의 모든 flush **후** `drain` 한다.
 * teardown/HMR 처럼 프레임 밖 정리는 clear 후 즉시 drain 하면 된다.
 */

interface WasmDeletable {
  delete(): void;
}

const pending: WasmDeletable[] = [];

/** 프레임 flush 후로 폐기를 미룬다 — 프레임 중 delete 의 유일한 정본 경로 */
export function scheduleWasmDisposal(obj: WasmDeletable): void {
  pending.push(obj);
}

/** 프레임의 모든 surface flush 후 호출 — 미뤄 둔 폐기를 일괄 수행 */
export function drainPendingWasmDisposals(): void {
  if (pending.length === 0) return;
  for (const obj of pending) {
    obj.delete();
  }
  pending.length = 0;
}

/** 테스트/진단용 — 대기 중 폐기 수 */
export function getPendingWasmDisposalCount(): number {
  return pending.length;
}
