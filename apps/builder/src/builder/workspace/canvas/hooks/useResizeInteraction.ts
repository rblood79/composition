/**
 * ADR-224 — 선택 박스 핸들 resize 상호작용 (breakdown §4.3 · §5).
 *
 * 중앙 pointer 핸들러가 핸들 히트에서 `startResize` 를 부른다 (단일 선택 · body 제외). 여기서
 * gesture owner 를 resize 로 승격하고 `ResizePresentationSession` 을 연다. move 는 시작 zoom
 * 기준 scene delta → 핸들 기하 (`resolveResizeRequest`) → `setSize` (프레임당 publish 는 runtime
 * 이 병합), up 은 `finish` (commit 1 — 그 축의 Fill 해제 + CSS px), Escape/pointercancel/blur/
 * 선택 변경은 cancel. 임계값 미만 pointerup 은 클릭 (no-op).
 *
 * marker 축을 잡으면 미리보기도 그 축의 Fill 파생 CSS 를 지운 채 엔진이 놓는다 — commit 과 같은
 * 집합 (`resolveFillReleasePatch`). Ratio 잠금이면 driver 축 하나만 요청한다.
 */

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useViewportSyncStore } from "../stores";
import { requestCanvasFrame } from "../skia/frameScheduler";
import { getSceneBounds } from "../skia/renderCommands";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";
import type { BoundingBox, HandlePosition } from "../selection/types";
import {
  resolveResizeAxes,
  resolveResizeRequest,
  type ResizeRatioLockInput,
} from "../interaction/resizeGeometry";
import {
  resolveFillReleasePatch,
  resolveResizeRatioLock,
} from "../../../stores/utils/canvasResizeEdit";
import {
  ResizePresentationSession,
  getActiveResizeSession,
  setActiveResizeSession,
} from "../../../presentation/editorPresentationResizeSession";
import { editorPresentationFillPilotRuntime } from "../../../presentation/editorPresentationFillPilot";

/** 클릭 ↔ 드래그 갈림 (screen px) — element drag 의 DRAG_THRESHOLD 와 같은 값 */
const RESIZE_DRAG_THRESHOLD_PX = 3;

let nextOwnerId = 1;

interface ResizeDragState {
  readonly pointerId: number;
  readonly session: ResizePresentationSession;
  readonly handle: HandlePosition;
  readonly startBounds: BoundingBox;
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startZoom: number;
  readonly lock: ResizeRatioLockInput | null;
  dragging: boolean;
}

interface UseResizeInteractionOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  gestureSession: CanvasGestureSession;
}

export interface ResizeInteractionApi {
  /**
   * 핸들 pointerdown — 세션을 열고 true. 문맥을 못 읽거나 (요소 없음) 승격이 안 되면 false
   * (호출부는 그대로 return — 이전과 같이 조작 없음).
   */
  startResize: (
    elementId: string,
    handle: HandlePosition,
    bounds: BoundingBox,
    event: PointerEvent,
    /** 핸들 커서 — 드래그 동안 유지 (중앙 핸들러의 move 가 이 pointer 를 무시하므로 여기서 세운다) */
    cursor: string,
  ) => boolean;
}

export function useResizeInteraction({
  containerRef,
  gestureSession,
}: UseResizeInteractionOptions): ResizeInteractionApi {
  const dragRef = useRef<ResizeDragState | null>(null);
  const ownerIdRef = useRef(`canvas-resize-${nextOwnerId++}`);

  const endDrag = useCallback(
    (
      outcome: "finish" | "cancel",
      reason:
        | "escape"
        | "pointer-cancel"
        | "blur"
        | "unmount"
        | "selection-change" = "pointer-cancel",
    ) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      gestureSession.endPointer(drag.pointerId);
      if (outcome === "finish" && drag.dragging) {
        drag.session.finish();
      } else {
        // 클릭 (임계값 미만) 도 세션은 닫는다 — 저장 0
        drag.session.cancel(outcome === "finish" ? "superseded" : reason);
      }
      if (getActiveResizeSession() === drag.session) {
        setActiveResizeSession(null);
      }
      requestCanvasFrame();
    },
    [gestureSession],
  );

  useEffect(() => {
    const handleMove = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.session.phase !== "active") {
        // 문서 교체·conflict 로 runtime 이 먼저 닫았다 — 드래그도 정리
        endDrag("cancel");
        return;
      }
      const dxClient = event.clientX - drag.startClientX;
      const dyClient = event.clientY - drag.startClientY;
      if (
        !drag.dragging &&
        Math.hypot(dxClient, dyClient) >= RESIZE_DRAG_THRESHOLD_PX
      ) {
        drag.dragging = true;
      }
      if (!drag.dragging) return;
      drag.session.setSize(
        resolveResizeRequest({
          handle: drag.handle,
          startBounds: drag.startBounds,
          dx: dxClient / drag.startZoom,
          dy: dyClient / drag.startZoom,
          lock: drag.lock,
        }),
      );
    };
    const handleUp = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag("finish");
    };
    const handleCancel = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      endDrag("cancel", "pointer-cancel");
    };
    const handleBlur = (): void => {
      if (dragRef.current) endDrag("cancel", "blur");
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("blur", handleBlur);
      if (dragRef.current) endDrag("cancel", "unmount");
    };
  }, [endDrag]);

  // Escape 는 드래그 중일 때만 가로챈다 (spacing 과 같은 어법) — 전역 Escape (선택 해제) 가
  // 같은 keydown 에 돌지 않게 capture 단계에서 stopPropagation.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || !dragRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      endDrag("cancel", "escape");
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [endDrag]);

  // 선택이 바뀌면 (다른 요소 · 해제) 세션 취소 — 잡고 있던 요소의 값을 다른 선택에 저장하지 않는다
  useEffect(
    () =>
      useStore.subscribe((state, previous) => {
        const drag = dragRef.current;
        if (!drag || state.selectedElementIds === previous.selectedElementIds)
          return;
        if (
          state.selectedElementIds.length !== 1 ||
          state.selectedElementIds[0] !== drag.session.nodeId
        ) {
          endDrag("cancel", "selection-change");
        }
      }),
    [endDrag],
  );

  const startResize = useCallback<ResizeInteractionApi["startResize"]>(
    (elementId, handle, bounds, event, cursor) => {
      if (dragRef.current) return false;
      const store = useStore.getState();
      const sizing = store.readCanvasSizingContext(elementId);
      if (!sizing) return false;
      const projectId = useCanonicalDocumentStore.getState().currentProjectId;
      if (!projectId) return false;
      if (!gestureSession.promoteElementToResize(event.pointerId)) return false;

      const lock = resolveResizeRatioLock(sizing.effectiveStyle, sizing.fill);
      // 요청될 축 = 핸들이 닿는 축, Ratio 면 driver 하나 — 그 축들의 Fill 파생 CSS 만 미리보기에서 지운다
      const axes = resolveResizeAxes(handle);
      const releasePatch: Record<string, ""> = {};
      for (const axis of ["width", "height"] as const) {
        const requested = lock ? lock.driver === axis : axes[axis];
        if (!requested) continue;
        Object.assign(
          releasePatch,
          resolveFillReleasePatch(
            sizing.effectiveStyle,
            sizing.fill,
            axis,
            sizing.context,
          ),
        );
      }
      const zoom = useViewportSyncStore.getState().zoom;
      let session: ResizePresentationSession;
      try {
        session = new ResizePresentationSession({
          nodeId: elementId,
          projectId,
          ownerId: ownerIdRef.current,
          runtime: editorPresentationFillPilotRuntime,
          startSize: { width: bounds.width, height: bounds.height },
          releasePatch,
        });
      } catch {
        gestureSession.endPointer(event.pointerId);
        return false;
      }
      setActiveResizeSession(session);
      dragRef.current = {
        pointerId: event.pointerId,
        session,
        handle,
        startBounds: bounds,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startZoom: zoom === 0 ? 1 : zoom,
        lock,
        dragging: false,
      };
      const container = containerRef.current;
      if (container) container.style.cursor = cursor;
      return true;
    },
    [containerRef, gestureSession],
  );

  return { startResize };
}

// dev 전용 디버그 전역 — live 하니스가 핸들 위치 (scene bounds) 와 세션 상태를 읽는다
// (`__composition_SPACING_DEBUG__` 와 같은 이유). production 빌드 제외.
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (window as unknown as Record<string, unknown>).__composition_RESIZE_DEBUG__ =
    {
      getSceneBounds,
      getActiveSession: () => {
        const session = getActiveResizeSession();
        return session
          ? {
              nodeId: session.nodeId,
              phase: session.phase,
              requested: session.requested,
              lastRejectReason: session.lastRejectReason,
            }
          : null;
      },
    };
}
