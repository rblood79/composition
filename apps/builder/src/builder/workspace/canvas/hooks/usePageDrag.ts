/**
 * 페이지 타이틀 드래그 훅
 *
 * 페이지 타이틀 영역에서 pointerdown → pointermove → pointerup으로
 * 페이지 위치를 자유롭게 변경한다.
 * 요소 드래그와 분리되며, RAF 스로틀링으로 프레임당 1회만 presentation을
 * 갱신하고 정상 종료 시에만 canonical page position을 commit한다.
 *
 * ADR-178 Phase 2: gesture owner 가 대상 **집합**(pageIds — 리더 포함)을
 * 보유하면 전 대상이 리더와 같은 델타로 움직인다. 스냅은 리더 위치에 걸고
 * 그 결과 델타를 전 대상이 공유한다 (Figma 동형). commit 은 단일이면
 * `updatePagePosition` (현행 — entry 1), 다중이면 `updatePagePositionsBatch`
 * (ADR-177 page-position batch entry — Cmd+Z 1회 전체 복귀).
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
  pageIds: readonly string[];
  pointerId: number | null;
  startPointer: { x: number; y: number } | null;
  startPagePos: PagePosition | null;
  startPagePosById: ReadonlyMap<string, PagePosition> | null;
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
  pageIds: [],
  pointerId: null,
  startPointer: null,
  startPagePos: null,
  startPagePosById: null,
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

      // ADR-178: canonical 위치가 있는 대상만 드래그 집합에 남는다 (리더는
      // 위에서 확인됨). owner.pageIds 는 리더가 항상 첫 요소.
      const dragPageIds = owner.pageIds.filter(
        (id) => canonical[id] !== undefined,
      );
      const startPagePosById = new Map<string, PagePosition>(
        dragPageIds.map((id) => [
          id,
          { x: canonical[id]!.x, y: canonical[id]!.y },
        ]),
      );

      if (
        !beginPagePositionPresentation(
          canonical,
          dragPageIds,
          owner.startBreakpoint,
        )
      ) {
        gestureSession.endPage(pointerId);
        return;
      }

      stateRef.current = {
        isDragging: true,
        pageId,
        pageIds: dragPageIds,
        pointerId,
        startPointer: { x: pointerX, y: pointerY },
        startPagePos: { x: pos.x, y: pos.y },
        startPagePosById,
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

      /**
       * 리더 위치 (스냅 반영) 를 계산한다. 다중 대상의 위치는 리더 델타
       * (스냅 후) 를 각 시작 위치에 더해 파생한다 — calculatePositions.
       */
      const calculateLeaderPosition = (
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

      const calculatePositions = (
        clientX: number,
        clientY: number,
      ): Array<{ pageId: string; position: PagePosition }> | null => {
        const state = stateRef.current;
        const leaderPosition = calculateLeaderPosition(clientX, clientY);
        if (!leaderPosition || !state.startPagePos || !state.startPagePosById) {
          return null;
        }

        const deltaX = leaderPosition.x - state.startPagePos.x;
        const deltaY = leaderPosition.y - state.startPagePos.y;
        return state.pageIds.map((id) => {
          const start = state.startPagePosById!.get(id)!;
          return {
            pageId: id,
            position:
              id === state.pageId
                ? leaderPosition
                : { x: start.x + deltaX, y: start.y + deltaY },
          };
        });
      };

      const publishPositions = (clientX: number, clientY: number) => {
        const positions = calculatePositions(clientX, clientY);
        if (positions) {
          publishPagePositionPresentation(positions);
        }
        return positions;
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

      const finish = (
        positions: Array<{ pageId: string; position: PagePosition }> | null,
      ) => {
        const state = stateRef.current;
        const currentOwner = gestureSession.pageOwnerFor(pointerId);
        if (!state.isDragging || state.pointerId !== pointerId) {
          return;
        }

        if (
          !currentOwner ||
          !positions ||
          positions.length === 0 ||
          !state.pageId ||
          !state.startPagePosById
        ) {
          abort();
          return;
        }

        const currentStore = useStore.getState();
        const canCommit =
          currentStore.activeBreakpoint === currentOwner.startBreakpoint &&
          currentStore.pagePositions === state.canonical &&
          positions.every(
            (entry) => currentStore.pagePositions[entry.pageId] !== undefined,
          );
        if (!canCommit) {
          abort();
          return;
        }

        const moved = positions.filter(
          (entry) =>
            !isSamePosition(
              entry.position,
              state.startPagePosById!.get(entry.pageId),
            ),
        );
        if (moved.length > 0) {
          isFinishingRef.current = true;
          try {
            if (moved.length === 1) {
              currentStore.updatePagePosition(
                moved[0].pageId,
                moved[0].position.x,
                moved[0].position.y,
              );
            } else {
              // ADR-178: 다중 페이지 finish — batch entry 1개 (Cmd+Z 1회
              // 전체 복귀, ADR-177 pagePositionEvent.entries[] 계약)
              currentStore.updatePagePositionsBatch(
                moved.map((entry) => ({
                  pageId: entry.pageId,
                  x: entry.position.x,
                  y: entry.position.y,
                })),
              );
            }
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
            publishPositions(nextPointer.x, nextPointer.y);
          }
        });
      };

      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) {
          return;
        }

        cancelAnimation();
        finish(publishPositions(event.clientX, event.clientY));
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
