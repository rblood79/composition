/**
 * 수동 가이드 개정 카운터 — ADR-181 Phase 3 (C11 (c))
 *
 * 가이드는 canonical `pageGuides` 에만 살고 스토어 미러가 없다
 * (`pagePositions` 가 `pagePositionsByBreakpoint` 스냅샷을 함께 갖는 것과
 * 갈리는 지점). 그래서 "가이드가 바뀌었다" 는 신호를 실어 나를 채널이 따로
 * 필요하다 — 스토어 구독으로는 잡히지 않는다.
 *
 * 신호는 **한 방향**이다: 문서를 바꾼 쪽이 `bumpPageGuideRevision()` 하고,
 * Skia RAF 루프가 구독해 `overlayVersionRef.current++` 한다.
 * **`invalidateContent()` 는 부르지 않는다** — 가이드는 오버레이 패스 전용이라
 * content surface 를 건드리지 않는다 (C11 — `pagePositionPresentation` 이
 * content 까지 무효화하는 것은 page root transform 이 바뀌기 때문이고, 가이드는
 * 그 축이 아니다).
 *
 * 값 자체는 canonical 문서에서 읽는다 — 이 모듈은 **개정 번호만** 나른다.
 * 드래그 중 transient 좌표 채널은 Phase 5 의 별개 관심사다.
 */

let revision = 0;
const listeners = new Set<() => void>();

/** 현재 개정 번호 — 구독자가 직전 값과 비교해 중복 무효화를 거른다 */
export function getPageGuideRevision(): number {
  return revision;
}

/** 가이드 문서 데이터가 바뀌었음을 알린다 (생성/이동/삭제/undo/redo 공용) */
export function bumpPageGuideRevision(): void {
  revision++;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribePageGuideRevision(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 테스트 전용 — 모듈 전역 상태 초기화 */
export function resetPageGuideRevisionForTest(): void {
  revision = 0;
  listeners.clear();
}
