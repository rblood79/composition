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
import { getViewportController } from "./ViewportController";
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
  const { pagePositions } = useStore.getState();
  const pos = pagePositions[pageId];
  if (!pos) return;

  const vc = getViewportController();
  if (!vc.isAttached()) return;

  const { containerSize, canvasSize } = useViewportSyncStore.getState();
  // 이전 animation의 pending transform을 보존한 뒤 새 session을 시작한다.
  cancelPanToPage();
  const session = beginViewportInteraction("programmatic");
  if (!session) return;
  const initialViewport = vc.getState();

  // 페이지 중심 계산
  const pageCenterX = pos.x + canvasSize.width / 2;
  const pageCenterY = pos.y + canvasSize.height / 2;

  // 화면 중심에 오도록 panOffset 계산
  const targetX = containerSize.width / 2 - pageCenterX * initialViewport.scale;
  const targetY =
    containerSize.height / 2 - pageCenterY * initialViewport.scale;

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
