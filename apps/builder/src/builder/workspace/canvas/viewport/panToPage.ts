/**
 * panToPage — 페이지 중앙으로 카메라를 부드럽게 이동
 *
 * React 훅에 의존하지 않는 순수 함수로, 좌측 Pages 트리와
 * 캔버스 Workflow 인터랙션 양쪽에서 재사용할 수 있다.
 *
 * @see useWorkflowInteraction.ts — 기존 animateToPage 로직 원본
 */

import { useStore } from "../../../stores";
import { useViewportSyncStore } from "../stores";
import {
  getViewportController,
  type ViewportState,
} from "./ViewportController";
import type { ViewportInteractionSession } from "./ViewportInteractionSession";
import { beginViewportInteraction } from "./viewportActions";

const ANIMATE_DURATION_MS = 300;

/** 모듈 레벨 애니메이션 ID — 중복 호출 시 이전 애니메이션 취소 */
let animationRafId: number | null = null;
let animationSession: ViewportInteractionSession | null = null;

/**
 * 지정된 페이지가 화면 중앙에 오도록 카메라를 300ms ease-out 애니메이션으로 이동한다.
 */
export function panToPage(pageId: string): void {
  const { derivedPagePositions: pagePositions } = useStore.getState();
  const pos = pagePositions[pageId];
  if (!pos) return;

  const vc = getViewportController();
  if (!vc.hasLiveState()) return;

  const { containerSize, canvasSize } = useViewportSyncStore.getState();
  const { scale } = vc.getState();

  // 페이지 중심이 화면 중심에 오도록 panOffset 계산
  animatePanTo(
    containerSize.width / 2 - (pos.x + canvasSize.width / 2) * scale,
    containerSize.height / 2 - (pos.y + canvasSize.height / 2) * scale,
  );
}

export interface CanvasRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

/**
 * scene 좌표 rect 를 화면에 드러내는 pan 목표 — 이미 화면 안 (여백 `margin` px 포함) 에 다 보이면
 * null (움직이지 않는다), 아니면 현재 배율 그대로 rect 중심을 화면 중심에 두는 offset.
 * 배율은 바꾸지 않는다 — 더블클릭 한 번에 확대 · 축소가 튀지 않게 (zoomToSelection 은 단축키 몫).
 */
export function computeRevealPanTarget(
  rect: CanvasRect,
  viewport: ViewportState,
  containerSize: { height: number; width: number },
  margin = 24,
): { x: number; y: number } | null {
  if (containerSize.width <= 0 || containerSize.height <= 0) return null;
  const left = rect.x * viewport.scale + viewport.x;
  const top = rect.y * viewport.scale + viewport.y;
  const right = left + rect.width * viewport.scale;
  const bottom = top + rect.height * viewport.scale;
  if (
    left >= margin &&
    top >= margin &&
    right <= containerSize.width - margin &&
    bottom <= containerSize.height - margin
  ) {
    return null;
  }
  return {
    x: containerSize.width / 2 - (rect.x + rect.width / 2) * viewport.scale,
    y: containerSize.height / 2 - (rect.y + rect.height / 2) * viewport.scale,
  };
}

/**
 * scene 좌표 rect 가 화면 밖이면 그 중심으로 카메라를 300ms ease-out 이동한다 (ADR-150 A3' — 데이터 행
 * 더블클릭으로 다른 페이지 origin 을 선택했을 때 카메라가 따라간다).
 */
export function panToCanvasRect(rect: CanvasRect): void {
  const vc = getViewportController();
  if (!vc.hasLiveState()) return;
  const { containerSize } = useViewportSyncStore.getState();
  const target = computeRevealPanTarget(rect, vc.getState(), containerSize);
  if (!target) return;
  animatePanTo(target.x, target.y);
}

/** 현재 배율 그대로 offset (targetX, targetY) 로 300ms ease-out 이동. */
function animatePanTo(targetX: number, targetY: number): void {
  const vc = getViewportController();
  // 이전 animation의 pending transform을 보존한 뒤 새 session을 시작한다.
  cancelPanToPage();
  const session = beginViewportInteraction("programmatic");
  if (!session) return;
  const initialViewport = vc.getState();

  const startX = initialViewport.x;
  const startY = initialViewport.y;
  const startTime = performance.now();
  let queuedViewport = initialViewport;

  animationSession = session;

  const animate = () => {
    if (!session.isActiveKind("programmatic")) {
      animationRafId = null;
      animationSession = null;
      return;
    }

    const elapsed = performance.now() - startTime;
    const progress = Math.min(elapsed / ANIMATE_DURATION_MS, 1);
    // ease-out: 1 - (1 - t)^3
    const eased = 1 - Math.pow(1 - progress, 3);

    const x = startX + (targetX - startX) * eased;
    const y = startY + (targetY - startY) * eased;

    session.queuePan({
      x: x - queuedViewport.x,
      y: y - queuedViewport.y,
    });
    queuedViewport = { x, y, scale: initialViewport.scale };

    if (progress < 1) {
      animationRafId = requestAnimationFrame(animate);
    } else {
      animationRafId = null;
      session.finish("idle");
      animationSession = null;
    }
  };

  animationRafId = requestAnimationFrame(animate);
}

/** 진행 중인 panToPage 애니메이션을 취소한다. */
export function cancelPanToPage(): void {
  if (animationRafId !== null) {
    cancelAnimationFrame(animationRafId);
    animationRafId = null;
  }
  if (animationSession?.isActiveKind("programmatic")) {
    animationSession.finish("interrupted");
  }
  animationSession = null;
}
