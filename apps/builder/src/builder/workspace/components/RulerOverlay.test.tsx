import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBuilderUiStore } from "../../stores/builderUiStore";
import {
  publishViewportPresentation,
  resetViewportPresentation,
} from "../canvas/viewport/viewportPresentation";
import { RulerOverlay } from "./RulerOverlay";
import { publishCanvasFramePresentation } from "../canvas/canvasFramePresentation";
import { getPagePositionPresentationSnapshot } from "../canvas/interaction/pagePositionPresentation";

afterEach(() => {
  cleanup();
  useBuilderUiStore.getState().setShowRulers(false);
  resetViewportPresentation();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("두 눈금자 스트립과 라벨에서 드래그와 전용 우클릭 메뉴를 연다", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  useBuilderUiStore.getState().setShowRulers(true);
  const create = vi.fn();
  const menu = vi.fn();
  const { container } = render(
    <RulerOverlay onStartGuideCreate={create} onOpenRulerMenu={menu} />,
  );
  for (const [suffix, strip, axis] of [
    ["h", "horizontal", "y"],
    ["v", "vertical", "x"],
  ] as const) {
    const el = container.querySelector(`.ruler-strip--${suffix}`)!;
    // jsdom에는 PointerEvent가 없어 MouseEvent로 동일한 bubbling 입력을 보낸다.
    fireEvent(el, new MouseEvent("pointerdown", { button: 0, bubbles: true }));
    expect(create).toHaveBeenLastCalledWith(axis, undefined, 0, 0);
    fireEvent.contextMenu(el.querySelector(".ruler-labels")!, {
      clientX: 50,
      clientY: 10,
    });
    expect(menu).toHaveBeenLastCalledWith(strip, 50, 10);
    const calls = create.mock.calls.length;
    fireEvent(el, new MouseEvent("pointerdown", { button: 2, bubbles: true }));
    expect(create).toHaveBeenCalledTimes(calls);
  }
});

it("선택이 없으면 팬·줌에도 Canvas 중앙 0과 양쪽 음수·양수를 유지한다", () => {
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

    // Canvas 800×600 중앙. 라벨 여백 3px, 세로 스트립 원점 20px.
    const xZero = [
      ...horizontal.querySelectorAll<HTMLElement>(".ruler-label"),
    ].find((label) => label.textContent === "0")!;
    const yZero = [
      ...vertical.querySelectorAll<HTMLElement>(".ruler-label"),
    ].find((label) => label.textContent === "0")!;
    expect(xZero.style.transform).toBe("translateX(403px)");
    expect(yZero.style.transform).toBe("translateY(283px)");
    for (const strip of [horizontal, vertical]) {
      const values = Array.from(
        strip.querySelectorAll(".ruler-label"),
        (label) => Number(label.textContent),
      );
      expect(values.some((value) => value < 0)).toBe(true);
      expect(values.some((value) => value > 0)).toBe(true);
    }
  }

  expect(fixedStyleWrite).not.toHaveBeenCalled();
  expect(root.style.getPropertyValue("--ruler-size")).toBe("20px");
});

it("페이지 전환과 줌에서 선택 페이지 좌상단을 0으로 표시한다", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(0, 0, 1200, 900),
  );
  useBuilderUiStore.getState().setShowRulers(true);
  let origin: { x: number; y: number } | null = { x: 470, y: 300 };
  const { container } = render(<RulerOverlay readOrigin={() => origin} />);
  const zero = (axis: string) =>
    Array.from(
      container.querySelectorAll<HTMLElement>(`.ruler-label--${axis}`),
    ).find((label) => label.textContent === "0")!.style.transform;
  expect(zero("x")).toBe("translateX(473px)");
  expect(zero("y")).toBe("translateY(283px)");
  origin = { x: 240, y: 150 };
  act(() => {
    publishCanvasFramePresentation(
      { zoom: 1, panX: 0, panY: 0 },
      getPagePositionPresentationSnapshot(),
    );
  });
  expect(zero("x")).toBe("translateX(243px)");
  expect(zero("y")).toBe("translateY(133px)");
  act(() => publishViewportPresentation({ x: 25, y: 50, scale: 2 }));
  expect(zero("x")).toBe("translateX(508px)");
  expect(zero("y")).toBe("translateY(333px)");
  origin = null;
  act(() => {
    publishCanvasFramePresentation(
      { zoom: 2, panX: 25, panY: 50 },
      getPagePositionPresentationSnapshot(),
    );
  });
  expect(zero("x")).toBe("translateX(603px)");
  expect(zero("y")).toBe("translateY(433px)");
});

it("선택이 없는 Canvas 크기 변경은 새로운 중앙으로 원점을 옮긴다", () => {
  let resized = () => {};
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
  bounds.mockReturnValue(new DOMRect(0, 0, 800, 600));
  useBuilderUiStore.getState().setShowRulers(true);
  const { container } = render(<RulerOverlay readOrigin={() => null} />);
  bounds.mockReturnValue(new DOMRect(0, 0, 1000, 800));
  act(() => resized());
  const zero = (axis: string) =>
    Array.from(
      container.querySelectorAll<HTMLElement>(`.ruler-label--${axis}`),
    ).find((label) => label.textContent === "0")!.style.transform;
  expect(zero("x")).toBe("translateX(503px)");
  expect(zero("y")).toBe("translateY(383px)");
});
