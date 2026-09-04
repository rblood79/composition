/**
 * ADR-192 Phase 3 — 바 배치 훅: 드래그 이동 · Pin · Reset · clamp · 영속.
 *
 * - 저장 상태는 `canvasSettings.actionBar` (write-through localStorage).
 * - 드래그 중 위치는 로컬 state — 드롭 시 1회 commit (store 쓰기 1회).
 * - 저장 offset 은 **바가 실제로 나타난 시점부터** overlay 안으로 clamp (R4).
 *   바가 없는 동안(선택 0 / 텍스트 편집 / Hide)에는 잴 것이 없다.
 * - 부모(`.workspace-overlay`, inset:0) 가 배치 기준면.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useStore } from "../../../stores";
import type { ActionBarOffset } from "../../../stores/utils/actionBarStorage";
import {
  getPagePositionPresentationSnapshot,
  readPagePositionForInteraction,
  type PagePositionPresentationSnapshot,
} from "../../../workspace/canvas/interaction/pagePositionPresentation";
import { useViewportSyncStore } from "../../../workspace/canvas/stores";
import { getViewportPresentationSnapshot } from "../../../workspace/canvas/viewport/viewportPresentation";
import {
  getCanvasFramePresentationSnapshot,
  subscribeCanvasFramePresentation,
  type CanvasFramePresentationSnapshot,
} from "../../../workspace/canvas/canvasFramePresentation";
import {
  ACTION_BAR_BOTTOM_GAP,
  actionBarPageTransform,
  actionBarTransform,
  clampActionBarOffset,
  offsetsEqual,
  pageActionBarAnchor,
  pageAnchorToManualOffset,
  type Point,
  type Size,
} from "./actionBarPlacement";

function rectSize(element: Element | null | undefined): Size | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function measureBar(bar: HTMLElement): { overlay: Size; bar: Size } | null {
  const overlay = rectSize(bar.parentElement);
  const barSize = rectSize(bar);
  if (!overlay || !barSize) return null;
  return { overlay, bar: barSize };
}

/**
 * 저장된 offset 이 현재 overlay 밖이면 안으로. offset 은 store 에서 직접 읽는다 —
 * 렌더 값을 닫아 두면 commit 마다 구독을 다시 세워야 한다.
 */
function clampStoredOffset(bar: HTMLElement): void {
  const { actionBar, setActionBarOffset } = useStore.getState();
  const offset = actionBar.offset;
  if (!offset) return;
  const sizes = measureBar(bar);
  if (!sizes) return;
  const clamped = clampActionBarOffset(offset, sizes.overlay, sizes.bar);
  if (!offsetsEqual(clamped, offset)) setActionBarOffset(clamped);
}

function resolveAutomaticPageAnchor(
  pageId: string,
  frame: CanvasFramePresentationSnapshot | null,
): Point {
  const viewportPresentation = getViewportPresentationSnapshot();
  const pagePositionPresentation: PagePositionPresentationSnapshot =
    frame?.pagePositionSnapshot ?? getPagePositionPresentationSnapshot();
  const pagePosition = readPagePositionForInteraction(
    pageId,
    useStore.getState().pagePositions,
    pagePositionPresentation,
  ) ?? { x: 0, y: 0 };
  const cameraState = frame?.cameraState;

  return pageActionBarAnchor({
    pagePosition,
    pageSize: useViewportSyncStore.getState().canvasSize,
    panOffset: {
      x: cameraState?.panX ?? viewportPresentation.x,
      y: cameraState?.panY ?? viewportPresentation.y,
    },
    zoom: cameraState?.zoom ?? viewportPresentation.scale,
  });
}

function applyAutomaticPageAnchor(
  bar: HTMLElement,
  pageId: string,
  frame: CanvasFramePresentationSnapshot | null,
): Point {
  const anchor = resolveAutomaticPageAnchor(pageId, frame);
  const transform = actionBarPageTransform(anchor);
  if (bar.style.transform !== transform) {
    bar.style.transform = transform;
  }
  return anchor;
}

type DragSession = {
  pointerId: number;
  startX: number;
  startY: number;
  base: ActionBarOffset;
  latest: ActionBarOffset | null;
  /** pointerdown 시점에 한 번 잰 크기 — 드래그 중 바·overlay 크기는 변하지 않는다 */
  sizes: { overlay: Size; bar: Size } | null;
};

type ActionBarPlacementInteractions = {
  barNode: HTMLDivElement | null;
  handleNode: HTMLElement | null;
  pageId: string | null;
  tracksAutomaticPagePosition: boolean;
  settings: { offset: ActionBarOffset | null; pinned: boolean };
  setDragOffset: Dispatch<SetStateAction<ActionBarOffset | null>>;
  setActionBarOffset: (offset: ActionBarOffset | null) => void;
};

/**
 * Ref 기반 DOM 상호작용은 렌더용 placement snapshot과 분리한다. React Compiler가
 * ref를 읽는 callback이 섞인 반환 객체 전체를 렌더 값으로 오염시키지 않도록 이 hook은
 * 값을 반환하지 않고 effect/event listener만 설치한다.
 */
function useActionBarPlacementInteractions({
  barNode,
  handleNode,
  pageId,
  tracksAutomaticPagePosition,
  settings,
  setDragOffset,
  setActionBarOffset,
}: ActionBarPlacementInteractions): void {
  const barRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const latestAutomaticAnchorRef = useRef<Point | null>(null);
  const dragRef = useRef<DragSession | null>(null);

  // 바 DOM 은 선택/편집/Hide 전환 때 생겼다 사라진다. callback ref는 DOM node만
  // 상위에 전달하고, clamp·ResizeObserver·자동 anchor는 commit effect에서 처리한다.
  useLayoutEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    barRef.current = barNode;
    if (!barNode) return;

    // 바가 나타난 그 시점 1회 — ResizeObserver 최초 전달에 맡기지 않는다.
    clampStoredOffset(barNode);

    if (tracksAutomaticPagePosition && pageId) {
      latestAutomaticAnchorRef.current = applyAutomaticPageAnchor(
        barNode,
        pageId,
        getCanvasFramePresentationSnapshot(),
      );
    }

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => clampStoredOffset(barNode));
    observer.observe(barNode);
    if (barNode.parentElement) observer.observe(barNode.parentElement);
    observerRef.current = observer;

    return () => {
      observer.disconnect();
      if (observerRef.current === observer) observerRef.current = null;
      if (barRef.current === barNode) barRef.current = null;
    };
  }, [barNode, pageId, tracksAutomaticPagePosition]);

  // 드래그 중 pointermove 는 React state 를 건드리지 않고 DOM transform 만 쓴다
  // (자동 page anchor 와 같은 방식). move 마다 setState 하면 바 전체가 다시 렌더돼
  // 프레임당 수백 KB 를 할당했다 (2026-09-02 실측: 드래그 중 +16 MB/s). 드래그 중
  // 다른 이유로 렌더가 돌면 React 가 style.transform 을 base 값으로 되돌리므로,
  // 렌더 뒤마다 마지막 위치를 다시 얹는다.
  useLayoutEffect(() => {
    const drag = dragRef.current;
    const bar = barRef.current;
    if (!drag?.latest || !bar) return;
    bar.style.transform = actionBarTransform(drag.latest);
  });

  useEffect(() => {
    if (!tracksAutomaticPagePosition || !pageId) return;

    const apply = (
      cameraState: CanvasFramePresentationSnapshot["cameraState"],
      pagePositionSnapshot: PagePositionPresentationSnapshot,
    ): void => {
      const bar = barRef.current;
      if (!bar || dragRef.current) return;
      latestAutomaticAnchorRef.current = applyAutomaticPageAnchor(bar, pageId, {
        cameraState,
        pagePositionSnapshot,
      });
    };

    const latest = getCanvasFramePresentationSnapshot();
    if (latest) apply(latest.cameraState, latest.pagePositionSnapshot);
    return subscribeCanvasFramePresentation(apply);
  }, [pageId, tracksAutomaticPagePosition]);

  useEffect(() => {
    if (!handleNode) return;

    const onPointerDown = (event: PointerEvent): void => {
      if (settings.pinned || event.button !== 0) return;
      event.preventDefault();
      const target = event.currentTarget as HTMLElement;
      target.setPointerCapture?.(event.pointerId);
      const sizes = barRef.current ? measureBar(barRef.current) : null;
      const pageAnchor =
        tracksAutomaticPagePosition && pageId
          ? (latestAutomaticAnchorRef.current ??
            resolveAutomaticPageAnchor(
              pageId,
              getCanvasFramePresentationSnapshot(),
            ))
          : null;
      const base =
        settings.offset ??
        (pageAnchor && sizes
          ? clampActionBarOffset(
              pageAnchorToManualOffset(pageAnchor, sizes.overlay, sizes.bar),
              sizes.overlay,
              sizes.bar,
            )
          : { dx: 0, dy: 0 });
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        base,
        latest: null,
        sizes,
      };
      // 자동 page anchor를 기존 수동 좌표계로 바꾸되 같은 screen 위치를 유지한다.
      setDragOffset(base);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const bar = barRef.current;
      // 크기는 pointerdown 에서 한 번 잰 값을 쓴다 — move 마다 getBoundingClientRect
      // 를 두 번 부르면 매번 강제 layout 이 든다
      const sizes = drag.sizes ?? (bar ? measureBar(bar) : null);
      if (sizes && !drag.sizes) drag.sizes = sizes;
      const next = {
        dx: drag.base.dx + (event.clientX - drag.startX),
        dy: drag.base.dy + (event.clientY - drag.startY),
      };
      const clamped = sizes
        ? clampActionBarOffset(next, sizes.overlay, sizes.bar)
        : next;
      drag.latest = clamped;
      if (bar) bar.style.transform = actionBarTransform(clamped);
    };

    const endDrag = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      const target = event.currentTarget as HTMLElement;
      if (target.hasPointerCapture?.(event.pointerId)) {
        target.releasePointerCapture?.(event.pointerId);
      }
      setDragOffset(null);
      const committed = drag.latest;
      if (committed && !offsetsEqual(committed, settings.offset)) {
        setActionBarOffset(committed);
      }
    };

    handleNode.addEventListener("pointerdown", onPointerDown);
    handleNode.addEventListener("pointermove", onPointerMove);
    handleNode.addEventListener("pointerup", endDrag);
    handleNode.addEventListener("pointercancel", endDrag);
    return () => {
      handleNode.removeEventListener("pointerdown", onPointerDown);
      handleNode.removeEventListener("pointermove", onPointerMove);
      handleNode.removeEventListener("pointerup", endDrag);
      handleNode.removeEventListener("pointercancel", endDrag);
    };
  }, [
    handleNode,
    pageId,
    setActionBarOffset,
    setDragOffset,
    settings.offset,
    settings.pinned,
    tracksAutomaticPagePosition,
  ]);
}

export interface ActionBarPlacementNodes {
  barNode: HTMLDivElement | null;
  handleNode: HTMLElement | null;
}

export function useActionBarPlacement(
  pageId: string | null = null,
  { barNode, handleNode }: ActionBarPlacementNodes,
) {
  const settings = useStore((state) => state.actionBar);
  const setActionBarOffset = useStore((state) => state.setActionBarOffset);
  const setActionBarPinned = useStore((state) => state.setActionBarPinned);
  const setActionBarHidden = useStore((state) => state.setActionBarHidden);
  const tracksAutomaticPagePosition =
    pageId !== null && settings.offset === null;
  const [dragOffset, setDragOffset] = useState<ActionBarOffset | null>(null);

  useActionBarPlacementInteractions({
    barNode,
    handleNode,
    pageId,
    tracksAutomaticPagePosition,
    settings,
    setDragOffset,
    setActionBarOffset,
  });

  return {
    hidden: settings.hidden,
    pinned: settings.pinned,
    dragging: dragOffset !== null,
    style:
      dragOffset !== null || settings.offset !== null || pageId === null
        ? {
            bottom: `${ACTION_BAR_BOTTOM_GAP}px`,
            left: "50%",
            top: "auto",
            transform: actionBarTransform(dragOffset ?? settings.offset),
          }
        : {
            bottom: "auto",
            left: "0px",
            top: "0px",
          },
    togglePinned: () => setActionBarPinned(!settings.pinned),
    resetPosition: () => setActionBarOffset(null),
    hide: () => setActionBarHidden(true),
  };
}
