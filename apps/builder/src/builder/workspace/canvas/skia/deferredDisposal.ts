/**
 * WASM 객체 지연 폐기 큐 (ADR-174 Phase 1)
 *
 * CanvasKit canvas 의 draw 호출은 surface `flush` 까지 **deferred** 다 —
 * `drawParagraph`/`drawPicture` 로 제출된 Paragraph/SkPicture 를 flush 전에
 * `.delete()` 하면 use-after-free 가 되어 해당 draw 가 조용히 소실된다
 * (에러도 로그도 없이 그 텍스트/노드만 화면에서 빠진다).
 *
 * 실측 (ADR-174 Phase 0, 5,069 요소 문서): 한 walk 의 텍스트 draw 노드 3,372 —
 * 고유 캐시 키가 상한(1,000)을 넘는 문서 형태에서는 walk 앞쪽 paragraph 가
 * LRU 퇴거로 파괴된다. nodePictureCache (상한 1,024) 는 같은 문서에서 evict
 * 28만 회로 이미 상시 퇴거 상태다. 두 자원 모두 같은 병리를 갖는다.
 *
 * 규율: 프레임 중 발생하는 캐시 퇴거/교체/무효화의 `.delete()` 는 **전부** 이
 * 큐를 경유한다. 호출 지점이 "지금이 프레임 안인가" 를 판단하지 않게 하려는
 * 것이라 프레임 밖 정리도 같은 경로를 쓰고, 대신 그 경로가 곧바로 `drain` 을
 * 이어 부른다 (teardown/HMR/레지스트리 일괄 정리).
 *
 * drain 지점은 둘이다 (R3 — 큐 적체 방지):
 * - `SkiaRenderer.render()` finally — 프레임의 모든 flush 뒤
 * - 프레임 밖 일괄 정리 경로 — hidden 탭에서 rAF 가 멈춰 flush 가 오래
 *   없더라도 큐가 무한 적체하지 않게 한다
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
