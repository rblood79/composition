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
   * 이때는 미리보기를 그리지 않는다 (놓아도 커밋하지 않는다).
   */
  pageId: string | null;
  /** 페이지-로컬 px */
  position: number;
  /** 눈금자 위로 되돌린 상태 — 놓으면 삭제 (Figma 어법) */
  removing: boolean;
  /** move 시작 시점의 소속 페이지·위치 (커밋 시 before 목록 산출) */
  originPageId: string | null;
  originPosition: number;
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
  patch: Partial<Pick<GuideDragState, "pageId" | "position" | "removing">>,
): void {
  if (!dragState) return;
  const next = { ...dragState, ...patch };
  if (
    next.pageId === dragState.pageId &&
    next.position === dragState.position &&
    next.removing === dragState.removing
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

/** 테스트 전용 */
export function resetGuideDragForTest(): void {
  dragState = null;
}
