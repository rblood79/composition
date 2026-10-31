import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useBuilderUiStore } from "../../../stores/builderUiStore";
import {
  publishCanvasFramePresentation,
  resetCanvasFramePresentation,
} from "../canvasFramePresentation";
import { getPagePositionPresentationSnapshot } from "../interaction/pagePositionPresentation";
import type { BoundingBox } from "../selection/types";
import {
  publishViewportPresentation,
  resetViewportPresentation,
} from "../viewport/viewportPresentation";
import { CatalogSelectionRuler } from "./CatalogSelectionRuler";

afterEach(() => {
  cleanup();
  useBuilderUiStore.getState().setShowRulers(false);
  resetViewportPresentation();
  resetCanvasFramePresentation();
});

function frame() {
  act(() => {
    publishCanvasFramePresentation(
      { zoom: 1, panX: 0, panY: 0 },
      getPagePositionPresentationSnapshot(),
    );
  });
}

it("선택·이동·리사이즈·선택 해제는 Canvas 프레임에서 갱신하고 팬·줌은 수치를 바꾸지 않는다", () => {
  useBuilderUiStore.getState().setShowRulers(true);
  let box: BoundingBox | null = { x: 120, y: 80, width: 30, height: 40 };
  const { container } = render(
    <CatalogSelectionRuler selectionBox={() => box} />,
  );
  const root = container.firstElementChild as HTMLElement;
  const values = () =>
    Array.from(
      container.querySelectorAll(".ruler-selection-value"),
      (el) => el.textContent,
    );
  const ranges = container.querySelectorAll<HTMLElement>(
    ".ruler-selection-range",
  );
  expect(values()).toEqual(["120", "150", "80", "120"]);
  expect(root.hidden).toBe(false);
  expect(ranges[0].style.transform).toBe("translateX(120px)");
  expect(ranges[1].style.height).toBe("40px");
  act(() => publishViewportPresentation({ x: 10, y: 30, scale: 2 }));
  expect(values()).toEqual(["120", "150", "80", "120"]);
  expect(ranges[0].style.transform).toBe("translateX(250px)");
  expect(ranges[0].style.width).toBe("60px");
  expect(ranges[1].style.transform).toBe("translateY(190px)");
  expect(ranges[1].style.height).toBe("80px");
  box = { x: 150.125, y: 95, width: 60, height: 10 };
  frame();
  expect(values()).toEqual(["150.13", "210.13", "95", "105"]);
  expect(ranges[0].style.width).toBe("120px");
  box = null;
  frame();
  expect(root.hidden).toBe(true);
});

it("음수 시작값·작은 선택 구간과 눈금자 토글을 처리한다", () => {
  useBuilderUiStore.getState().setShowRulers(true);
  const { container } = render(
    <CatalogSelectionRuler
      selectionBox={() => ({ x: -5, y: 50, width: 40, height: 1 })}
    />,
  );
  const labels = container.querySelectorAll<HTMLElement>(
    ".ruler-selection-value",
  );
  expect(labels[0].hidden).toBe(true);
  expect(labels[1].hidden).toBe(false);
  expect(labels[2].style.transform).toBe("translateY(47px) translateY(-100%)");
  expect(labels[3].style.transform).toBe("translateY(54px)");
  act(() => publishViewportPresentation({ x: 100, y: 0, scale: 1 }));
  expect(labels[0].textContent).toBe("-5");
  expect(labels[0].hidden).toBe(false);
  act(() => useBuilderUiStore.getState().setShowRulers(false));
  expect(container.childElementCount).toBe(0);
  act(() => useBuilderUiStore.getState().setShowRulers(true));
  expect(container.querySelectorAll(".ruler-selection-value")).toHaveLength(4);
});

it("페이지 원점이 바뀌면 선택 경계의 화면 위치는 유지하고 수치만 페이지 기준으로 바꾼다", () => {
  useBuilderUiStore.getState().setShowRulers(true);
  let origin = { x: 470, y: 300 };
  const { container } = render(
    <CatalogSelectionRuler
      selectionBox={() => ({ x: 490, y: 340, width: 100, height: 50 })}
      readOrigin={() => origin}
    />,
  );
  const values = () =>
    Array.from(
      container.querySelectorAll(".ruler-selection-value"),
      (el) => el.textContent,
    );
  const range = container.querySelector<HTMLElement>(".ruler-selection-range")!;
  expect(values()).toEqual(["20", "120", "40", "90"]);
  expect(range.style.transform).toBe("translateX(490px)");
  origin = { x: 490, y: 340 };
  frame();
  expect(values()).toEqual(["0", "100", "0", "50"]);
  expect(range.style.transform).toBe("translateX(490px)");
});
