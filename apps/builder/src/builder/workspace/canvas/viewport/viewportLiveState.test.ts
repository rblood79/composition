import { afterEach, describe, expect, it } from "vitest";
import { useViewportSyncStore } from "../stores";
import {
  getViewportController,
  resetViewportController,
} from "./ViewportController";
import { getViewportAuthoritativeState } from "../../../workspace/scrollbar/viewportMetrics";

/**
 * 뷰포트 "실시간 상태" 판정 계약.
 *
 * **Why (2026-08-15 실측)**: 소비자들이 이 판정을 `isAttached()`(PixiJS Container 연결
 * 여부)로 했는데 ADR-900 으로 attach 호출부가 사라져 **항상 false** 다. 그 결과
 * 스크롤바는 pan 중 컨트롤러의 실시간 상태 대신 React mirror(=endPan 에서만 동기화)를
 * 읽어 thumb 이 제자리에 멈췄고, `panToPage`/workflow pan 은 early return 으로
 * 완전한 no-op 이었다. Container 없이도 `currentState` 는 갱신되므로 그 사실을
 * `hasLiveState()` 로 따로 표현한다.
 */
afterEach(() => {
  resetViewportController();
  useViewportSyncStore.getState().reset();
});

describe("ViewportController.hasLiveState", () => {
  it("초기에는 live 가 아니다 — mirror 가 유일한 출처", () => {
    expect(getViewportController().hasLiveState()).toBe(false);
  });

  it("setPosition 만으로 live 가 된다", () => {
    const controller = getViewportController();
    controller.setPosition(-100, -50, 2);

    expect(controller.hasLiveState()).toBe(true);
  });

  it("초기값과 같은 setPosition도 live 상태를 seed 한다", () => {
    const controller = getViewportController();

    expect(controller.setPosition(0, 0, 1)).toBe(false);
    expect(controller.hasLiveState()).toBe(true);
  });
});

describe("getViewportAuthoritativeState", () => {
  it("live 이면 mirror 가 아니라 controller 상태를 쓴다 (pan 중 실시간 추적)", () => {
    const controller = getViewportController();
    // mirror 는 pan 시작 시점 값에 머문다
    useViewportSyncStore.setState({ panOffset: { x: 0, y: 0 }, zoom: 1 });
    controller.setPosition(-640, -120, 1);

    expect(getViewportAuthoritativeState()).toEqual({
      scale: 1,
      x: -640,
      y: -120,
    });
  });

  it("live 가 아니면 mirror 로 폴백한다", () => {
    useViewportSyncStore.setState({ panOffset: { x: 7, y: 9 }, zoom: 0.5 });

    expect(getViewportAuthoritativeState()).toEqual({ scale: 0.5, x: 7, y: 9 });
  });
});
