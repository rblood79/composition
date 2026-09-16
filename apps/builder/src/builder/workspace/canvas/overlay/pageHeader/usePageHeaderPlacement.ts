/**
 * ADR-221 — 페이지 헤더 DOM 층 배치 훅.
 *
 * - 카메라는 Skia 프레임이 publish 하는 `subscribeCanvasFramePresentation` 하나만 구독한다
 *   (액션바 `useActionBarPlacement` 와 같은 규약 — 별도 RAF/React state 없음, transform 만 쓴다).
 * - **게이트**: `useViewportSyncStore.cameraGestureActive` (휠 pan/zoom · 스페이스/중클릭 pan)
 *   가 켜진 동안 프레임 콜백은 early return — DOM 쓰기 0 (G2 계측 대상). 루트에
 *   `data-hidden` 을 걸어 층을 숨기고, 꺼지는 순간 `placeAll` 1회.
 * - **단일 drag 추종**: `pagePositionSnapshot.isActive` 면 `activeOverrides` 에 든 페이지
 *   노드만 transform 을 다시 쓴다 (다중 선택 drag 는 그 소집합). 카메라는 안 움직인다.
 * - **settle 배치** `placeAll`: 카메라 변화 (프로그램 zoom · 미니맵 점프) · 프레임 목록 ·
 *   컨테이너 크기 · drag 종료 (snapshot version 변화) 에서 1회. 뷰포트 밖은 `display:none`,
 *   위 페이지 body ∪ 헤더 에 가려진 구간은 `clip-path: inset()` (breakdown §6).
 */
import { useLayoutEffect, useRef } from "react";
import { useStore } from "../../../../stores";
import {
  getCanvasFramePresentationSnapshot,
  subscribeCanvasFramePresentation,
} from "../../canvasFramePresentation";
import {
  readPagePositionDelta,
  type PagePositionPresentationSnapshot,
} from "../../interaction/pagePositionPresentation";
import { useViewportSyncStore } from "../../stores";
import { getViewportPresentationSnapshot } from "../../viewport/viewportPresentation";
import {
  headerClipPath,
  headerTransform,
  headerWidthStyle,
  isRectInViewport,
  pageHeaderScreenRect,
  pageOccluderScreenRect,
  resolveHeaderVisibleRect,
  type HeaderCamera,
  type PageHeaderFrame,
  type ScenePoint,
  type ScreenRect,
} from "./pageHeaderGeometry";

export interface PageHeaderPlacementInput {
  layerNode: HTMLElement | null;
  /** 렌더 순서 그대로 (= `orderPagesForPaint`, 뒤가 위). */
  frames: readonly PageHeaderFrame[];
}

function currentCamera(): HeaderCamera {
  const frame = getCanvasFramePresentationSnapshot();
  if (frame) return frame.cameraState;
  const presentation = getViewportPresentationSnapshot();
  return {
    zoom: presentation.scale,
    panX: presentation.x,
    panY: presentation.y,
  };
}

function sameCamera(a: HeaderCamera | null, b: HeaderCamera): boolean {
  return (
    a !== null && a.zoom === b.zoom && a.panX === b.panX && a.panY === b.panY
  );
}

function collectNodes(layer: HTMLElement): Map<string, HTMLElement> {
  const nodes = new Map<string, HTMLElement>();
  for (const child of Array.from(layer.children)) {
    const pageId = (child as HTMLElement).dataset.pageId;
    if (pageId) nodes.set(pageId, child as HTMLElement);
  }
  return nodes;
}

function resolvePosition(
  frame: PageHeaderFrame,
  snapshot: PagePositionPresentationSnapshot | null,
): ScenePoint {
  // canonical 은 store 가 정본 (drag commit 이 동기라 프레임 목록보다 먼저 갱신된다).
  const canonical = useStore.getState().pagePositions[frame.id] ?? frame;
  const delta = snapshot ? readPagePositionDelta(frame.id, snapshot) : null;
  return {
    x: canonical.x + (delta?.dx ?? 0),
    y: canonical.y + (delta?.dy ?? 0),
  };
}

function writeTransform(node: HTMLElement, rect: ScreenRect): void {
  const transform = headerTransform(rect);
  if (node.style.transform !== transform) node.style.transform = transform;
}

function writeDisplay(node: HTMLElement, hidden: boolean): void {
  const next = hidden ? "none" : "";
  if (node.style.display !== next) node.style.display = next;
}

export function placePageHeaders(
  layer: HTMLElement,
  frames: readonly PageHeaderFrame[],
  camera: HeaderCamera,
  snapshot: PagePositionPresentationSnapshot | null,
  viewport: { width: number; height: number },
): void {
  const nodes = collectNodes(layer);
  const positions = frames.map((frame) => resolvePosition(frame, snapshot));
  const occluders = frames.map((frame, index) =>
    pageOccluderScreenRect(positions[index], frame, camera),
  );
  const cull = viewport.width > 0 && viewport.height > 0;

  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const node = nodes.get(frame.id);
    if (!node) continue;
    const header = pageHeaderScreenRect(positions[index], frame, camera);
    if (cull && !isRectInViewport(header, viewport)) {
      writeDisplay(node, true);
      continue;
    }
    // 위 페이지 = 렌더 순서에서 뒤 (활성 페이지가 마지막이라 clip 0).
    const visible = resolveHeaderVisibleRect(
      header,
      occluders.slice(index + 1),
    );
    if (!visible) {
      writeDisplay(node, true);
      continue;
    }
    writeDisplay(node, false);
    writeTransform(node, header);
    const width = headerWidthStyle(header);
    if (node.style.width !== width) node.style.width = width;
    const clip = headerClipPath(header, visible);
    if (node.style.clipPath !== clip) node.style.clipPath = clip;
  }
}

export function usePageHeaderPlacement({
  layerNode,
  frames,
}: PageHeaderPlacementInput): void {
  const framesRef = useRef(frames);
  framesRef.current = frames;
  const layerRef = useRef(layerNode);
  layerRef.current = layerNode;
  const gestureActiveRef = useRef(
    useViewportSyncStore.getState().cameraGestureActive,
  );
  const lastCameraRef = useRef<HeaderCamera | null>(null);
  const lastSnapshotVersionRef = useRef<number>(-1);

  const placeAllRef = useRef<() => void>(() => {});
  placeAllRef.current = () => {
    const layer = layerRef.current;
    if (!layer) return;
    const camera = currentCamera();
    const snapshot =
      getCanvasFramePresentationSnapshot()?.pagePositionSnapshot ?? null;
    placePageHeaders(
      layer,
      framesRef.current,
      camera,
      snapshot,
      useViewportSyncStore.getState().containerSize,
    );
    lastCameraRef.current = camera;
    lastSnapshotVersionRef.current = snapshot?.version ?? -1;
  };

  // 프레임 목록 · 노드 집합 · 순서가 바뀌면 paint 전에 1회 배치 (새 노드는 transform 이 없다).
  useLayoutEffect(() => {
    placeAllRef.current();
  }, [layerNode, frames]);

  useLayoutEffect(() => {
    if (!layerNode) return;

    const applyGate = (active: boolean): void => {
      gestureActiveRef.current = active;
      if (active) layerNode.setAttribute("data-hidden", "");
      else layerNode.removeAttribute("data-hidden");
      if (!active) placeAllRef.current();
    };
    applyGate(useViewportSyncStore.getState().cameraGestureActive);

    const unsubscribeGate = useViewportSyncStore.subscribe(
      (state) => state.cameraGestureActive,
      applyGate,
    );
    const unsubscribeSize = useViewportSyncStore.subscribe(
      (state) => state.containerSize,
      () => placeAllRef.current(),
    );

    const onFrame = (
      cameraState: Readonly<HeaderCamera>,
      snapshot: PagePositionPresentationSnapshot,
    ): void => {
      if (gestureActiveRef.current) return;
      if (snapshot.isActive && snapshot.activeOverrides) {
        // drag 추종: 대상 페이지 노드만. 카메라는 고정이라 나머지는 유효하다.
        const nodes = collectNodes(layerNode);
        for (const frame of framesRef.current) {
          if (!snapshot.activeOverrides.has(frame.id)) continue;
          const node = nodes.get(frame.id);
          if (!node) continue;
          writeTransform(
            node,
            pageHeaderScreenRect(
              resolvePosition(frame, snapshot),
              frame,
              cameraState,
            ),
          );
        }
        lastSnapshotVersionRef.current = snapshot.version;
        return;
      }
      if (
        !sameCamera(lastCameraRef.current, cameraState) ||
        lastSnapshotVersionRef.current !== snapshot.version
      ) {
        placeAllRef.current();
      }
    };
    const unsubscribeFrame = subscribeCanvasFramePresentation(onFrame);

    return () => {
      unsubscribeGate();
      unsubscribeSize();
      unsubscribeFrame();
    };
  }, [layerNode]);
}
