/**
 * 수동 가이드 드래그 transient 채널 — ADR-181 Phase 5 (C6 계약 승계)
 *
 * 드래그 중에는 canonical 을 **한 번도** 쓰지 않는다 (HC1(c) — write/히스토리/
 * persist 각 0). 화면에 보이는 위치는 여기에만 있고, pointerup 에서 1회
 * commit 한다. `pagePositionPresentation` 과 같은 어법이다.
 *
 * 다른 점 하나: 위치 override 를 map 으로 들지 않고 **드래그 1건**만 든다.
 * 페이지 드래그는 다중 선택이 있지만 가이드는 한 번에 하나만 잡기 때문이다.
 *
 * 재렌더 신호는 별도로 두지 않고 `pageGuideRevision` 을 그대로 올린다 —
 * 가이드가 바뀌었다는 사실은 출처(문서 편집 / 히스토리 / 드래그)와 무관하게
 * 오버레이에는 같은 의미다 (C11).
 */

import type { PageGuideLine } from "@composition/shared";

import { bumpPageGuideRevision } from "./pageGuideRevision";

export interface GuideDragState {
  /** "create" = 눈금자에서 새로 끌어냄, "move" = 기존 가이드 이동 */
  kind: "create" | "move";
  guideId: string;
  axis: "x" | "y";
  /**
   * 현재 소속 페이지. create 드래그가 아직 어느 페이지 위에도 없으면 null —
   * 놓아도 커밋하지 않는다 (C9 — 가이드 좌표는 페이지-로컬).
   */
  pageId: string | null;
  /** 페이지-로컬 px */
  position: number;
  /** 눈금자 위로 되돌린 상태 — 놓으면 삭제 (Figma 어법) */
  removing: boolean;
  /** move 시작 시점의 소속 페이지·위치 (커밋 시 before 목록 산출) */
  originPageId: string | null;
  originPosition: number;
  /**
   * 커서의 scene 좌표 (해당 축). **소속 페이지와 무관하게 항상 채운다.**
   *
   * 드래그는 언제나 눈금자 위 = 페이지 밖에서 시작하므로, 소속이 정해진
   * 뒤에만 그리면 사용자는 "끌기 시작 → 아무 일도 없음" 을 먼저 겪는다
   * (2026-08-14 사용자 보고 — "드래그 시작시 바로 가이드가 나타나는 것을
   * 기대"). 이 값이 그 구간의 미리보기 좌표다.
   */
  scenePosition: number | null;
}

/** 소속 없는 드래그의 미리보기 — 뷰포트를 가로지르는 선 1개 */
export interface GuideDragPreview {
  axis: "x" | "y";
  scenePosition: number;
}

let dragState: GuideDragState | null = null;

export function getGuideDrag(): GuideDragState | null {
  return dragState;
}

export function beginGuideDrag(state: GuideDragState): void {
  dragState = { ...state };
  bumpPageGuideRevision();
}

/** 드래그 중 갱신 — 값이 바뀐 프레임에만 notify (pagePositionPresentation 어법) */
export function publishGuideDrag(
  patch: Partial<
    Pick<GuideDragState, "pageId" | "position" | "removing" | "scenePosition">
  >,
): void {
  if (!dragState) return;
  const next = { ...dragState, ...patch };
  if (
    next.pageId === dragState.pageId &&
    next.position === dragState.position &&
    next.removing === dragState.removing &&
    next.scenePosition === dragState.scenePosition
  ) {
    return;
  }
  dragState = next;
  bumpPageGuideRevision();
}

export function endGuideDrag(): void {
  if (!dragState) return;
  dragState = null;
  bumpPageGuideRevision();
}

/**
 * canonical 목록에 드래그 중 상태를 얹은 렌더용 목록.
 *
 * 드래그가 없으면 **입력을 그대로 돌려준다** — 통상 경로에서 할당 0
 * (프레임마다 불린다).
 */
export function mergeGuideDrag(
  canonical: ReadonlyMap<string, readonly PageGuideLine[]>,
  drag: GuideDragState | null,
): ReadonlyMap<string, readonly PageGuideLine[]> {
  if (!drag) return canonical;

  const merged = new Map(canonical);
  // 이동/삭제 대상은 원래 페이지에서 먼저 뺀다 — 되돌리는 중이면 이걸로 끝
  if (drag.originPageId) {
    const origin = merged.get(drag.originPageId);
    if (origin) {
      const without = origin.filter((line) => line.id !== drag.guideId);
      if (without.length > 0) merged.set(drag.originPageId, without);
      else merged.delete(drag.originPageId);
    }
  }
  if (drag.removing || !drag.pageId) return merged;

  const target = merged.get(drag.pageId) ?? [];
  merged.set(drag.pageId, [
    ...target,
    { id: drag.guideId, axis: drag.axis, position: drag.position },
  ]);
  return merged;
}

/**
 * 아직 소속이 없는 드래그의 미리보기 — 뷰포트를 가로지르는 선.
 *
 * `mergeGuideDrag` 와 **배타**다. 소속이 정해지면 그쪽이 페이지에 클립된
 * 선으로 그리고, 여기서는 null 을 준다. 두 표현이 갈리는 것이 이 설계의
 * 요점이다: 선이 페이지 안으로 들어가 잘리는 순간이 곧 "여기 놓으면
 * 붙는다" 는 신호다. 전부 뷰포트 선으로 통일하면 그 정보가 사라진다.
 *
 * `removing`(이동 중 눈금자로 되돌림)이면 그리지 않는다 — 사라지는 것이
 * "놓으면 삭제" 의 피드백이다.
 */
export function resolveGuideDragPreview(
  drag: GuideDragState | null,
): GuideDragPreview | null {
  if (!drag || drag.removing || drag.pageId !== null) return null;
  if (drag.scenePosition === null) return null;
  return { axis: drag.axis, scenePosition: drag.scenePosition };
}

/**
 * 이 가이드가 페이지를 지나는가 (position 은 **페이지-로컬**, C9).
 *
 * 두 곳이 이 판정을 쓴다 — 드래그가 "페이지 밖으로 나갔으니 삭제" 를 정할 때
 * (`useGuideDrag`) 와, 렌더러가 "연장할 본체가 없다" 를 정할 때
 * (`renderGuideExtension`). 같은 규칙이므로 한 함수여야 한다: 갈리면 한쪽은
 * 지웠다고 보고 다른 쪽은 계속 그리는, **지워진 줄 알았는데 점선만 남는**
 * 상태가 된다 (2026-08-14 사용자 보고).
 *
 * 경계(0 / extent)는 **안쪽**이다 — 페이지 가장자리에 맞춘 가이드는 정당한
 * 사용이고, 실제로 가장 자주 놓이는 자리다.
 */
export function isGuideWithinPage(
  axis: "x" | "y",
  position: number,
  page: { width: number; height: number },
): boolean {
  const extent = axis === "x" ? page.width : page.height;
  return position >= 0 && position <= extent;
}

/** 테스트 전용 */
export function resetGuideDragForTest(): void {
  dragState = null;
}
