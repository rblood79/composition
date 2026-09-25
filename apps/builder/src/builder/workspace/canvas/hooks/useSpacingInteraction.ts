/**
 * ADR-222 — 캔버스 padding·gap 직접 편집 상호작용 (breakdown §1.2 상태 머신 · §4 transaction).
 *
 * 세 가지를 한 훅이 소유한다 — 나누면 owner 교체·hover·드래그 정리가 세 벌이 되어
 * 한쪽만 고쳐지는 형태로 어긋난다 (useGuideDrag 와 같은 이유):
 *
 * 1. **owner 동기화** — 선택·layout publish 마다 `resolveSpacingCapability` 로 지원
 *    컨테이너를 판정해 `setSpacingOwner`. 활성 세션 중에는 교체하지 않고, 선택이
 *    바뀌면 세션을 취소한다.
 * 2. **hover** — window pointermove (RAF 스로틀) 로 띠 히트 → `setSpacingHover` (사선). resize 커서는
 *    핸들 위에서만 (2026-09-26 — 드래그 대상은 핸들뿐).
 * 3. **드래그** — BuilderCanvas 의 pointerdown capture 가 `resolveSpacingPointerDown` 을
 *    먼저 부른다. 히트면 gesture owner 를 spacing 으로 승격하고 `SpacingPresentationSession`
 *    을 연다. move 는 시작 zoom 기준 scene delta → `setDelta` (프레임당 publish 는 세션이
 *    runtime scheduler 로 병합), up 은 `finish` (receipt 확인 후 commit 1), Escape/
 *    pointercancel/blur/선택 변경은 cancel. 임계값 미만 pointerup 은 클릭 — 인라인
 *    입력 (Phase 2) 으로 넘긴다.
 *
 * 저장은 세션 finish 의 commit 한 번뿐이다 (HC1).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useStore } from "../../../stores";
import { useViewportSyncStore } from "../stores";
import { viewportToScreenPoint } from "../viewport/viewportTransforms";
import { isRulerEventTarget } from "../../components/rulerOverlayUtils";
import { requestCanvasFrame } from "../skia/frameScheduler";
import { onLayoutPublished } from "../layout/engines/fullTreeLayout";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";
import {
  usePointerDragLifecycle,
  type PointerDragCancelReason,
} from "../interaction/usePointerDragLifecycle";
import { pointInBox } from "../selection/types";
import {
  SPACING_SIDES,
  resolveSpacingCapability,
  type SpacingSide,
} from "../../../presentation/editorPresentationSpacingCapability";
import { getPaddingLinked } from "../../../panels/styles/components/boxModelLink";
import {
  SpacingPresentationSession,
  getActiveSpacingSession,
  setActiveSpacingSession,
} from "../../../presentation/editorPresentationSpacingSession";
import { editorPresentationFillPilotRuntime } from "../../../presentation/editorPresentationFillPilot";
import {
  getSpacingPresentationSnapshot,
  resolveSpacingBands,
  setSpacingActive,
  setSpacingHover,
  setSpacingOwner,
} from "../interaction/spacingPresentation";
import {
  hitTestSpacingBands,
  resolveSpacingCursor,
  resolveSpacingHandleRect,
  spacingDeltaFromPointer,
  type SpacingBand,
  type SpacingHit,
} from "../interaction/spacingGeometry";
import type { SpacingInlineInputState } from "../overlay/spacing/SpacingInlineInput";

/** Shift 큰 단위 step (px) — breakdown §1.1 제안값 (Figma 설정과 동일하다고 주장하지 않는다) */
const SPACING_SHIFT_STEP = 10;

let spacingHoverCursor: string | null = null;
let nextOwnerId = 1;

/** 지금 포인터가 spacing 띠 위인가 — BuilderCanvas.setCursor 우선순위 입력 (가이드 커서와 같은 어법) */
export function getSpacingHoverCursor(): string | null {
  return spacingHoverCursor;
}

interface SpacingDragState {
  readonly pointerId: number;
  readonly session: SpacingPresentationSession;
  readonly band: SpacingBand;
  readonly bandIds: readonly string[];
  readonly startClientX: number;
  readonly startClientY: number;
  readonly startZoom: number;
  readonly shift: boolean;
  dragging: boolean;
}

interface UseSpacingInteractionOptions {
  containerRef: RefObject<HTMLDivElement | null>;
  gestureSession: CanvasGestureSession;
  screenToCanvasPoint: (point: { x: number; y: number }) => {
    x: number;
    y: number;
  };
}

export interface SpacingInteractionApi {
  /**
   * pointerdown capture 에서 호출. 핸들 히트면 gesture owner 를 spacing 으로
   * 승격하고 세션을 연 뒤 true. 코너 resize 핸들은 호출부가 먼저 거른다.
   */
  resolveSpacingPointerDown: (
    event: PointerEvent,
    scenePoint: { x: number; y: number },
  ) => boolean;
  /** 클릭 (임계값 미만 pointerup) 으로 열린 인라인 숫자 입력 — BuilderCanvas 가 렌더 */
  inlineInput: SpacingInlineInputState | null;
  /** 인라인 입력이 닫힐 때 (commit/cancel) — active·registry 정리 */
  closeInlineInput: () => void;
}

/** Option/Alt 양쪽 · Option/Alt+Shift 4변 (Figma 문서 정합, breakdown §1.1) */
export function resolveSpacingSidesForModifiers(
  side: SpacingSide,
  altKey: boolean,
  shiftKey: boolean,
): readonly SpacingSide[] {
  if (altKey && shiftKey) return ["top", "right", "bottom", "left"];
  if (altKey) {
    return side === "top" || side === "bottom"
      ? ["top", "bottom"]
      : ["left", "right"];
  }
  return [side];
}

/** 시작값 기준 delta 에 step 을 적용 — Shift 는 10px 단위, 아니면 1px (fractional 시작값은 무이동이면 보존) */
export function applySpacingStep(delta: number, shift: boolean): number {
  const step = shift ? SPACING_SHIFT_STEP : 1;
  return Math.round(delta / step) * step;
}

function hitSpacing(
  scenePoint: { x: number; y: number },
  zoom: number,
): SpacingHit | null {
  const set = resolveSpacingBands();
  if (!set || !set.clipRect) return null;
  // 가시 영역 밖은 hover·pointerdown 대상이 아니다 (HC — 클립·스크롤·가림)
  if (!pointInBox(scenePoint, set.clipRect)) return null;
  return hitTestSpacingBands(scenePoint, set.bands, zoom);
}

export function useSpacingInteraction({
  containerRef,
  gestureSession,
  screenToCanvasPoint,
}: UseSpacingInteractionOptions): SpacingInteractionApi {
  const dragRef = useRef<SpacingDragState | null>(null);
  const [inlineInput, setInlineInput] =
    useState<SpacingInlineInputState | null>(null);
  const inlineInputRef = useRef<SpacingInlineInputState | null>(null);
  const hoverRafRef = useRef<number | null>(null);
  const lastPointerRef = useRef({ x: Number.NaN, y: Number.NaN });
  const ownerIdRef = useRef(`canvas-spacing-${nextOwnerId++}`);

  // ── 1. owner 동기화 ──
  useEffect(() => {
    // selectedElementIds 는 변경 때마다 새 배열이라 참조 비교로 충분하다 (store set 마다 실행)
    let lastIds: readonly string[] | null = null;
    let lastBreakpoint: unknown = null;
    let lastLayoutVersion: unknown = null;
    const sync = (): void => {
      const state = useStore.getState();
      const active = getActiveSpacingSession();
      const selectedId =
        state.selectedElementIds.length === 1
          ? state.selectedElementIds[0]
          : null;
      if (active && active.capability.target.nodeId !== selectedId) {
        active.cancel("selection-change");
      }
      if (
        state.selectedElementIds === lastIds &&
        state.activeBreakpoint === lastBreakpoint &&
        state.layoutVersion === lastLayoutVersion
      ) {
        return;
      }
      lastIds = state.selectedElementIds;
      lastBreakpoint = state.activeBreakpoint;
      lastLayoutVersion = state.layoutVersion;
      // 드래그 중 layout publish 는 owner 를 갈지 않는다 — 세션 확정값이 표시 정본
      if (getActiveSpacingSession()?.phase === "active" && selectedId) return;
      const owner = resolveSpacingCapability(state.selectedElementIds);
      if (setSpacingOwner(owner)) requestCanvasFrame();
    };
    sync();
    const unsubscribeStore = useStore.subscribe(sync);
    const unsubscribeLayout = onLayoutPublished(() => {
      // 엔진 style 은 layout pass 뒤에야 유효하다 — 같은 선택이라도 다시 읽는다
      lastIds = null;
      sync();
    });
    return () => {
      unsubscribeStore();
      unsubscribeLayout();
      setSpacingOwner(null);
    };
  }, []);

  const closeInlineInput = useCallback(() => {
    const current = inlineInputRef.current;
    if (!current) return;
    inlineInputRef.current = null;
    setInlineInput(null);
    setSpacingActive(null);
    if (getActiveSpacingSession() === current.session) {
      setActiveSpacingSession(null);
    }
    requestCanvasFrame();
  }, []);

  /** 클릭 (임계값 미만) — 세션은 열린 채 인라인 입력으로 넘긴다 (상태표 "핸들·띠 클릭") */
  const openInlineInput = useCallback(
    (drag: SpacingDragState) => {
      const container = containerRef.current;
      const vp = useViewportSyncStore.getState();
      const handle = resolveSpacingHandleRect(drag.band, vp.zoom, true);
      const anchor = viewportToScreenPoint(
        { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
        vp.zoom,
        vp.panOffset,
      );
      const state: SpacingInlineInputState = {
        session: drag.session,
        band: drag.band,
        x: anchor.x,
        y: anchor.y,
      };
      if (!container) {
        drag.session.cancel("superseded");
        setActiveSpacingSession(null);
        return;
      }
      inlineInputRef.current = state;
      setInlineInput(state);
      setSpacingActive({
        bandId: drag.band.id,
        bandIds: drag.bandIds,
        mode: "input",
      });
    },
    [containerRef],
  );

  // ── 3. 드래그 정리 ──
  const endDrag = useCallback(
    (
      outcome: "finish" | "cancel",
      reason: PointerDragCancelReason = "pointer-cancel",
    ) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      gestureSession.endPointer(drag.pointerId);
      if (
        outcome === "finish" &&
        !drag.dragging &&
        drag.session.phase === "active"
      ) {
        openInlineInput(drag);
        requestCanvasFrame();
        return;
      }
      setSpacingActive(null);
      if (outcome === "finish") {
        void drag.session.finish().then(() => {
          if (getActiveSpacingSession() === drag.session) {
            setActiveSpacingSession(null);
          }
          requestCanvasFrame();
        });
      } else {
        drag.session.cancel(reason);
        setActiveSpacingSession(null);
      }
      requestCanvasFrame();
    },
    [gestureSession, openInlineInput],
  );

  // 인라인 입력 중 카메라 이동/줌은 취소 사유가 아니다 — 입력이 핸들을 따라간다
  //   (`SpacingInlineInput` 이 Skia 프레임 카메라 채널로 프레임마다 재배치, 2026-09-20).
  //   종전 mirror 구독 취소는 제스처 종료에만 동작해 팬 중 입력이 옛 자리에 남았다.

  const onDragStart = useCallback((drag: SpacingDragState) => {
    setSpacingActive({
      bandId: drag.band.id,
      bandIds: drag.bandIds,
      mode: "drag",
    });
  }, []);
  const onMove = useCallback(
    (drag: SpacingDragState, dxClient: number, dyClient: number) => {
      const delta = spacingDeltaFromPointer(
        drag.band,
        dxClient / drag.startZoom,
        dyClient / drag.startZoom,
      );
      drag.session.setDelta(applySpacingStep(delta, drag.shift));
    },
    [],
  );
  // 임계값 미만 pointerup 은 endDrag 가 인라인 입력으로 넘긴다. 상태표: Escape 취소 뒤에도
  // 핸들은 선택이 유지되는 동안 남는다 (Figma 어법).
  usePointerDragLifecycle({ dragRef, endDrag, onDragStart, onMove });

  // ── 2. hover ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const clearHover = (): void => {
      spacingHoverCursor = null;
      if (setSpacingHover(null)) requestCanvasFrame();
    };
    const handlePointerMove = (event: PointerEvent): void => {
      if (dragRef.current) return;
      // window 리스너다 — owner 가 없으면 (선택 없음 · 앱 어디든 마우스 이동) rAF 도 잡지 않는다
      if (!getSpacingPresentationSnapshot().owner) {
        clearHover();
        return;
      }
      if (isRulerEventTarget(event.target)) {
        clearHover();
        return;
      }
      const last = lastPointerRef.current;
      if (event.clientX === last.x && event.clientY === last.y) return;
      last.x = event.clientX;
      last.y = event.clientY;
      if (hoverRafRef.current !== null) return;
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        if (dragRef.current || !getSpacingPresentationSnapshot().owner) {
          clearHover();
          return;
        }
        if (gestureSession.shouldSuppressElementHover()) {
          clearHover();
          return;
        }
        const rect = container.getBoundingClientRect();
        const { x, y } = lastPointerRef.current;
        if (
          x < rect.left ||
          x > rect.right ||
          y < rect.top ||
          y > rect.bottom
        ) {
          clearHover();
          return;
        }
        const zoom = useViewportSyncStore.getState().zoom;
        const scenePoint = screenToCanvasPoint({
          x: x - rect.left,
          y: y - rect.top,
        });
        const hit = hitSpacing(scenePoint, zoom);
        if (!hit) {
          clearHover();
          return;
        }
        // 띠 영역 hover 는 사선만 — 끌 수 있는 곳은 핸들뿐이라 resize 커서도 핸들에서만
        if (hit.onHandle) {
          const cursor = resolveSpacingCursor(hit.band);
          spacingHoverCursor = cursor;
          container.style.cursor = cursor;
        } else {
          spacingHoverCursor = null;
        }
        if (setSpacingHover(hit.band.id)) requestCanvasFrame();
      });
    };
    const handleLeave = (): void => clearHover();
    window.addEventListener("pointermove", handlePointerMove);
    container.addEventListener("pointerleave", handleLeave);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handleLeave);
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
        hoverRafRef.current = null;
      }
      clearHover();
    };
  }, [containerRef, gestureSession, screenToCanvasPoint]);

  // ── 3. pointerdown 진입 ──
  const resolveSpacingPointerDown = useCallback(
    (event: PointerEvent, scenePoint: { x: number; y: number }): boolean => {
      if (dragRef.current) return false;
      // 인라인 입력이 열려 있으면 캔버스 press 는 그 입력의 blur (commit/cancel) 로 처리된다
      if (inlineInputRef.current) return false;
      const owner = getSpacingPresentationSnapshot().owner;
      if (!owner) return false;
      const zoom = useViewportSyncStore.getState().zoom;
      const hit = hitSpacing(scenePoint, zoom);
      // 드래그·클릭 (인라인 입력) 은 핸들에서만 — 띠 영역 press 는 요소 선택·이동으로 흘린다
      if (!hit?.onHandle) return false;

      // gesture owner — element 로 시작한 같은 pointer 를 spacing 으로 원자 승격
      if (
        gestureSession.beginPointer(event.pointerId, event.button) === "pan"
      ) {
        return false;
      }
      if (!gestureSession.promoteElement(event.pointerId, "spacing"))
        return false;

      const band = hit.band;
      const kind = band.kind;
      // 패널 박스 모델의 padding link ON → 어느 변을 잡아도 4변 같은 값 (수정키보다 우선)
      const linked = kind === "padding" && getPaddingLinked();
      const sides =
        kind === "padding" && band.side
          ? linked
            ? SPACING_SIDES
            : resolveSpacingSidesForModifiers(
                band.side,
                event.altKey,
                event.shiftKey,
              )
          : undefined;
      const set = resolveSpacingBands(owner);
      const bandIds =
        kind === "gap"
          ? (set?.bands ?? []).filter((b) => b.kind === "gap").map((b) => b.id)
          : (sides ?? []).map((side) => `padding:${side}`);

      let session: SpacingPresentationSession;
      try {
        session = new SpacingPresentationSession({
          capability: owner,
          kind,
          sides,
          uniformFrom: linked && band.side ? band.side : undefined,
          ownerId: ownerIdRef.current,
          runtime: editorPresentationFillPilotRuntime,
        });
      } catch {
        gestureSession.endPointer(event.pointerId);
        return false;
      }
      setActiveSpacingSession(session);
      dragRef.current = {
        pointerId: event.pointerId,
        session,
        band,
        bandIds,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startZoom: zoom === 0 ? 1 : zoom,
        shift: event.shiftKey,
        dragging: false,
      };
      spacingHoverCursor = null;
      setSpacingActive({ bandId: band.id, bandIds, mode: "press" });
      requestCanvasFrame();
      return true;
    },
    [gestureSession],
  );

  return { resolveSpacingPointerDown, inlineInput, closeInlineInput };
}
