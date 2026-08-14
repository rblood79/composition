/**
 * 수동 가이드 강조 상태 — ADR-181 후속 (Figma 어법)
 *
 * 가이드는 세 상태로 그려진다 (2026-08-14 사용자의 Figma 직접 확인):
 *
 * | 상태     | 서는 조건                  | 표현                      |
 * | -------- | -------------------------- | ------------------------- |
 * | default  | —                          | 웜 레드 + 알파            |
 * | hover    | 포인터가 잡을 수 있는 거리 | 웜 레드 불투명 + 연장     |
 * | selected | 클릭·드래그가 **끝난** 뒤  | 하늘색 + 연장             |
 *
 * 방향 끝까지의 **연장은 두 상태가 공유**한다 (색만 갈린다) — 연장이 답하는
 * 질문은 "이 선이 어디까지 가는가" 이고, 그건 선택했을 때가 아니라 그 선을
 * 만지는 모든 순간에 필요하다. 끌고 있는 가이드는 hover 로 취급한다
 * (`skiaOverlayBuilder` — hover 이벤트를 거쳤는지에 강조가 좌우되지 않게).
 *
 * 선택이 pointerdown 이 아니라 **pointerup** 에 서는 것이 계약이다 — 잡고 있는
 * 동안은 웜 컬러로 남는다. 선택은 "무엇을 조작 중인가" 가 아니라 "무엇을
 * 조작했나" 의 결과이고, 잡고 있다는 신호는 이미 hover 알파와 커서가 준다
 * (거처: `useGuideDrag` 의 `applyDragEndSelection`).
 *
 * hover 와 selected 를 **한 모듈에 두는 이유**는 둘 사이의 우선순위 때문이다.
 * 선택된 가이드에 마우스를 올려도 하늘색이 유지돼야 하므로 어느 쪽이 이기는지를
 * 정해야 하는데, 그 규칙이 두 곳에 흩어지면 렌더러와 히트 판정이 서로 다른
 * 답을 낼 수 있다. `resolveGuideEmphasis` 가 그 유일한 거처다.
 *
 * hover 는 **조작 affordance** ("이건 잡을 수 있다") 라 눈금자 ON 일 때만 선다
 * — 히트 판정을 도는 `useGuideHoverCursor` 자체가 ON 한정이다 (C10). 가이드
 * 표시가 눈금자와 독립인 것과 갈리지만, OFF 상태에서 잡을 수 없는 선을 강조해도
 * 뜻이 없으므로 이쪽이 맞다.
 *
 * 둘 다 **문서가 아니라 UI 상태**다 — persist 하지 않고 undo 대상도 아니다.
 * 그래서 canonical(`pageGuides`) 이 아니라 이 모듈에 있고, 새로고침하면
 * 사라진다. 같은 이유로 `page-guide` 히스토리 entry 도 만들지 않는다.
 *
 * 재렌더 신호는 `pageGuideRevision` 을 그대로 올린다 — 가이드 표시가 바뀌었다는
 * 사실은 출처(문서 편집 / 드래그 / 선택 / hover)와 무관하게 오버레이엔 같은
 * 의미다 (C11 어법 승계, `guidePresentation` 과 동일). 두 setter 모두 값이
 * 실제로 바뀔 때만 올리므로, 프레임마다 불리거나 같은 가이드 위에서 포인터가
 * 움직이는 동안에는 무효화가 일어나지 않는다.
 *
 * 선택은 한 번에 **하나만**이고 요소 선택과도 배타다 — 둘 다 "지금 무엇을
 * 조작 중인가" 를 나타내므로 동시에 서면 Escape·Delete 가 어느 쪽을 향하는지
 * 알 수 없다.
 */

import { bumpPageGuideRevision } from "./pageGuideRevision";

export interface GuideRef {
  pageId: string;
  guideId: string;
}

/** 선택 상태 — 이름을 유지하는 것은 소비처(Escape 처리 등)의 어법 때문 */
export type SelectedGuide = GuideRef;

export type GuideEmphasis = "default" | "hover" | "selected";

/** 한 페이지 안에서 강조 대상인 가이드 id — 없으면 null */
export interface GuideEmphasisIds {
  selectedGuideId: string | null;
  hoveredGuideId: string | null;
}

const NO_EMPHASIS: GuideEmphasisIds = {
  selectedGuideId: null,
  hoveredGuideId: null,
};

let selected: GuideRef | null = null;
let hovered: GuideRef | null = null;

export function getSelectedGuide(): SelectedGuide | null {
  return selected;
}

export function getHoveredGuide(): GuideRef | null {
  return hovered;
}

/** 같은 가이드를 다시 지정하면 no-op — 프레임마다 불려도 무효화하지 않는다 */
export function setSelectedGuide(next: SelectedGuide | null): void {
  if (next === null) {
    clearGuideSelection();
    return;
  }
  if (isSame(selected, next)) return;
  selected = { ...next };
  bumpPageGuideRevision();
}

/**
 * hover 는 pointermove 마다 불린다 — 같은 가이드 위에서 움직이는 동안에는
 * 값이 그대로라 무효화가 없다. 가이드를 벗어나거나 다른 가이드로 넘어갈 때만
 * 한 번씩 신호가 나간다.
 */
export function setHoveredGuide(next: GuideRef | null): void {
  if (next === null) {
    if (hovered === null) return;
    hovered = null;
    bumpPageGuideRevision();
    return;
  }
  if (isSame(hovered, next)) return;
  hovered = { ...next };
  bumpPageGuideRevision();
}

export function clearGuideSelection(): void {
  if (selected === null) return;
  selected = null;
  bumpPageGuideRevision();
}

/**
 * 해당 페이지의 강조 대상 id 2종.
 *
 * 페이지 대조를 여기서 하는 이유는 소비처가 둘이기 때문이다 — 렌더러가 직접
 * `pageId` 를 비교하면 hover 와 selected 에서 같은 비교를 두 번 쓰게 되고,
 * 한쪽만 고쳐지는 형태로 어긋난다.
 */
export function resolveGuideEmphasisIdsForPage(
  pageId: string,
): GuideEmphasisIds {
  if (selected === null && hovered === null) return NO_EMPHASIS;
  return {
    selectedGuideId: selected?.pageId === pageId ? selected.guideId : null,
    hoveredGuideId: hovered?.pageId === pageId ? hovered.guideId : null,
  };
}

/**
 * 강조 우선순위 — **선택이 hover 를 이긴다**.
 *
 * 선택된 가이드에 마우스를 올려도 하늘색이 유지된다. 반대로 두면 선택 표식이
 * 포인터 위치에 따라 깜빡여, "지금 무엇이 선택돼 있나" 를 읽을 수 없게 된다.
 */
export function resolveGuideEmphasis(
  guideId: string,
  ids: GuideEmphasisIds,
): GuideEmphasis {
  if (ids.selectedGuideId === guideId) return "selected";
  if (ids.hoveredGuideId === guideId) return "hover";
  return "default";
}

function isSame(a: GuideRef | null, b: GuideRef): boolean {
  return a !== null && a.pageId === b.pageId && a.guideId === b.guideId;
}

/** 테스트 전용 */
export function resetGuideEmphasisForTest(): void {
  selected = null;
  hovered = null;
}
