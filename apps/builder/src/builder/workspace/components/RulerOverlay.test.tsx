import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBuilderUiStore } from "../../stores/builderUiStore";
import {
  publishViewportPresentation,
  resetViewportPresentation,
} from "../canvas/viewport/viewportPresentation";
import { RulerOverlay } from "./RulerOverlay";

afterEach(() => {
  cleanup();
  useBuilderUiStore.getState().setShowRulers(false);
  resetViewportPresentation();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("팬·줌에서 고정 스타일을 다시 쓰지 않고 캔버스 원점에 맞춰 눈금을 갱신한다", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 800, 600),
  );
  useBuilderUiStore.getState().setShowRulers(true);
  const { container } = render(<RulerOverlay />);
  const root = container.querySelector<HTMLElement>(".ruler-overlay")!;
  const horizontal = container.querySelector<HTMLElement>(".ruler-strip--h")!;
  const vertical = container.querySelector<HTMLElement>(".ruler-strip--v")!;
  const fixedStyleWrite = vi.spyOn(root.style, "setProperty");

  for (const scale of [1, 2]) {
    act(() => {
      publishViewportPresentation({ x: 123, y: 167, scale });
    });

    // 월드 좌표 0의 화면 위치 = pan. 라벨 여백 3px, 세로 스트립 원점 20px.
    const xZero = [
      ...horizontal.querySelectorAll<HTMLElement>(".ruler-label"),
    ].find((label) => label.textContent === "0")!;
    const yZero = [
      ...vertical.querySelectorAll<HTMLElement>(".ruler-label"),
    ].find((label) => label.textContent === "0")!;
    expect(xZero.style.transform).toBe("translateX(126px)");
    expect(yZero.style.transform).toBe("translateY(150px)");
  }

  expect(fixedStyleWrite).not.toHaveBeenCalled();
  expect(root.style.getPropertyValue("--ruler-size")).toBe("20px");
});
