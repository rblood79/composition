/**
 * Scroll Wheel Interaction Hook
 *
 * W3-5: overflow:scroll/auto 요소 위에서 wheel 이벤트를 처리한다.
 *
 * - containerEl의 wheel 이벤트 리스너 (passive)
 * - treeBoundsMap AABB 히트 테스트로 스크롤 대상 요소를 O(1) 조회
 * - overflow:scroll/auto인 요소에만 scrollBy() 적용
 * - notifyLayoutChange()로 registryVersion 증가 → Skia 재렌더 트리거
 *
 * 패턴: useElementHoverInteraction과 동일한 window-level 리스너 방식을 따른다.
 * 단, wheel 이벤트는 스로틀 없이 즉시 처리한다.
 *
 * @see useElementHoverInteraction.ts
 * @since 2026-02-21 W3-5
 */

import { useCallback, useEffect } from "react";
import type { MutableRefObject } from "react";
import type { Element } from "../../../../types/core/store.types";
import { useViewportSyncStore } from "../stores";
import { useScrollState } from "../../../stores/scrollState";
import { notifyLayoutChange } from "../skia/useSkiaNode";
import type { BoundingBox } from "../selection/types";

// ============================================
// Types
// ============================================

interface UseScrollWheelInteractionOptions {
  /** 부모 컨테이너 DOM 요소 */
  containerEl: HTMLDivElement | null;
  /** Active Skia renderer input 에서 파생한 scroll element map */
  getScrollElementsMap: () => ReadonlyMap<string, Element>;
  /** treeBoundsMap ref (Skia 트리 기반 씬-로컬 절대 바운드) */
  treeBoundsMapRef: MutableRefObject<Map<string, BoundingBox>>;
}

// ============================================
// Hook
// ============================================

export function useScrollWheelInteraction({
  containerEl,
  getScrollElementsMap,
  treeBoundsMapRef,
}: UseScrollWheelInteractionOptions): void {
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!containerEl) return;

      const rect = containerEl.getBoundingClientRect();
      const mouseX = e.clientX;
      const mouseY = e.clientY;

      // 캔버스 밖이면 스킵
      if (
        mouseX < rect.left ||
        mouseX > rect.right ||
        mouseY < rect.top ||
        mouseY > rect.bottom
      ) {
        return;
      }

      // 스크린 → 씬-로컬 좌표 변환
      const { zoom, panOffset } = useViewportSyncStore.getState();
      const sceneX = (mouseX - rect.left - panOffset.x) / zoom;
      const sceneY = (mouseY - rect.top - panOffset.y) / zoom;

      const boundsMap = treeBoundsMapRef.current;
      if (!boundsMap || boundsMap.size === 0) return;

      const elementsMap = getScrollElementsMap();

      // 포인터 아래의 모든 요소 중 overflow:scroll/auto인 가장 안쪽 요소 탐색
      // (z-order를 고려하여 가장 마지막에 hit된 요소 = 가장 위에 그려진 요소)
      let targetElementId: string | null = null;

      for (const [elementId, bounds] of boundsMap) {
        if (
          sceneX < bounds.x ||
          sceneX > bounds.x + bounds.width ||
          sceneY < bounds.y ||
          sceneY > bounds.y + bounds.height
        ) {
          continue;
        }

        // overflow:scroll/auto인 요소인지 확인
        const element = elementsMap.get(elementId);
        if (!element) continue;

        const overflow = (
          element.props?.style as Record<string, unknown> | undefined
        )?.overflow as string | undefined;
        if (overflow !== "scroll" && overflow !== "auto") continue;

        // 스크롤 가능한 요소이면 후보로 등록 (가장 나중에 발견된 것 = 더 안쪽 요소)
        // 더 안쪽 요소가 더 작은 bounds를 가지므로, 안쪽 요소 우선 선택
        if (targetElementId === null) {
          targetElementId = elementId;
        } else {
          const prevBounds = boundsMap.get(targetElementId);
          if (prevBounds) {
            const prevArea = prevBounds.width * prevBounds.height;
            const currArea = bounds.width * bounds.height;
            // 더 작은 (안쪽) 요소 우선
            if (currArea < prevArea) {
              targetElementId = elementId;
            }
          }
        }
      }

      if (!targetElementId) return;

      // 스크롤 상태 업데이트
      const scrollStore = useScrollState.getState();
      const existing = scrollStore.scrollMap.get(targetElementId);

      // maxScroll이 0이면 스크롤 불가 (콘텐츠가 컨테이너 안에 모두 들어감)
      if (
        !existing ||
        (existing.maxScrollTop === 0 && existing.maxScrollLeft === 0)
      )
        return;

      // deltaMode 처리: 0=픽셀, 1=라인(~20px), 2=페이지
      let deltaX = e.deltaX;
      let deltaY = e.deltaY;
      if (e.deltaMode === 1) {
        deltaX *= 20;
        deltaY *= 20;
      } else if (e.deltaMode === 2) {
        deltaX *= existing.maxScrollLeft || 300;
        deltaY *= existing.maxScrollTop || 300;
      }

      const prevScrollTop = existing.scrollTop;
      const prevScrollLeft = existing.scrollLeft;

      scrollStore.scrollBy(targetElementId, deltaX, deltaY);

      const updated = scrollStore.scrollMap.get(targetElementId);
      const scrollChanged =
        updated &&
        (updated.scrollTop !== prevScrollTop ||
          updated.scrollLeft !== prevScrollLeft);

      if (scrollChanged) {
        // registryVersion 증가 → Skia content layer 재렌더 트리거
        notifyLayoutChange();
        // 브라우저 기본 스크롤(뷰포트 팬) 방지
        e.preventDefault();
      }
    },
    [containerEl, getScrollElementsMap, treeBoundsMapRef],
  );

  useEffect(() => {
    if (!containerEl) return;

    // passive: false → preventDefault() 사용 가능
    containerEl.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      containerEl.removeEventListener("wheel", handleWheel);
    };
  }, [containerEl, handleWheel]);
}
