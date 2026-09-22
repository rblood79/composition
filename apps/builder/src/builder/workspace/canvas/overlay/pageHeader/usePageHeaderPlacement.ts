/**
 * ADR-221 — 페이지 헤더 DOM 층 배치 훅.
 *
 * - 카메라는 Skia 프레임이 publish 하는 `subscribeCanvasFramePresentation` 하나만 구독한다
 *   (액션바 `useActionBarPlacement` 와 같은 규약 — 별도 RAF/React state 없음, transform 만 쓴다).
 * - **게이트**: `useViewportSyncStore.cameraGestureActive` (휠 pan/zoom · 스페이스/중클릭 pan)
 *   가 켜진 동안 프레임 콜백은 early return — DOM 쓰기 0 (G2 계측 대상). 켜지는 순간 store
 *   구독 콜백이 루트에 `data-hidden` 을 건다 (React 커밋을 기다리지 않는다 — 다음 프레임
 *   콜백보다 먼저 닫혀야 한다).
 * - **commit-before-reveal (ADR-226 Decision 1)**: 꺼짐은 구독 콜백이 처리하지 않는다. 층
 *   컴포넌트가 제스처 중 동결했던 frames 를 gate-off render 에서 최신으로 올리면, 그 커밋의
 *   layoutEffect 가 새 노드까지 `placeAll` 1회 → `data-hidden` 제거 순서로 닫는다. 구독
 *   콜백에서 바로 reveal 하면 React 커밋 전 한 paint 동안 구 집합 · 무배치 새 노드가 보인다 (R5).
 * - **단일 drag 추종**: `pagePositionSnapshot.isActive` 면 `activeOverrides` 에 든 페이지
 *   노드만 transform 을 다시 쓴다 (다중 선택 drag 는 그 소집합). 카메라는 안 움직인다.
 * - **settle 배치** `placeAll`: 카메라 변화 (프로그램 zoom · 미니맵 점프) · 프레임 목록 ·
 *   컨테이너 크기 · drag 종료 (snapshot version 변화) 에서 1회. 뷰포트 밖은 `display:none`,
 *   위 페이지 body ∪ 헤더 에 가려진 구간은 `clip-path: inset()` (breakdown §6).
 */
import { useLayoutEffect, useRef } from "react";
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
  /** 렌더 순서 그대로 (= `orderPagesForPaint`, 뒤가 위). 제스처 중에는 settle 집합으로 동결. */
  frames: readonly PageHeaderFrame[];
  /**
   * 이 render 가 본 게이트 값 (층 컴포넌트의 settled 스냅샷). false 로 바뀐 커밋의
   * layoutEffect 가 최신 frames 배치 + reveal 을 맡는다.
   */
  gestureActive: boolean;
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
  // ADR-232 — 정본은 이 render 가 받은 프레임이다 (Skia 가 그리는 값과 같은 scene 스냅샷).
  //   store 의 `derivedPagePositions` 는 같은 파생을 BuilderCanvas 의 **passive effect** 가
  //   싣는 사본이라 이 배치 layoutEffect 보다 항상 늦다 (자식 layoutEffect → 부모 useEffect).
  //   미러를 먼저 읽으면 Settings 의 gap · 열 수 · 방향 변경에서 페이지 본문만 움직이고
  //   헤더는 옛 자리에 남았다가 다음 카메라 변화(스크롤)의 재배치에서야 따라왔다 (2026-09-22).
  const delta = snapshot ? readPagePositionDelta(frame.id, snapshot) : null;
  return {
    x: frame.x + (delta?.dx ?? 0),
    y: frame.y + (delta?.dy ?? 0),
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
  gestureActive,
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
  // 카메라 제스처 중에는 skip — 층 컴포넌트가 frames 를 동결하므로 (ADR-226) 이 이펙트는
  // 제스처 중 재실행되지 않지만, 게이트 ON 자체가 커밋을 하나 만들므로 가드는 남긴다.
  // gate-off 커밋 (gestureActive true → false) 이 최신 frames · 새 노드로 `placeAll` 1회
  // 한 뒤 `data-hidden` 을 뗀다 — 브라우저 paint 전에 집합 · transform · visible 순서가
  // 닫힌다 (commit-before-reveal). 프레임 콜백은 그 사이 gestureActiveRef 로 계속 막힌다.
  useLayoutEffect(() => {
    if (gestureActive) return;
    gestureActiveRef.current = false;
    placeAllRef.current();
    if (layerNode?.hasAttribute("data-hidden")) {
      layerNode.removeAttribute("data-hidden");
    }
  }, [layerNode, frames, gestureActive]);

  useLayoutEffect(() => {
    if (!layerNode) return;

    // ON 만 즉시 — OFF 는 위 layoutEffect 가 최신 커밋에서 소유한다.
    const applyGateOn = (active: boolean): void => {
      if (!active) return;
      gestureActiveRef.current = true;
      layerNode.setAttribute("data-hidden", "");
    };
    applyGateOn(useViewportSyncStore.getState().cameraGestureActive);

    const unsubscribeGate = useViewportSyncStore.subscribe(
      (state) => state.cameraGestureActive,
      applyGateOn,
    );
    const unsubscribeSize = useViewportSyncStore.subscribe(
      (state) => state.containerSize,
      () => {
        if (gestureActiveRef.current) return;
        placeAllRef.current();
      },
    );

    const onFrame = (
      cameraState: Readonly<HeaderCamera>,
      snapshot: PagePositionPresentationSnapshot,
    ): void => {
      if (gestureActiveRef.current) return;
      if (snapshot.isActive && snapshot.activeOverrides) {
        // drag 추종: 카메라는 고정이지만 대상 페이지가 움직이며 아래 페이지 헤더의
        // occlusion (clip-path) 을 바꾼다 — transform 만 쓰면 겹친 아래 페이지 헤더가
        // 선택 페이지 위로 남는다. 전체 재배치로 clip 을 매 프레임 재계산한다 (쓰기는
        // 값 변경 시에만 — placePageHeaders 내부 가드).
        placePageHeaders(
          layerNode,
          framesRef.current,
          cameraState,
          snapshot,
          useViewportSyncStore.getState().containerSize,
        );
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
