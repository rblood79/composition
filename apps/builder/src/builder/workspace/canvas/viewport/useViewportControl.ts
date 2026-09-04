/**
 * useViewportControl Hook
 *
 * 컨테이너 DOM 요소에 pan/zoom 입력(포인터 드래그 · 휠)을 바인딩하고
 * `ViewportController` 에 반영한다. React state 동기화는 인터랙션 종료 시점.
 *
 * 구 `app` / `cameraLabel` 옵션은 삭제됐다 (2026-08-15) — 유일한 호출부가
 * `app={null}` 하드코딩이라 그 블록은 도달 불가였다.
 *
 * @since 2025-12-12 Phase 12 B3.2
 */

import { useEffect, useRef, useCallback, useMemo, type RefObject } from "react";
import {
  type ViewportState,
  type ViewportController,
  getViewportController,
} from "./ViewportController";
import { getViewportInteractionSession } from "./ViewportInteractionSession";
import {
  isCanvasViewportSnapshotEqual,
  selectCanvasViewportSnapshot,
  useViewportSyncStore,
} from "../stores";
import { offsetViewportStateX } from "./viewportActions";
import { useKeyboardShortcutsRegistry } from "@/builder/hooks";
import { useScrollState, isScrollable } from "../../../stores/scrollState";
import { useStore } from "../../../stores";
import { getCanonicalNode } from "../../../stores/canonical/canonicalElementsBridge";
import { resolveEffectiveOverflow } from "../layout/engines/implicitStyles";
import { observe, PERF_LABEL } from "../../../utils/perfMarks";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";
import {
  recordViewportInteractionMirrorCommit,
  recordViewportInteractionRafFrame,
  recordViewportInteractionRawInput,
  recordViewportInteractionTransientApply,
} from "./viewportInteractionMetrics";

// ============================================
// Types
// ============================================

export interface UseViewportControlOptions {
  /** 최소 줌 */
  minZoom?: number;
  /** 최대 줌 */
  maxZoom?: number;
  /** HTML 컨테이너 요소 (이벤트 바인딩용) */
  containerEl?: HTMLElement | null;
  // 🚀 Phase 6.1: 인터랙션 콜백 (동적 해상도 연동용)
  /** 팬/줌 인터랙션 시작 시 호출 */
  onInteractionStart?: () => void;
  /** 팬/줌 인터랙션 종료 시 호출 */
  onInteractionEnd?: () => void;
  /** 초기 Pan Offset X (비교 모드 등에서 사용) */
  initialPanOffsetX?: number;
  /** Canvas pointer session 제스처 소유권 */
  gestureSession: CanvasGestureSession;
}

export interface UseViewportControlReturn {
  /** 현재 ViewportController 인스턴스 */
  controller: ViewportController | null;
  /** 팬 중인지 여부 (render 중 access 금지) */
  isPanningRef: RefObject<boolean>;
}

// ============================================
// Hook
// ============================================

export function useViewportControl(
  options: UseViewportControlOptions,
): UseViewportControlReturn {
  const {
    minZoom = 0.1,
    maxZoom = 5,
    containerEl,
    // 🚀 Phase 6.1: 인터랙션 콜백
    onInteractionStart,
    onInteractionEnd,
    initialPanOffsetX,
    gestureSession,
  } = options;
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<{ x: number; y: number } | null>(null);
  // 휠 interaction 종료 디바운스 타이머
  const wheelEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isZoomingRef = useRef(false);

  // 🚀 Phase 6.1: 콜백 ref (의존성 배열에서 제외하여 useEffect 재실행 방지)
  const onInteractionStartRef = useRef(onInteractionStart);
  const onInteractionEndRef = useRef(onInteractionEnd);
  useEffect(() => {
    onInteractionStartRef.current = onInteractionStart;
    onInteractionEndRef.current = onInteractionEnd;
  });

  // Zustand store actions
  const setViewportSnapshot = useViewportSyncStore(
    (state) => state.setViewportSnapshot,
  );

  // React state로 동기화하는 콜백
  const handleStateSync = useCallback(
    (state: ViewportState) => {
      recordViewportInteractionMirrorCommit();
      setViewportSnapshot({
        panOffset: { x: state.x, y: state.y },
        zoom: state.scale,
      });
    },
    [setViewportSnapshot],
  );

  const controller = useMemo(() => {
    return getViewportController({ minZoom, maxZoom });
  }, [minZoom, maxZoom]);

  const viewportSession = useMemo(
    () =>
      getViewportInteractionSession({
        controller,
        commitMirror: handleStateSync,
        onControllerApply: () => recordViewportInteractionTransientApply(),
        onFrame: (timestamp) => recordViewportInteractionRafFrame(timestamp),
        readMirror: () => {
          const { panOffset, zoom } = useViewportSyncStore.getState();
          return { x: panOffset.x, y: panOffset.y, scale: zoom };
        },
      }),
    [controller, handleStateSync],
  );

  // onStateSync 콜백을 싱글톤에 설정 (싱글톤 생성 후 지연 바인딩)
  useEffect(() => {
    if (controller) {
      controller.setOnStateSync(handleStateSync);
    }
  }, [controller, handleStateSync]);

  const containerElRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    containerElRef.current = containerEl ?? null;
  }, [containerEl]);

  // 팬 모드 커서 스타일 (자식 요소 포함 !important)
  const panCursorStyleRef = useRef<HTMLStyleElement | null>(null);

  const applyPanCursor = useCallback((cursor: "grab" | "grabbing" | null) => {
    // 기존 스타일 제거
    if (panCursorStyleRef.current) {
      panCursorStyleRef.current.remove();
      panCursorStyleRef.current = null;
    }

    if (cursor && containerElRef.current) {
      // 동적 스타일 태그 생성 (자식 요소 포함 !important)
      const style = document.createElement("style");
      const containerId = containerElRef.current.id || "viewport-container";
      if (!containerElRef.current.id) {
        containerElRef.current.id = containerId;
      }
      style.textContent = `#${containerId}, #${containerId} * { cursor: ${cursor} !important; }`;
      document.head.appendChild(style);
      panCursorStyleRef.current = style;
    }
  }, []);

  // applyPanCursor를 ref로 저장 (마우스 핸들러에서 사용)
  const applyPanCursorRef = useRef(applyPanCursor);
  useEffect(() => {
    applyPanCursorRef.current = applyPanCursor;
  }, [applyPanCursor]);

  // cleanup 시 스타일 제거
  useEffect(() => {
    return () => {
      if (panCursorStyleRef.current) {
        panCursorStyleRef.current.remove();
        panCursorStyleRef.current = null;
      }
    };
  }, []);

  // 초기 뷰포트 상태를 Controller 에 적용
  useEffect(() => {
    if (!controller) return;

    // 초기 상태 적용 (Zustand에서 읽어서 Controller에 적용)
    const { zoom, panOffset, setViewportSnapshot } =
      useViewportSyncStore.getState();
    const initialViewport =
      initialPanOffsetX !== undefined
        ? offsetViewportStateX(
            { scale: zoom, x: panOffset.x, y: panOffset.y },
            initialPanOffsetX,
          )
        : { scale: zoom, x: panOffset.x, y: panOffset.y };

    controller.setPosition(
      initialViewport.x,
      initialViewport.y,
      initialViewport.scale,
    );
    // Store도 동기화 (다른 컴포넌트에서 panOffset을 읽을 때 반영되도록)
    if (initialPanOffsetX !== undefined) {
      setViewportSnapshot({
        panOffset: { x: initialViewport.x, y: initialViewport.y },
        zoom: initialViewport.scale,
      });
    }
  }, [controller, initialPanOffsetX]);

  // 마우스 이벤트 핸들러 (팬)
  useEffect(() => {
    if (!containerEl || !controller) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (gestureSession.blocksPointerDown(e.pointerId)) {
        return;
      }

      if (gestureSession.beginPointer(e.pointerId, e.button) === "pan") {
        e.preventDefault();
        // 🚀 Phase 6.1: 인터랙션 시작 알림 (ref 사용)
        onInteractionStartRef.current?.();
        viewportSession.begin("drag");
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        isPanningRef.current = true;
        applyPanCursorRef.current("grabbing");
      }
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      const lastPanPoint = lastPanPointRef.current;
      if (!isPanningRef.current || !lastPanPoint) return;
      observe(PERF_LABEL.INPUT_VIEWPORT_DRAG, () => {
        const delta = {
          x: e.clientX - lastPanPoint.x,
          y: e.clientY - lastPanPoint.y,
        };
        lastPanPointRef.current = { x: e.clientX, y: e.clientY };
        recordViewportInteractionRawInput();
        viewportSession.queuePan(delta);
      });
    };

    const handleWindowPointerEnd = (e: PointerEvent) => {
      if (
        !isPanningRef.current ||
        gestureSession.ownerFor(e.pointerId) !== "pan"
      ) {
        return;
      }

      viewportSession.finish(
        e.type === "pointercancel" ? "interrupted" : "pointerup",
      );
      lastPanPointRef.current = null;
      isPanningRef.current = false;
      // Space가 여전히 눌려있으면 grab, 아니면 null
      applyPanCursorRef.current(gestureSession.spacePressed ? "grab" : null);
      // 🚀 Phase 6.1: 인터랙션 종료 알림 (ref 사용)
      onInteractionEndRef.current?.();
      gestureSession.endPointer(e.pointerId);
    };

    containerEl.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);

    return () => {
      containerEl.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
      if (isPanningRef.current) {
        viewportSession.finish("interrupted");
        lastPanPointRef.current = null;
        isPanningRef.current = false;
      }
    };
  }, [containerEl, controller, gestureSession, viewportSession]);

  // 휠 이벤트 핸들러 (줌/팬) - Figma/Photoshop 스타일
  useEffect(() => {
    if (!containerEl || !controller) return;

    const finishWheelInteraction = (reason: "idle" | "interrupted") => {
      if (wheelEndTimeoutRef.current) {
        clearTimeout(wheelEndTimeoutRef.current);
        wheelEndTimeoutRef.current = null;
      }
      viewportSession.finish(reason);
      if (isZoomingRef.current) {
        isZoomingRef.current = false;
        onInteractionEndRef.current?.();
      }
    };

    const scheduleWheelEnd = () => {
      if (wheelEndTimeoutRef.current) {
        clearTimeout(wheelEndTimeoutRef.current);
      }
      wheelEndTimeoutRef.current = setTimeout(() => {
        finishWheelInteraction("idle");
      }, 150);
    };

    const handleWheel = (e: WheelEvent) => {
      const label =
        e.ctrlKey || e.metaKey
          ? PERF_LABEL.INPUT_VIEWPORT_WHEEL_ZOOM
          : PERF_LABEL.INPUT_VIEWPORT_WHEEL_PAN;

      observe(label, () => {
        // Ctrl/Cmd + wheel = Zoom
        if (e.ctrlKey || e.metaKey) {
          recordViewportInteractionRawInput();
          e.preventDefault();
          e.stopPropagation();

          // 🚀 Phase 6.1: 줌 시작 알림 (최초 1회만, ref 사용)
          if (!isZoomingRef.current) {
            isZoomingRef.current = true;
            onInteractionStartRef.current?.();
          }

          const rect = containerEl.getBoundingClientRect();

          // Pencil 방식: deltaY 클램핑 + 0.012 계수
          // ctrlKey(마우스 휠) → ±30 클램핑, metaKey(트랙패드 핀치) → ±15 클램핑
          // 마우스 휠 1클릭(deltaY=120) → clamp=30 → 36% 줌 변화
          // 트랙패드 핀치(deltaY=3) → clamp=3 → 3.6% 줌 변화
          const clampRange = e.metaKey ? 15 : 30;
          const clamped = Math.max(-clampRange, Math.min(clampRange, e.deltaY));
          const delta = clamped * -0.012;

          viewportSession.begin("wheel-zoom");
          viewportSession.queueZoomAt({
            anchor: {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            },
            delta,
          });
          scheduleWheelEnd();
        } else {
          // 일반 휠 = 팬 (Figma/Photoshop 스타일)
          e.preventDefault();
          e.stopPropagation();

          // Phase E: 선택된 스크롤 가능 요소에 wheel 라우팅
          const selectedIds = useStore.getState().selectedElementIds;
          if (selectedIds.length === 1) {
            const selectedId = selectedIds[0];
            const node = getCanonicalNode(selectedId);
            const overflow = resolveEffectiveOverflow(
              node?.type,
              node?.props?.style as Record<string, unknown> | undefined,
            );
            if (
              (overflow === "scroll" || overflow === "auto") &&
              isScrollable(selectedId)
            ) {
              const deltaX = e.shiftKey ? e.deltaY : e.deltaX;
              const deltaY = e.shiftKey ? 0 : e.deltaY;
              useScrollState.getState().scrollBy(selectedId, deltaX, deltaY);
              return;
            }
          }

          recordViewportInteractionRawInput();

          // Shift + wheel = 좌우 팬, 일반 wheel = 상하 팬
          const rawDeltaX = e.shiftKey ? e.deltaY : e.deltaX;
          const rawDeltaY = e.shiftKey ? 0 : e.deltaY;

          if (isZoomingRef.current) {
            isZoomingRef.current = false;
            onInteractionEndRef.current?.();
          }
          viewportSession.begin("wheel-pan");
          viewportSession.queuePan({ x: -rawDeltaX, y: -rawDeltaY });
          scheduleWheelEnd();
        }
      });
    };

    containerEl.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    return () => {
      containerEl.removeEventListener("wheel", handleWheel, { capture: true });
      finishWheelInteraction("interrupted");
    };
  }, [containerEl, controller, viewportSession]);

  useEffect(() => {
    const interruptViewportInteraction = () => {
      if (wheelEndTimeoutRef.current) {
        clearTimeout(wheelEndTimeoutRef.current);
        wheelEndTimeoutRef.current = null;
      }

      const wasPanning = isPanningRef.current;
      const wasZooming = isZoomingRef.current;
      viewportSession.finish("interrupted");
      lastPanPointRef.current = null;
      isPanningRef.current = false;
      isZoomingRef.current = false;

      if (wasPanning) {
        applyPanCursorRef.current(gestureSession.spacePressed ? "grab" : null);
      }
      if (wasPanning || wasZooming) {
        onInteractionEndRef.current?.();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        interruptViewportInteraction();
      }
    };

    window.addEventListener("blur", interruptViewportInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", interruptViewportInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [gestureSession, viewportSession]);

  // 외부 React state 변경 시 Controller에 반영
  useEffect(() => {
    if (!controller || viewportSession.isActive()) return;

    const viewport = selectCanvasViewportSnapshot(
      useViewportSyncStore.getState(),
    );
    controller.setPosition(
      viewport.panOffset.x,
      viewport.panOffset.y,
      viewport.zoom,
    );
  }, [controller, viewportSession]);

  // Zustand store 변경 구독 (외부에서 줌/팬 변경 시)
  useEffect(() => {
    if (!controller) return;

    const unsubscribe = useViewportSyncStore.subscribe(
      selectCanvasViewportSnapshot,
      (viewport) => {
        if (!controller || viewportSession.isActive()) return;
        controller.setPosition(
          viewport.panOffset.x,
          viewport.panOffset.y,
          viewport.zoom,
        );
      },
      { equalityFn: isCanvasViewportSnapshotEqual },
    );

    return unsubscribe;
  }, [controller, viewportSession]);

  // 스페이스바 팬 모드 (cursor만 변경)
  useKeyboardShortcutsRegistry(
    [
      {
        key: "Space",
        code: "Space",
        modifier: "none",
        preventDefault: false,
        disabled: !containerEl,
        handler: () => {
          if (gestureSession.spacePressed) return;
          gestureSession.setSpacePressed(true);
          applyPanCursor("grab");
        },
      },
    ],
    [containerEl, gestureSession, applyPanCursor],
  );

  useKeyboardShortcutsRegistry(
    [
      {
        key: "Space",
        code: "Space",
        modifier: "none",
        preventDefault: false,
        disabled: !containerEl,
        handler: () => {
          gestureSession.setSpacePressed(false);
          if (!isPanningRef.current) {
            applyPanCursor(null);
          }
        },
      },
    ],
    [containerEl, gestureSession, applyPanCursor],
    { eventType: "keyup" },
  );

  return {
    controller,
    isPanningRef,
  };
}

export default useViewportControl;
