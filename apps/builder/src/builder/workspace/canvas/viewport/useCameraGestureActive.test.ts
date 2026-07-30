import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewportSyncStore } from "../stores";
import {
  CAMERA_GESTURE_IDLE_MS,
  useCameraGestureActive,
} from "./useCameraGestureActive";

/**
 * ADR-173 Phase 3 — 제스처 활성 신호.
 *
 * 카메라 변경은 소스가 여럿(버튼 팬 / wheel 팬 / 줌 / 프로그램 이동)이지만
 * 전부 `ViewportController.setOnStateSync` → `useViewportSyncStore` 한 곳을
 * 지난다. 그래서 신호는 소스별 분기 없이 **store 변경 debounce** 하나다.
 * wheel 에는 종료 이벤트가 없다는 문제도 여기서 함께 해소된다.
 */

function moveCamera(panX: number, zoom = 1): void {
  act(() => {
    useViewportSyncStore.getState().setViewportSnapshot({
      panOffset: { x: panX, y: 0 },
      zoom,
    });
  });
}

describe("ADR-173 Phase 3 — 카메라 제스처 활성 신호", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useViewportSyncStore.setState({ panOffset: { x: 0, y: 0 }, zoom: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("마운트만으로는 활성이 아니다 (초기 카메라는 제스처가 아님)", () => {
    const { result } = renderHook(() => useCameraGestureActive());

    expect(result.current).toBe(false);
  });

  it("카메라가 바뀌면 활성이 된다", () => {
    const { result } = renderHook(() => useCameraGestureActive());

    moveCamera(-100);

    expect(result.current).toBe(true);
  });

  it("마지막 변경 후 idle 시간이 지나면 해제된다", () => {
    const { result } = renderHook(() => useCameraGestureActive());

    moveCamera(-100);
    act(() => {
      vi.advanceTimersByTime(CAMERA_GESTURE_IDLE_MS + 1);
    });

    expect(result.current).toBe(false);
  });

  it("연속 이동 중에는 해제되지 않는다 (타이머가 매 변경마다 재설정)", () => {
    const { result } = renderHook(() => useCameraGestureActive());

    for (let i = 1; i <= 5; i++) {
      moveCamera(-100 * i);
      act(() => {
        vi.advanceTimersByTime(CAMERA_GESTURE_IDLE_MS - 20);
      });
      expect(result.current).toBe(true);
    }

    act(() => {
      vi.advanceTimersByTime(CAMERA_GESTURE_IDLE_MS + 1);
    });
    expect(result.current).toBe(false);
  });

  it("왕복 제스처로 좌표가 같은 값에 되돌아와도 활성이 유지된다", () => {
    // 줌 인↔아웃 왕복이나 팬 왕복에서는 카메라 값이 주기적으로 같은 값으로
    // 돌아온다. 신호가 **값** 을 보면 그 프레임에 effect 가 돌지 않아 타이머가
    // 리셋되지 않고 만료돼 버린다 — 제스처 한복판에서 게이트가 열린다.
    const { result } = renderHook(() => useCameraGestureActive());

    moveCamera(-100);
    for (let i = 0; i < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(CAMERA_GESTURE_IDLE_MS - 20);
      });
      moveCamera(-100); // 같은 좌표 — 이벤트는 계속 오고 있다
    }

    expect(result.current).toBe(true);
  });

  it("줌만 바뀌어도 활성이 된다 (팬 전용 신호가 아님)", () => {
    const { result } = renderHook(() => useCameraGestureActive());

    moveCamera(0, 1.5);

    expect(result.current).toBe(true);
  });
});
