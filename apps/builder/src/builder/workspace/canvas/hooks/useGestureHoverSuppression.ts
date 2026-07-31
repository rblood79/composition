import { useEffect } from "react";
import type { MutableRefObject } from "react";
import type { CanvasGestureSession } from "../interaction/canvasGestureSession";

/**
 * Hand/Pan mode 가 armed 되는 즉시 hover 를 비운다.
 *
 * pointer 이동을 기다리지 않는다 — Space keydown 만으로도 session 이 notify 하므로,
 * 예약된 RAF 를 취소한 뒤 hover 를 비운다. 취소가 먼저여야 이미 예약된 프레임이
 * 비운 상태를 다시 채우지 않는다. 구독 직후 1회 실행해 armed 된 상태로 마운트된
 * 경우도 덮는다.
 *
 * hover 를 만드는 훅마다 복제하지 말 것 — RAF 취소와 clear 의 순서가 이 계약이다.
 */
export function useGestureHoverSuppression(
  gestureSession: CanvasGestureSession,
  rafRef: MutableRefObject<number | null>,
  clearHover: () => void,
): void {
  useEffect(() => {
    const clearSuppressedHover = () => {
      if (!gestureSession.shouldSuppressElementHover()) return;

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      clearHover();
    };

    const unsubscribe = gestureSession.subscribe(clearSuppressedHover);
    clearSuppressedHover();
    return unsubscribe;
  }, [clearHover, gestureSession, rafRef]);
}
