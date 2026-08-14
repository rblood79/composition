/**
 * 수동 가이드 선택 — ADR-181 후속 (Figma 어법)
 *
 * 가이드를 클릭하면 선택되고, 선택된 가이드만 **선의 방향 끝까지** 연장돼
 * 보인다 (페이지를 벗어난 구간은 점선 — `renderSelectedGuideExtension`).
 * 연장 자체가 선택 표식이라, 요소 선택처럼 별도 박스·핸들을 두지 않는다.
 *
 * **문서가 아니라 UI 상태**다 — persist 하지 않고 undo 대상도 아니다. 그래서
 * canonical(`pageGuides`) 이 아니라 이 모듈에 있고, 새로고침하면 사라진다.
 * 같은 이유로 `page-guide` 히스토리 entry 도 만들지 않는다.
 *
 * 재렌더 신호는 `pageGuideRevision` 을 그대로 올린다 — 가이드 표시가 바뀌었다는
 * 사실은 출처(문서 편집 / 드래그 / 선택)와 무관하게 오버레이엔 같은 의미다
 * (C11 어법 승계, `guidePresentation` 과 동일).
 *
 * 한 번에 **하나만** 선택된다. 요소 선택과도 배타다 — 둘 다 "지금 무엇을
 * 조작 중인가" 를 나타내므로 동시에 서면 Escape·Delete 가 어느 쪽을 향하는지
 * 알 수 없다.
 */

import { bumpPageGuideRevision } from "./pageGuideRevision";

export interface SelectedGuide {
  pageId: string;
  guideId: string;
}

let selected: SelectedGuide | null = null;

export function getSelectedGuide(): SelectedGuide | null {
  return selected;
}

export function isGuideSelected(pageId: string, guideId: string): boolean {
  return (
    selected !== null &&
    selected.pageId === pageId &&
    selected.guideId === guideId
  );
}

/** 같은 가이드를 다시 지정하면 no-op — 프레임마다 불려도 무효화하지 않는다 */
export function setSelectedGuide(next: SelectedGuide | null): void {
  if (next === null) {
    clearGuideSelection();
    return;
  }
  if (selected?.pageId === next.pageId && selected?.guideId === next.guideId) {
    return;
  }
  selected = { ...next };
  bumpPageGuideRevision();
}

export function clearGuideSelection(): void {
  if (selected === null) return;
  selected = null;
  bumpPageGuideRevision();
}

/** 테스트 전용 */
export function resetGuideSelectionForTest(): void {
  selected = null;
}
