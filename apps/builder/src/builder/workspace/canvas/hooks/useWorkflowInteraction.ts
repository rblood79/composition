/**
 * Workflow Interaction Hook
 *
 * 워크플로우 오버레이에 마우스 인터랙션을 추가한다.
 * - pointermove (window, RAF 스로틀): 엣지 호버 감지
 * - pointerdown (containerEl, capture phase): 페이지 프레임 클릭 → 카메라 애니메이션
 *
 * SkiaOverlay는 pointer-events: none이므로 window-level 리스너로
 * 마우스를 추적하고 ref를 통해 렌더러에 전달한다.
 *
 * @see usePageDrag.ts — 동일 패턴 (window-level 리스너, RAF 스로틀)
 */

import { useEffect, useRef, useCallback } from "react";
import type { RefObject, MutableRefObject } from "react";
import { useStore } from "../../../stores";
import { useViewportSyncStore } from "../stores";
import {
  hitTestEdges,
  hitTestPageFrame,
  type CachedEdgeGeometry,
} from "../skia/workflowHitTest";
import type { PageFrame } from "../skia/workflowRenderer";
import { getViewportController } from "../viewport/ViewportController";
import type { ViewportInteractionSession } from "../viewport/ViewportInteractionSession";
import { panToPage, cancelPanToPage } from "../viewport/panToPage";
import {
  applyViewportState,
  beginViewportInteraction,
} from "../viewport/viewportActions";
import {
  isPointInMinimap,
  minimapScreenToWorld,
  computeMinimapTransform,
  type MinimapConfig,
} from "../skia/workflowMinimap";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";
import { useGestureHoverSuppression } from "./useGestureHoverSuppression";

// ============================================
// Types
// ============================================

export interface WorkflowHoverState {
  hoveredEdgeId: string | null;
}

export interface UseWorkflowInteractionOptions {
  /** 부모 컨테이너 DOM 요소 */
  containerEl: HTMLDivElement | null;
  /** Hand/Pan mode가 armed된 동안 workflow hover hit-test를 막는 session */
  gestureSession: CanvasGestureSession;
  /** 엣지 지오메트리 캐시 ref */
  edgeGeometryCacheRef: RefObject<CachedEdgeGeometry[]>;
  /** 페이지 프레임 맵 ref */
  pageFrameMapRef: RefObject<Map<string, PageFrame>>;
  /** 호버 상태 ref (60fps 갱신, Zustand 아님) */
  hoverStateRef: MutableRefObject<WorkflowHoverState>;
  /** overlayVersion ref (리렌더 트리거) */
  overlayVersionRef: MutableRefObject<number>;
  /** Phase 4: 미니맵 config ref */
  minimapConfigRef: RefObject<MinimapConfig>;
}

// ============================================
// Animation Constants
// ============================================

// ============================================
// Hook
// ============================================

export function useWorkflowInteraction({
  containerEl,
  gestureSession,
  edgeGeometryCacheRef,
  pageFrameMapRef,
  hoverStateRef,
  overlayVersionRef,
  minimapConfigRef,
}: UseWorkflowInteractionOptions): void {
  const rafRef = useRef<number | null>(null);
  const isMinimapDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });
  const minimapSessionRef = useRef<ViewportInteractionSession | null>(null);
  const minimapQueuedViewportRef = useRef<{
    scale: number;
    x: number;
    y: number;
  } | null>(null);

  const clearHover = useCallback(() => {
    if (hoverStateRef.current.hoveredEdgeId !== null) {
      hoverStateRef.current.hoveredEdgeId = null;
      overlayVersionRef.current++;
    }
  }, [hoverStateRef, overlayVersionRef]);

  // animateToPage → panToPage 유틸로 통합 (viewport/panToPage.ts)
  const animateToPage = panToPage;

  // ============================================
  // moveCameraToMinimapPoint: 미니맵 클릭/드래그 → 카메라 이동
  // ============================================

  const moveCameraToMinimapPoint = useCallback(
    (screenX: number, screenY: number) => {
      const config = minimapConfigRef.current;
      if (!config) return;

      const pageFrameMap = pageFrameMapRef.current;
      if (!pageFrameMap || pageFrameMap.size === 0) return;

      const vc = getViewportController();
      if (!vc.isAttached()) return;

      const { containerSize } = useViewportSyncStore.getState();
      const currentViewport = minimapQueuedViewportRef.current ?? vc.getState();

      // 미니맵 좌표 → 씬(월드) 좌표
      const transform = computeMinimapTransform(
        pageFrameMap,
        config.width,
        config.height,
      );
      const { worldX, worldY } = minimapScreenToWorld(
        screenX,
        screenY,
        config,
        transform,
        containerSize,
      );

      // 월드 좌표가 화면 중심에 오도록 카메라 pan 계산
      const targetViewport = {
        scale: currentViewport.scale,
        x: containerSize.width / 2 - worldX * currentViewport.scale,
        y: containerSize.height / 2 - worldY * currentViewport.scale,
      };
      const session = minimapSessionRef.current;

      if (session?.isActiveKind("minimap")) {
        session.queuePan({
          x: targetViewport.x - currentViewport.x,
          y: targetViewport.y - currentViewport.y,
        });
        minimapQueuedViewportRef.current = targetViewport;
      } else {
        applyViewportState(targetViewport);
      }
      overlayVersionRef.current++;
    },
    [minimapConfigRef, pageFrameMapRef, overlayVersionRef],
  );

  // ============================================
  // pointermove: 엣지 호버 감지 + 미니맵 드래그 (window, RAF 스로틀)
  // ============================================

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!containerEl) return;

      if (gestureSession.shouldSuppressElementHover()) {
        clearHover();
        return;
      }

      // 좌표 변화 없으면 스킵 (subpixel jitter 방지 → idle 프레임 복원)
      if (
        e.clientX === lastMouseRef.current.x &&
        e.clientY === lastMouseRef.current.y
      )
        return;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      // Phase 4: 미니맵 드래그 중이면 카메라 이동만 처리
      if (isMinimapDraggingRef.current) {
        const rect = containerEl.getBoundingClientRect();
        moveCameraToMinimapPoint(e.clientX - rect.left, e.clientY - rect.top);
        return;
      }

      // RAF 스로틀: 프레임당 1회
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;

        if (gestureSession.shouldSuppressElementHover()) {
          clearHover();
          return;
        }

        const cache = edgeGeometryCacheRef.current;
        if (!cache || cache.length === 0) {
          // 캐시 없으면 호버 클리어
          clearHover();
          return;
        }

        // 스크린 → 씬-로컬 좌표 변환
        const rect = containerEl.getBoundingClientRect();
        const { zoom, panOffset } = useViewportSyncStore.getState();
        const sceneX = (e.clientX - rect.left - panOffset.x) / zoom;
        const sceneY = (e.clientY - rect.top - panOffset.y) / zoom;

        // 히트 테스트 (threshold: 10 / zoom — 씬 좌표로 일정한 픽셀 크기 유지)
        const hit = hitTestEdges(sceneX, sceneY, cache, 10 / zoom);
        const newHoveredId = hit?.edgeId ?? null;

        if (newHoveredId !== hoverStateRef.current.hoveredEdgeId) {
          hoverStateRef.current.hoveredEdgeId = newHoveredId;
          overlayVersionRef.current++;
        }
      });
    },
    [
      containerEl,
      clearHover,
      gestureSession,
      edgeGeometryCacheRef,
      hoverStateRef,
      overlayVersionRef,
      moveCameraToMinimapPoint,
    ],
  );

  useGestureHoverSuppression(gestureSession, rafRef, clearHover);

  // ============================================
  // pointerdown: 페이지 프레임 클릭 (capture phase)
  // ============================================

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (!containerEl) return;

      if ((e as PointerEvent & { __handled?: boolean }).__handled) {
        return;
      }

      if (
        gestureSession.ownerFor(e.pointerId) === "page" ||
        gestureSession.isOwnedByAnotherPointer(e.pointerId)
      ) {
        return;
      }

      if (gestureSession.beginPointer(e.pointerId, e.button) === "pan") {
        return;
      }

      const pageFrameMap = pageFrameMapRef.current;
      if (!pageFrameMap || pageFrameMap.size === 0) return;

      // 스크린 → 씬-로컬 좌표 변환
      const rect = containerEl.getBoundingClientRect();
      const { zoom, panOffset, containerSize } =
        useViewportSyncStore.getState();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;
      const sceneX = (localX - panOffset.x) / zoom;
      const sceneY = (localY - panOffset.y) / zoom;

      // 0) Phase 4: 미니맵 영역 클릭 → 카메라 이동 + 드래그 모드 진입
      const config = minimapConfigRef.current;
      if (config && isPointInMinimap(localX, localY, config, containerSize)) {
        e.stopPropagation();
        e.preventDefault();
        const session = beginViewportInteraction("minimap");
        isMinimapDraggingRef.current = true;
        minimapSessionRef.current = session;
        minimapQueuedViewportRef.current = getViewportController().getState();
        moveCameraToMinimapPoint(localX, localY);
        return;
      }

      // 1) 엣지 호버 중 클릭 → 연결 페이지 포커스
      const hoveredEdgeId = hoverStateRef.current.hoveredEdgeId;
      if (hoveredEdgeId) {
        // 엣지의 소스/타겟 페이지 중 하나로 포커스
        const cache = edgeGeometryCacheRef.current;
        if (cache) {
          const entry = cache.find((c) => c.edgeId === hoveredEdgeId);
          if (entry) {
            // 클릭 위치에 더 가까운 페이지 프레임을 찾아서 포커스
            const hitPageId = hitTestPageFrame(sceneX, sceneY, pageFrameMap);
            if (hitPageId) {
              e.stopPropagation();
              const state = useStore.getState();
              state.setWorkflowFocusedPageId(hitPageId);
              state.setCurrentPageId(hitPageId);
              animateToPage(hitPageId);
              return;
            }
          }
        }
      }

      // 2) 페이지 프레임 빈 영역 클릭 → 카메라 애니메이션
      const hitPageId = hitTestPageFrame(sceneX, sceneY, pageFrameMap);
      if (hitPageId) {
        const currentFocused = useStore.getState().workflowFocusedPageId;
        if (currentFocused !== hitPageId) {
          // 새 페이지 포커스
          e.stopPropagation();
          const state = useStore.getState();
          state.setWorkflowFocusedPageId(hitPageId);
          state.setCurrentPageId(hitPageId);
          animateToPage(hitPageId);
          return;
        }
        // 이미 포커스된 페이지 클릭 → 포커스 해제
        // 이벤트는 전파하여 요소 선택 등 기존 동작 유지
        useStore.getState().setWorkflowFocusedPageId(null);
        overlayVersionRef.current++;
        return;
      }

      // 3) 빈 영역 클릭 → 포커스 해제 + 이벤트 전파 (기존 PixiJS 동작 유지)
      if (useStore.getState().workflowFocusedPageId !== null) {
        useStore.getState().setWorkflowFocusedPageId(null);
        overlayVersionRef.current++;
      }
      // 이벤트 전파 — 기존 요소 선택 유지
    },
    [
      containerEl,
      gestureSession,
      pageFrameMapRef,
      hoverStateRef,
      edgeGeometryCacheRef,
      overlayVersionRef,
      animateToPage,
      minimapConfigRef,
      moveCameraToMinimapPoint,
    ],
  );

  // ============================================
  // pointerup: 미니맵 드래그 해제 (window)
  // ============================================

  const handlePointerUp = useCallback(() => {
    if (isMinimapDraggingRef.current) {
      isMinimapDraggingRef.current = false;
      if (minimapSessionRef.current?.isActiveKind("minimap")) {
        minimapSessionRef.current.finish("pointerup");
      }
      minimapSessionRef.current = null;
      minimapQueuedViewportRef.current = null;
    }
  }, []);

  // ============================================
  // Effect: 리스너 등록/해제
  // ============================================

  useEffect(() => {
    if (!containerEl) return;

    const addListeners = () => {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerUp);
      containerEl.addEventListener("pointerdown", handlePointerDown, true);
    };

    const removeListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      containerEl.removeEventListener("pointerdown", handlePointerDown, true);
      if (minimapSessionRef.current?.isActiveKind("minimap")) {
        minimapSessionRef.current.finish("interrupted");
      }
      minimapSessionRef.current = null;
      minimapQueuedViewportRef.current = null;
      isMinimapDraggingRef.current = false;
    };

    // 초기 상태 확인 → 리스너 등록
    let isActive = useStore.getState().showWorkflowOverlay;
    if (isActive) {
      addListeners();
    }

    // showWorkflowOverlay 변경 구독 (항상 등록하여 OFF→ON 전환도 감지)
    const unsub = useStore.subscribe((state) => {
      const show = state.showWorkflowOverlay;
      if (show === isActive) return;
      isActive = show;

      if (show) {
        // 오버레이 ON → 리스너 등록
        addListeners();
      } else {
        // 오버레이 OFF → 클린업
        removeListeners();

        // 호버/포커스 초기화
        if (hoverStateRef.current.hoveredEdgeId !== null) {
          hoverStateRef.current.hoveredEdgeId = null;
          overlayVersionRef.current++;
        }
        if (useStore.getState().workflowFocusedPageId !== null) {
          useStore.getState().setWorkflowFocusedPageId(null);
        }
      }
    });

    return () => {
      removeListeners();
      unsub();

      // RAF 클린업
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      cancelPanToPage();
    };
  }, [
    containerEl,
    handlePointerMove,
    handlePointerDown,
    handlePointerUp,
    hoverStateRef,
    overlayVersionRef,
  ]);
}
