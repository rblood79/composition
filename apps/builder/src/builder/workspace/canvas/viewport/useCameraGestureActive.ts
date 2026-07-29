import { useEffect, useRef, useState } from "react";
import { useViewportSyncStore } from "../stores";

/**
 * 카메라 제스처가 끝났다고 보는 무변경 시간 (ms).
 *
 * Pen v1.2.1 의 debouncedMoveEnd 와 같은 값이고, 렌더러의
 * `SkiaRenderer.scheduleCleanupRender` 도 같은 200ms 를 쓴다 — 제스처 종료
 * 정리(cleanup 재렌더)와 가시 집합 따라잡기가 같은 시점에 모이도록.
 */
export const CAMERA_GESTURE_IDLE_MS = 200;

/**
 * ADR-173 Phase 3 — 카메라 제스처 진행 여부.
 *
 * 카메라를 움직이는 소스는 여럿(버튼 팬 / wheel 팬 / 줌 / 프로그램 이동)이지만
 * 전부 `ViewportController.setOnStateSync` → `useViewportSyncStore` 한 곳을
 * 지난다 (`useViewportControl.ts`). 그래서 신호는 소스별 분기 없이 store 변경
 * debounce 하나로 충분하고, 종료 이벤트가 없는 wheel 문제도 함께 풀린다.
 *
 * 반환값이 state 인 것이 중요하다 — 만료가 리렌더를 일으켜야 가시 집합
 * 게이트가 열리고 얼어 있던 카메라를 따라잡는다. 카메라가 움직이는 동안에는
 * 어차피 store 구독으로 리렌더 중이라 추가 비용이 없다.
 */
export function useCameraGestureActive(
  idleMs: number = CAMERA_GESTURE_IDLE_MS,
): boolean {
  const zoom = useViewportSyncStore((state) => state.zoom);
  const panX = useViewportSyncStore((state) => state.panOffset.x);
  const panY = useViewportSyncStore((state) => state.panOffset.y);
  const [active, setActive] = useState(false);
  const seenFirstRef = useRef(false);

  useEffect(() => {
    // 마운트 시점의 카메라는 "이동" 이 아니다 — 여기서 활성으로 잡으면 초기
    // 로드가 제스처로 오인되어 첫 가시 집합 산출이 200ms 밀린다.
    if (!seenFirstRef.current) {
      seenFirstRef.current = true;
      return;
    }

    setActive(true);
    const timer = setTimeout(() => setActive(false), idleMs);
    return () => clearTimeout(timer);
  }, [idleMs, panX, panY, zoom]);

  return active;
}
