/**
 * Element Press Interaction Hook — ADR-150 A1 (S3, pressed 축)
 *
 * 캔버스 위에서 pointerdown 유지 중인 요소를 pressed 상태로 추적한다. Preview DOM 의
 * RAC `data-pressed`(`:active`) 와 동일 시점 — 마우스 버튼을 누르고 있는 동안 pressed fill
 * 을 표시한다.
 *
 * 설계 핵심(design breakdown §3-1 "기존 hover outline 경로의 id 소스 재사용"):
 * - pressed 대상 = **pointerdown 시점의 hovered 요소**. 눌린 요소는 언제나 방금까지 hover 중이던
 *   요소이므로, 별도 hit-test 없이 `elementHoverStateRef` 를 snapshot 한다. hover 와 동일
 *   hit 소스를 재사용해 두 상태의 대상이 어긋나지 않는다.
 * - 무효화는 hover 와 같은 `overlayVersionRef` 채널 재사용(ADR-136 §9: scene rebuild 0,
 *   sceneVersion signature 에 상태 미포함). 신규 상태 store 불필요.
 *
 * 해제:
 * - pointerup / pointercancel(window) → 캔버스 밖에서 떼도 확실히 해제.
 * - 드래그 시작(`getDragVisualOffset()`) → 요소가 이동하며 pressed bounds 가 stale 이므로 해제
 *   (hover 와 동일 정책).
 *
 * @see useElementHoverInteraction.ts — id 소스(hover) + 동일 overlayVersion 채널
 */

import { useEffect } from "react";
import type { MutableRefObject } from "react";
import { getDragVisualOffset } from "../skia/nodeRendererTree";
import type { ElementHoverState } from "./useElementHoverInteraction";

interface UseElementPressInteractionOptions {
  /** 부모 컨테이너 DOM 요소 (pointerdown 등록 대상) */
  containerEl: HTMLDivElement | null;
  /** hover 상태 ref — pressed 대상 snapshot 소스 (동일 hit 소스 재사용) */
  hoverStateRef: MutableRefObject<ElementHoverState>;
  /** pressed 상태 ref (ElementHoverState 형태 재사용: element + leaf) */
  pressedStateRef: MutableRefObject<ElementHoverState>;
  /** overlayVersion ref (Skia 리렌더 트리거 — hover 와 동일 채널) */
  overlayVersionRef: MutableRefObject<number>;
}

export function useElementPressInteraction({
  containerEl,
  hoverStateRef,
  pressedStateRef,
  overlayVersionRef,
}: UseElementPressInteractionOptions): void {
  useEffect(() => {
    if (!containerEl) return;

    const clearPressed = (): void => {
      const p = pressedStateRef.current;
      if (p.hoveredElementId === null && p.hoveredLeafIds.length === 0) return;
      p.hoveredElementId = null;
      p.hoveredLeafIds = [];
      p.isGroupHover = false;
      overlayVersionRef.current++;
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      // 텍스트 편집 필드에서는 pressed 시각 억제 (편집 중 클릭이 요소 pressed 로 오인되지 않게).
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;

      // pressed 대상 = pointerdown 시점의 hovered 요소 (design §3-1). 빈 캔버스면 해제.
      const hover = hoverStateRef.current;
      if (!hover.hoveredElementId) {
        clearPressed();
        return;
      }
      const p = pressedStateRef.current;
      p.hoveredElementId = hover.hoveredElementId;
      p.hoveredLeafIds = hover.hoveredLeafIds.slice(); // snapshot: hover 변경에 오염되지 않게 복사
      p.isGroupHover = hover.isGroupHover;
      overlayVersionRef.current++;
    };

    // 드래그 시작 시 pressed 해제 — 요소 이동으로 bounds stale (hover clearElementHoverState 와 동일).
    const handlePointerMove = (): void => {
      if (getDragVisualOffset()) clearPressed();
    };

    containerEl.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointerup", clearPressed);
    window.addEventListener("pointercancel", clearPressed);
    window.addEventListener("pointermove", handlePointerMove);

    return () => {
      containerEl.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointerup", clearPressed);
      window.removeEventListener("pointercancel", clearPressed);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, [containerEl, hoverStateRef, pressedStateRef, overlayVersionRef]);
}
