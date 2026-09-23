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
import { resolveSubpartStyleOwnerTypeById } from "../../../stores/canonical/subpartOwnerLookup";
import { useViewportSyncStore } from "../stores";
import { requestCanvasFrame } from "../skia/frameScheduler";
import { getSceneBounds } from "../skia/renderCommands";
import { parseNumericValue } from "../layout/engines/utils";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";
import {
  usePointerDragLifecycle,
  type PointerDragCancelReason,
} from "../interaction/usePointerDragLifecycle";
import type { BoundingBox, HandlePosition } from "../selection/types";
import {
  resolveResizeAxes,
  resolveResizeRequest,
  type ResizeRatioLockInput,
  type ResizeStartPosition,
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
  /** absolute 요소의 시작 CSS left/top (px) — left/top 핸들이 위치도 옮긴다. 흐름 요소는 null */
  readonly position: ResizeStartPosition | null;
  dragging: boolean;
}

function parseCssPx(value: unknown): number | null {
  const parsed = parseNumericValue(value);
  return parsed !== undefined && Number.isFinite(parsed) ? parsed : null;
}

/** absolute + px left/top 일 때만 위치 이동 — auto 면 containing block 원점을 모르니 크기만 */
function resolveStartPosition(
  style: Record<string, unknown>,
): ResizeStartPosition | null {
  if (style.position !== "absolute") return null;
  const left = parseCssPx(style.left);
  const top = parseCssPx(style.top);
  if (left === null || top === null) return null;
  return { left, top };
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
      reason: PointerDragCancelReason = "pointer-cancel",
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

  const onMove = useCallback(
    (drag: ResizeDragState, dxClient: number, dyClient: number) => {
      drag.session.setSize(
        resolveResizeRequest({
          handle: drag.handle,
          startBounds: drag.startBounds,
          dx: dxClient / drag.startZoom,
          dy: dyClient / drag.startZoom,
          lock: drag.lock,
          position: drag.position,
        }),
      );
    },
    [],
  );
  usePointerDragLifecycle({ dragRef, endDrag, onMove });

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
      // read-only sub-part (TextField 의 Label 등) 의 크기는 owner rule 이 정한다 — 여기서 쓴 값은
      //   layout · Skia · DOM 이 모두 무시한다. 패널과 같은 판정으로 세션을 열지 않는다.
      if (resolveSubpartStyleOwnerTypeById(elementId, store.elementsMap)) {
        return false;
      }
      const sizing = store.readCanvasSizingContext(elementId);
      if (!sizing) return false;
      const projectId = useCanonicalDocumentStore.getState().currentProjectId;
      if (!projectId) return false;
      if (!gestureSession.promoteElement(event.pointerId, "resize"))
        return false;

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
      const position = resolveStartPosition(sizing.effectiveStyle);
      const zoom = useViewportSyncStore.getState().zoom;
      let session: ResizePresentationSession;
      try {
        session = new ResizePresentationSession({
          nodeId: elementId,
          projectId,
          ownerId: ownerIdRef.current,
          runtime: editorPresentationFillPilotRuntime,
          startSize: {
            width: bounds.width,
            height: bounds.height,
            ...(position ?? {}),
          },
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
        position,
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
