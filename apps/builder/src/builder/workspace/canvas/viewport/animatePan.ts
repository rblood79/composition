/**
 * animatePanTo — 현재 배율 그대로 카메라 offset 을 300ms ease-out 으로 옮긴다.
 *
 * Pages 트리에서 page 를 고르면 그 page frame 이 화면 가운데로 부드럽게 온다 (구 앱 `panToPage`
 * 의 애니메이션 — ADR-248 Phase 4e 에서 목표 계산만 옮기고 애니메이션이 빠졌던 것을 복원).
 * "programmatic" viewport session 으로 돌므로 wheel · drag 가 시작되면 그 자리에서 멈춘다.
 */

import { getViewportController } from "./ViewportController";
import type { ViewportInteractionSession } from "./ViewportInteractionSession";
import { beginViewportInteraction } from "./viewportActions";

export const PAN_ANIMATION_DURATION_MS = 300;

/** 모듈 레벨 애니메이션 — 새 호출은 진행 중인 것을 취소한다. */
let animationRafId: number | null = null;
let animationSession: ViewportInteractionSession | null = null;

export function animatePanTo(targetX: number, targetY: number): void {
  const vc = getViewportController();
  // 이전 animation 의 pending transform 을 보존한 뒤 새 session 을 시작한다.
  cancelPanAnimation();
  const session = beginViewportInteraction("programmatic");
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
    const progress = Math.min(elapsed / PAN_ANIMATION_DURATION_MS, 1);
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

/** 진행 중인 pan 애니메이션을 취소한다. */
export function cancelPanAnimation(): void {
  if (animationRafId !== null) {
    cancelAnimationFrame(animationRafId);
    animationRafId = null;
  }
  if (animationSession?.isActiveKind("programmatic")) {
    animationSession.finish("interrupted");
  }
  animationSession = null;
}
