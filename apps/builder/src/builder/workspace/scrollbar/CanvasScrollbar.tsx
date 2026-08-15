/**
 * CanvasScrollbar
 *
 * Figma 스타일 캔버스 스크롤바.
 * React 리렌더 0회 설계 — mount 후 DOM 직접 조작만 수행.
 *
 * 변경 감지 소스 (ADR-035 Phase 2: ViewportController 단일 권한):
 *  1. ViewportController.addUpdateListener() — pan/zoom/setPosition (단일 소스)
 *  2. ResizeObserver(track) — 창 리사이즈, 패널 애니메이션
 *  3. subscribeToPanelLayoutChanges() — 패널 토글
 *
 * @since 2026-01-30
 */

import { useRef, useEffect } from "react";
import { useStore } from "../../stores";
import { useViewportSyncStore } from "../canvas/stores";
import { getViewportController } from "../canvas/viewport/ViewportController";
import type { ViewportInteractionSession } from "../canvas/viewport/ViewportInteractionSession";
import {
  applyViewportState,
  beginViewportInteraction,
} from "../canvas/viewport/viewportActions";
import {
  measureWorkspacePanelInsets,
  subscribeToPanelLayoutChanges,
} from "../utils/panelLayoutRuntime";
import {
  getScrollbarAxisMetrics,
  getScrollbarViewportMetrics,
} from "./viewportMetrics";
import "./CanvasScrollbar.css";

// ============================================
// Types
// ============================================

interface CanvasScrollbarProps {
  direction: "horizontal" | "vertical";
}

// ============================================
// Component
// ============================================

export function CanvasScrollbar({ direction }: CanvasScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const rafIdRef = useRef(0);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const isDraggingRef = useRef(false);
  // 패널 inset 캐시 (viewport 계산에서 재사용)
  const panelInsetRef = useRef({ left: 0, right: 0 });

  useEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;

    const isHorizontal = direction === "horizontal";
    let scrollbarSession: ViewportInteractionSession | null = null;

    // ========================================
    // 패널 오프셋 측정
    // ========================================

    const measurePanelInsets = () => {
      const insets = measureWorkspacePanelInsets();
      panelInsetRef.current = insets;
      return insets;
    };

    const updatePanelOffset = () => {
      const { left, right } = measurePanelInsets();
      if (isHorizontal) {
        track.style.left = `${left}px`;
        track.style.right = `${right}px`;
      } else {
        track.style.right = `${right}px`;
      }
    };

    // ========================================
    // DOM 직접 업데이트
    // ========================================

    const updateThumb = () => {
      const trackLength = isHorizontal ? track.clientWidth : track.clientHeight;
      const metrics = getScrollbarViewportMetrics(panelInsetRef.current);
      if (!metrics) return;

      const axis = getScrollbarAxisMetrics(metrics, direction, trackLength);
      if (!axis) return;

      const ratio =
        axis.scrollableWorld > 0
          ? axis.viewportStart / axis.scrollableWorld
          : 0;
      const thumbPos = ratio * axis.scrollableTrack;

      if (isHorizontal) {
        thumb.style.width = `${axis.thumbSize}px`;
        thumb.style.transform = `translateX(${thumbPos}px)`;
      } else {
        thumb.style.height = `${axis.thumbSize}px`;
        thumb.style.transform = `translateY(${thumbPos}px)`;
      }
    };

    // ========================================
    // Fade 제어
    // ========================================

    const showScrollbar = () => {
      track.classList.add("canvas-scrollbar--visible");
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = setTimeout(() => {
        if (!isDraggingRef.current) {
          track.classList.remove("canvas-scrollbar--visible");
        }
      }, 1000);
    };

    // ========================================
    // RAF throttle wrapper
    // ========================================

    const scheduleUpdate = () => {
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
        updateThumb();
        showScrollbar();
      });
    };

    // ========================================
    // 리스너 연결
    // ========================================

    // ViewportController가 단일 권한 소유자 (ADR-035 Phase 2)
    // Zustand store의 zoom/panOffset은 mirror이므로 이중 구독하지 않는다.
    const removeVCListener =
      getViewportController().addUpdateListener(scheduleUpdate);

    // 소스 3: ResizeObserver (track 크기 변경)
    const trackResizeObserver = new ResizeObserver(() => {
      scheduleUpdate();
    });
    trackResizeObserver.observe(track);

    // 소스 4: viewport sync store (containerSize / canvasSize)
    //
    // 마운트 시점에는 containerSize 가 아직 0 이라 `getScrollbarViewportMetrics` 가
    // null 을 돌려주고 초기 `updateThumb()` 이 아무것도 그리지 못한다. 위 세 소스는
    // 전부 그 뒤의 **변화**만 알려주므로(뷰포트 조작 · track 리사이즈 · 패널 토글),
    // 첫 pan/zoom 전까지 thumb 이 크기 0 으로 남았다. containerSize 가 채워지는
    // 순간을 잡아야 초기 렌더가 완성된다. canvasSize 는 아트보드 크기라 world
    // 범위의 입력이기도 하다 (breakpoint 전환 시 재계산 필요).
    let lastSyncKey = "";
    const unsubViewportSync = useViewportSyncStore.subscribe((state) => {
      const key = `${state.containerSize.width}x${state.containerSize.height}|${state.canvasSize.width}x${state.canvasSize.height}`;
      if (key === lastSyncKey) return;
      lastSyncKey = key;
      updatePanelOffset();
      scheduleUpdate();
    });

    // 소스 5: 페이지 위치 (world 범위의 content 입력)
    //
    // 페이지 추가/삭제/재배치는 뷰포트를 건드리지 않으므로 위 소스에 걸리지 않는다.
    // 전체 store 구독이지만 비교는 카운터 하나이고 갱신은 rAF 로 합쳐진다.
    let lastPagePositionsVersion = useStore.getState().pagePositionsVersion;
    const unsubPagePositions = useStore.subscribe((state) => {
      if (state.pagePositionsVersion === lastPagePositionsVersion) return;
      lastPagePositionsVersion = state.pagePositionsVersion;
      scheduleUpdate();
    });

    // 패널 상태 구독 (showLeft/Right + activeLeftPanels/activeRightPanels)
    const unsubPanel = subscribeToPanelLayoutChanges({
      onLayoutChange: () => {
        updatePanelOffset();
        scheduleUpdate();
      },
    });

    // ========================================
    // Thumb 드래그 (Pointer Capture)
    // ========================================

    const handlePointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const session = beginViewportInteraction("scrollbar");
      if (!session) return;

      thumb.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      thumb.classList.add("canvas-scrollbar__thumb--dragging");
      track.classList.add("canvas-scrollbar--visible");

      const startPos = isHorizontal ? e.clientX : e.clientY;
      const vc = getViewportController();
      scrollbarSession = session;
      const startState = vc.getState();
      let queuedViewport = startState;
      const startMetrics = getScrollbarViewportMetrics(
        panelInsetRef.current,
        startState,
      );
      if (!startMetrics) {
        session.finish("interrupted");
        scrollbarSession = null;
        isDraggingRef.current = false;
        thumb.classList.remove("canvas-scrollbar__thumb--dragging");
        return;
      }

      const onMove = (me: PointerEvent) => {
        const delta = (isHorizontal ? me.clientX : me.clientY) - startPos;
        const trackLength = isHorizontal
          ? track.clientWidth
          : track.clientHeight;
        const axis = getScrollbarAxisMetrics(
          startMetrics,
          direction,
          trackLength,
        );
        if (!axis || axis.scrollableTrack <= 0) return;

        const worldDelta =
          (delta / axis.scrollableTrack) * axis.scrollableWorld;

        let newX: number;
        let newY: number;
        if (isHorizontal) {
          newX =
            panelInsetRef.current.left -
            (startMetrics.visibleViewport.x + worldDelta) *
              startMetrics.viewportState.scale;
          newY = startState.y;
        } else {
          newX = startState.x;
          newY =
            -(startMetrics.visibleViewport.y + worldDelta) *
            startMetrics.viewportState.scale;
        }

        if (!session.isActiveKind("scrollbar")) return;
        const nextViewport = {
          scale: startMetrics.viewportState.scale,
          x: newX,
          y: newY,
        };
        session.queuePan({
          x: nextViewport.x - queuedViewport.x,
          y: nextViewport.y - queuedViewport.y,
        });
        queuedViewport = nextViewport;
      };

      const onUp = () => {
        if (session.isActiveKind("scrollbar")) {
          session.finish("pointerup");
        }
        if (scrollbarSession === session) {
          scrollbarSession = null;
        }
        isDraggingRef.current = false;
        thumb.classList.remove("canvas-scrollbar__thumb--dragging");
        thumb.removeEventListener("pointermove", onMove);
        thumb.removeEventListener("pointerup", onUp);
        thumb.removeEventListener("lostpointercapture", onUp);
        showScrollbar();
      };

      thumb.addEventListener("pointermove", onMove);
      thumb.addEventListener("pointerup", onUp);
      thumb.addEventListener("lostpointercapture", onUp);
    };

    thumb.addEventListener("pointerdown", handlePointerDown);

    // ========================================
    // Track 클릭
    // ========================================

    const handleTrackClick = (e: MouseEvent) => {
      if (e.target === thumb) return;
      if (isDraggingRef.current) return;

      const trackRect = track.getBoundingClientRect();
      const clickPos = isHorizontal
        ? e.clientX - trackRect.left
        : e.clientY - trackRect.top;
      const trackLength = isHorizontal ? track.clientWidth : track.clientHeight;

      const vc = getViewportController();
      const metrics = getScrollbarViewportMetrics(
        panelInsetRef.current,
        vc.getState(),
      );
      if (!metrics) return;

      const axis = getScrollbarAxisMetrics(metrics, direction, trackLength);
      if (!axis || axis.scrollableTrack <= 0) return;

      // 클릭 위치를 thumb 중앙으로
      const targetThumbStart = clickPos - axis.thumbSize / 2;
      const ratio = Math.max(
        0,
        Math.min(1, targetThumbStart / axis.scrollableTrack),
      );
      const targetWorldStart = axis.worldMin + ratio * axis.scrollableWorld;

      let newX: number;
      let newY: number;
      if (isHorizontal) {
        newX =
          panelInsetRef.current.left -
          targetWorldStart * metrics.viewportState.scale;
        newY = metrics.viewportState.y;
      } else {
        newX = metrics.viewportState.x;
        newY = -targetWorldStart * metrics.viewportState.scale;
      }

      applyViewportState({
        scale: metrics.viewportState.scale,
        x: newX,
        y: newY,
      });
    };

    track.addEventListener("click", handleTrackClick);

    // ========================================
    // 초기화
    // ========================================

    updatePanelOffset();
    updateThumb();

    // ========================================
    // Cleanup
    // ========================================

    return () => {
      removeVCListener();
      unsubPanel();
      unsubViewportSync();
      unsubPagePositions();
      trackResizeObserver.disconnect();
      thumb.removeEventListener("pointerdown", handlePointerDown);
      track.removeEventListener("click", handleTrackClick);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (scrollbarSession?.isActiveKind("scrollbar")) {
        scrollbarSession.finish("interrupted");
      }
    };
  }, [direction]);

  return (
    <div
      ref={trackRef}
      className={`canvas-scrollbar canvas-scrollbar--${direction}`}
    >
      <div ref={thumbRef} className="canvas-scrollbar__thumb" />
    </div>
  );
}
