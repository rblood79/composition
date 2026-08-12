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
import { applyAxisLockToDelta } from "../interaction/dragModifiers";
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
import {
  resolveSnappedPosition,
  SNAP_THRESHOLD_SCREEN_PX,
  type SnapCandidateRect,
  type SnapGuide,
} from "../interaction/snapGuides";
import {
  clearSnapGuides,
  publishSnapGuides,
} from "../interaction/snapGuidePresentation";

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
  /** ADR-179: 드래그 시작 시 1회 수집된 객체 스냅 후보 (드래그 대상 제외) */
  snapCandidates: readonly SnapCandidateRect[] | null;
  /** ADR-179: 리더 페이지 프레임 크기 (이동 박스) */
  movingSize: { width: number; height: number } | null;
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
  snapCandidates: null,
  movingSize: null,
};

export function usePageDrag(
  zoom: number,
  gestureSession: CanvasGestureSession,
  /**
   * ADR-179 C3: 스냅 후보 공급자 — buildPageFrames 산출(allPageFrames) 을
   * ref 경유로 반환. 드래그 시작 시 1회만 호출한다 (R1 상한).
   */
  getSnapCandidateFrames?: () => readonly SnapCandidateRect[],
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

      // ADR-179: 스냅 후보는 드래그 시작 시 1회 수집 (R1 상한) — 전 페이지
      // 전수에서 드래그 대상 집합만 제외 (C3). 리더 프레임 크기가 이동 박스.
      const allFrames = getSnapCandidateFrames?.() ?? [];
      const dragIdSet = new Set(dragPageIds);
      const snapCandidates = allFrames.filter(
        (frame) => !dragIdSet.has(frame.id),
      );
      const leaderFrame = allFrames.find((frame) => frame.id === pageId);

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
        snapCandidates,
        movingSize: leaderFrame
          ? { width: leaderFrame.width, height: leaderFrame.height }
          : null,
      };

      let latestPointer: {
        x: number;
        y: number;
        shiftKey: boolean;
        suppressSnap: boolean;
      } | null = null;

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
       *
       * ADR-179 순서 (C2/C5): Shift 축 고정 → 객체 스냅 → (미흡착 축만)
       * snap-to-grid. Cmd/Ctrl 홀드는 전 스냅 억제.
       */
      const calculateLeaderPosition = (
        clientX: number,
        clientY: number,
        axisLock: boolean,
        suppressSnap: boolean,
      ): { position: PagePosition; guides: SnapGuide[] } | null => {
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

        let dx = (clientX - state.startPointer.x) / zoom;
        let dy = (clientY - state.startPointer.y) / zoom;
        // ADR-178 Phase 3: 드래그 중 Shift = 축 고정 (스냅 전 델타에 적용 —
        // 전 대상이 리더 델타를 공유하므로 다중 드래그도 함께 잠긴다)
        if (axisLock) {
          const locked = applyAxisLockToDelta(dx, dy);
          dx = locked.x;
          dy = locked.y;
        }
        let x = state.startPagePos.x + dx;
        let y = state.startPagePos.y + dy;
        const { snapToGrid, gridSize, snapToObjects } = useStore.getState();
        let guides: SnapGuide[] = [];
        let snappedX = false;
        let snappedY = false;
        if (
          !suppressSnap &&
          snapToObjects &&
          state.movingSize &&
          state.snapCandidates &&
          state.snapCandidates.length > 0
        ) {
          const snapped = resolveSnappedPosition(
            { x, y },
            state.movingSize,
            state.snapCandidates,
            SNAP_THRESHOLD_SCREEN_PX / (zoom === 0 ? 1 : zoom),
          );
          x = snapped.position.x;
          y = snapped.position.y;
          snappedX = snapped.snappedX;
          snappedY = snapped.snappedY;
          guides = snapped.guides;
        }
        // 객체 스냅이 성사되지 않은 축에만 그리드 스냅 (객체 > 그리드)
        if (!suppressSnap && snapToGrid) {
          if (!snappedX) x = Math.round(x / gridSize) * gridSize;
          if (!snappedY) y = Math.round(y / gridSize) * gridSize;
        }
        return { position: { x, y }, guides };
      };

      const calculatePositions = (
        clientX: number,
        clientY: number,
        axisLock: boolean,
        suppressSnap: boolean,
      ): {
        positions: Array<{ pageId: string; position: PagePosition }>;
        guides: SnapGuide[];
      } | null => {
        const state = stateRef.current;
        const leader = calculateLeaderPosition(
          clientX,
          clientY,
          axisLock,
          suppressSnap,
        );
        if (!leader || !state.startPagePos || !state.startPagePosById) {
          return null;
        }

        const leaderPosition = leader.position;
        const deltaX = leaderPosition.x - state.startPagePos.x;
        const deltaY = leaderPosition.y - state.startPagePos.y;
        return {
          positions: state.pageIds.map((id) => {
            const start = state.startPagePosById!.get(id)!;
            return {
              pageId: id,
              position:
                id === state.pageId
                  ? leaderPosition
                  : { x: start.x + deltaX, y: start.y + deltaY },
            };
          }),
          guides: leader.guides,
        };
      };

      const publishPositions = (
        clientX: number,
        clientY: number,
        axisLock: boolean,
        suppressSnap: boolean,
      ) => {
        const result = calculatePositions(
          clientX,
          clientY,
          axisLock,
          suppressSnap,
        );
        if (result) {
          // 정렬선 먼저 — position notify 가 트리거하는 rerender 가 최신
          // guides 를 읽도록 (snapGuidePresentation 순서 계약)
          publishSnapGuides(result.guides);
          publishPagePositionPresentation(result.positions);
        }
        return result?.positions ?? null;
      };

      const cancel = () => {
        const state = stateRef.current;
        if (!state.isDragging || state.pointerId !== pointerId) {
          return;
        }

        cancelAnimation();
        clearSnapGuides();
        cancelPagePositionPresentation();
        release();
      };

      const abort = () => {
        clearSnapGuides();
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

        clearSnapGuides();
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

        latestPointer = {
          x: event.clientX,
          y: event.clientY,
          shiftKey: event.shiftKey,
          suppressSnap: event.metaKey || event.ctrlKey,
        };
        // RAF 스로틀: 프레임당 최신 위치만 presentation에 반영
        if (rafRef.current !== null) {
          return;
        }

        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null;
          const nextPointer = latestPointer;
          latestPointer = null;
          if (nextPointer) {
            publishPositions(
              nextPointer.x,
              nextPointer.y,
              nextPointer.shiftKey,
              nextPointer.suppressSnap,
            );
          }
        });
      };

      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId !== pointerId) {
          return;
        }

        cancelAnimation();
        finish(
          publishPositions(
            event.clientX,
            event.clientY,
            event.shiftKey,
            event.metaKey || event.ctrlKey,
          ),
        );
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
    [gestureSession, zoom, getSnapCandidateFrames],
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
