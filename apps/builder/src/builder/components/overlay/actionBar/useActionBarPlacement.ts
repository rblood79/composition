/**
 * ADR-192 Phase 3 — 바 배치 훅: 드래그 이동 · Pin · Reset · clamp · 영속.
 *
 * - 저장 상태는 `canvasSettings.actionBar` (write-through localStorage).
 * - 드래그 중 위치는 로컬 state — 드롭 시 1회 commit (store 쓰기 1회).
 * - 저장 offset 은 **바가 실제로 나타난 시점부터** overlay 안으로 clamp (R4).
 *   바가 없는 동안(선택 0 / 텍스트 편집 / Hide)에는 잴 것이 없다.
 * - 부모(`.workspace-overlay`, inset:0) 가 배치 기준면.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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

export function useActionBarPlacement(pageId: string | null = null) {
  const settings = useStore((state) => state.actionBar);
  const setActionBarOffset = useStore((state) => state.setActionBarOffset);
  const setActionBarPinned = useStore((state) => state.setActionBarPinned);
  const setActionBarHidden = useStore((state) => state.setActionBarHidden);
  const tracksAutomaticPagePosition =
    pageId !== null && settings.offset === null;

  const barRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const latestAutomaticAnchorRef = useRef<Point | null>(null);

  const [dragOffset, setDragOffset] = useState<ActionBarOffset | null>(null);
  // `latest` 는 드롭 시 commit 할 값. `setDragOffset` updater 안에서 store 를
  // 쓰면 그 updater 가 render phase 에 실행될 때 다른 컴포넌트 갱신이 되어
  // React DEV 경고가 난다 (code-review #11) — 값은 세션 레코드에 두고 commit 은
  // 이벤트 핸들러 본문에서 한다.
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    base: ActionBarOffset;
    latest: ActionBarOffset | null;
  } | null>(null);

  // 바 DOM 은 마운트/언마운트를 반복한다 (선택 0 / 편집 중 / Hide → null).
  // callback ref 가 그 시점을 직접 받아 clamp + 관찰을 세우고 걷는다 — 노드를
  // state 로 들면 전환마다 렌더가 한 번 더 돈다.
  //
  // 재실행 계기는 3가지 — (a) 바가 나타남, (b) 바 크기 변화(컨텍스트 전환으로
  // 항목 수가 바뀜), (c) overlay 크기 변화(창 리사이즈 · 패널 도크 리사이즈).
  // window resize 리스너로는 (b) 와 "창 크기는 그대로인데 패널이 접혀 overlay 가
  // 넓어진" 경우를 못 잡는다.
  const attachBar = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      barRef.current = node;
      if (!node) return;

      // 바가 나타난 그 시점 1회 — ResizeObserver 의 최초 전달에 맡기지 않는다.
      // RO 콜백은 렌더링 단계에 실려 오므로 탭이 보이지 않는 동안에는 지연된다
      // (실측: hidden 탭에서 rAF·RO 모두 정지). 이 clamp 는 "바가 화면 밖에
      // 고착됐는가" 를 막는 경로라 마운트 시점에 결정적으로 돌아야 한다.
      clampStoredOffset(node);

      if (tracksAutomaticPagePosition && pageId) {
        latestAutomaticAnchorRef.current = applyAutomaticPageAnchor(
          node,
          pageId,
          getCanvasFramePresentationSnapshot(),
        );
      }

      const observer = new ResizeObserver(() => clampStoredOffset(node));
      observer.observe(node);
      if (node.parentElement) observer.observe(node.parentElement);
      observerRef.current = observer;
    },
    [pageId, tracksAutomaticPagePosition],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

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

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (settings.pinned || event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
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
      };
      // 자동 page anchor를 기존 수동 좌표계로 바꾸되 같은 screen 위치를 유지한다.
      setDragOffset(base);
    },
    [pageId, settings.offset, settings.pinned, tracksAutomaticPagePosition],
  );

  const onHandlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const sizes = barRef.current ? measureBar(barRef.current) : null;
      const next = {
        dx: drag.base.dx + (event.clientX - drag.startX),
        dy: drag.base.dy + (event.clientY - drag.startY),
      };
      const clamped = sizes
        ? clampActionBarOffset(next, sizes.overlay, sizes.bar)
        : next;
      drag.latest = clamped;
      setDragOffset(clamped);
    },
    [],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragOffset(null);
      const committed = drag.latest;
      if (committed && !offsetsEqual(committed, settings.offset)) {
        setActionBarOffset(committed);
      }
    },
    [setActionBarOffset, settings.offset],
  );

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
    /** 바 루트에 그대로 붙인다 — 노드가 생기고 사라지는 시점을 훅이 알아야 한다 */
    attachBar,
    handleProps: {
      onPointerDown: onHandlePointerDown,
      onPointerMove: onHandlePointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    togglePinned: () => setActionBarPinned(!settings.pinned),
    resetPosition: () => setActionBarOffset(null),
    hide: () => setActionBarHidden(true),
  };
}
