/**
 * 페이지 타이틀 드래그 훅
 *
 * 페이지 타이틀 영역에서 pointerdown → pointermove → pointerup으로
 * 페이지 위치를 자유롭게 변경한다.
 * 요소 드래그와 분리되며, RAF 스로틀링으로 프레임당 1회만 presentation을
 * 갱신하고 정상 종료 시에만 canonical page position을 commit한다.
 */

import { useCallback, useEffect, useRef } from "react";
import { useStore } from "../../../stores";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";
import {
  beginPagePositionPresentation,
  cancelPagePositionPresentation,
  finishPagePositionPresentation,
  getPagePositionPresentationSnapshot,
  isSamePosition,
  publishPagePositionPresentation,
  type PagePosition,
  type PagePositionMap,
} from "../interaction/pagePositionPresentation";

interface PageDragState {
  isDragging: boolean;
  pageId: string | null;
  pointerId: number | null;
  startPointer: { x: number; y: number } | null;
  startPagePos: PagePosition | null;
  canonical: PagePositionMap | null;
  startBreakpoint: string | null;
}

interface UsePageDragReturn {
  startDrag: (
    pageId: string,
    pointerId: number,
    pointerX: number,
    pointerY: number,
  ) => void;
}

const EMPTY_PAGE_DRAG_STATE: PageDragState = {
  isDragging: false,
  pageId: null,
  pointerId: null,
  startPointer: null,
  startPagePos: null,
  canonical: null,
  startBreakpoint: null,
};

export function usePageDrag(
  zoom: number,
  gestureSession: CanvasGestureSession,
): UsePageDragReturn {
  const stateRef = useRef<PageDragState>({ ...EMPTY_PAGE_DRAG_STATE });
  const rafRef = useRef<number | null>(null);
  const isFinishingRef = useRef(false);
  // 이벤트 핸들러 cleanup 함수 ref (self-reference 회피)
  const cleanupRef = useRef<(() => void) | null>(null);

  const startDrag = useCallback(
    (pageId: string, pointerId: number, pointerX: number, pointerY: number) => {
      const owner = gestureSession.pageOwnerFor(pointerId);
      if (!owner || owner.pageId !== pageId) {
        return;
      }

      cleanupRef.current?.();
      const canonical = useStore.getState().pagePositions;
      const pos = canonical[pageId];
      if (!pos) {
        gestureSession.endPage(pointerId);
        return;
      }

      if (
        !beginPagePositionPresentation(canonical, pageId, owner.startBreakpoint)
      ) {
        gestureSession.endPage(pointerId);
        return;
      }

      stateRef.current = {
        isDragging: true,
        pageId,
        pointerId,
        startPointer: { x: pointerX, y: pointerY },
        startPagePos: { x: pos.x, y: pos.y },
        canonical,
        startBreakpoint: owner.startBreakpoint,
      };

      let latestPointer: { x: number; y: number } | null = null;

      const resetState = () => {
        stateRef.current = { ...EMPTY_PAGE_DRAG_STATE };
      };

      const removeListeners = () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("pointercancel", onPointerCancel);
        window.removeEventListener("blur", onBlur);
        window.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      };

      const release = () => {
        removeListeners();
        resetState();
        cleanupRef.current = null;
        gestureSession.endPage(pointerId);
      };

      const cancelAnimation = () => {
        latestPointer = null;
        if (rafRef.current === null) {
          return;
        }

        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };

      const calculatePosition = (
        clientX: number,
        clientY: number,
      ): PagePosition | null => {
        const state = stateRef.current;
        if (
          !state.isDragging ||
          state.pointerId !== pointerId ||
          !state.pageId ||
          !state.startPointer ||
          !state.startPagePos
        ) {
          return null;
        }

        const dx = (clientX - state.startPointer.x) / zoom;
        const dy = (clientY - state.startPointer.y) / zoom;
        let x = state.startPagePos.x + dx;
        let y = state.startPagePos.y + dy;
        const { snapToGrid, gridSize } = useStore.getState();
        if (snapToGrid) {
          x = Math.round(x / gridSize) * gridSize;
          y = Math.round(y / gridSize) * gridSize;
        }
        return { x, y };
      };

      const publishPosition = (clientX: number, clientY: number) => {
        const state = stateRef.current;
        if (!state.pageId) {
          return null;
        }

        const position = calculatePosition(clientX, clientY);
        if (position) {
          publishPagePositionPresentation(state.pageId, position);
        }
        return position;
      };

      const cancel = () => {
        const state = stateRef.current;
        if (!state.isDragging || state.pointerId !== pointerId) {
          return;
        }

        cancelAnimation();
        cancelPagePositionPresentation();
        release();
      };

      const abort = () => {
        cancelPagePositionPresentation();
        release();
      };

      const finish = (position: PagePosition | null) => {
        const state = stateRef.current;
        const currentOwner = gestureSession.pageOwnerFor(pointerId);
        if (!state.isDragging || state.pointerId !== pointerId) {
          return;
        }

        if (
          !currentOwner ||
          !position ||
          !state.pageId ||
          !state.startPagePos
        ) {
          abort();
          return;
        }

        const currentStore = useStore.getState();
        const canCommit =
          currentStore.activeBreakpoint === currentOwner.startBreakpoint &&
          currentStore.pagePositions === state.canonical &&
          currentStore.pagePositions[state.pageId] !== undefined;
        if (!canCommit) {
          abort();
          return;
        }
        if (!isSamePosition(position, state.startPagePos)) {
          isFinishingRef.current = true;
          try {
            currentStore.updatePagePosition(
              state.pageId,
              position.x,
              position.y,
            );
          } finally {
            isFinishingRef.current = false;
          }
        }

        const committedSnapshot = getPagePositionPresentationSnapshot();
        finishPagePositionPresentation(
          committedSnapshot.canonical === state.canonical
            ? useStore.getState().pagePositions
            : currentStore.pagePositions,
        );
        release();
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) {
          return;
        }

        latestPointer = { x: event.clientX, y: event.clientY };
        // RAF 스로틀: 프레임당 최신 위치만 presentation에 반영
        if (rafRef.current !== null) {
          return;
        }

        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const nextPointer = latestPointer;
          latestPointer = null;
          if (nextPointer) {
            publishPosition(nextPointer.x, nextPointer.y);
          }
        });
      };

      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) {
          return;
        }

        cancelAnimation();
        finish(publishPosition(event.clientX, event.clientY));
      };

      const onPointerCancel = (event: PointerEvent) => {
        if (event.pointerId === pointerId) {
          cancel();
        }
      };

      const onBlur = () => {
        cancel();
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          cancel();
        }
      };

      const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") {
          cancel();
        }
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerCancel);
      window.addEventListener("blur", onBlur);
      window.addEventListener("keydown", onKeyDown);
      document.addEventListener("visibilitychange", onVisibilityChange);
      cleanupRef.current = cancel;
    },
    [gestureSession, zoom],
  );

  useEffect(() => {
    return useStore.subscribe((state) => {
      const drag = stateRef.current;
      if (
        isFinishingRef.current ||
        !drag.isDragging ||
        !drag.canonical ||
        !drag.startBreakpoint
      ) {
        return;
      }

      if (
        state.pagePositions !== drag.canonical ||
        state.activeBreakpoint !== drag.startBreakpoint
      ) {
        cleanupRef.current?.();
      }
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return {
    startDrag,
  };
}
