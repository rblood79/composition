// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestStoreState = {
  currentPageId: string | null;
  selectedElementIds: string[];
  pagePositions: Record<string, { x: number; y: number }>;
};

vi.mock("../../../../stores", async () => {
  const { create } = await import("zustand");
  const useStore = create<TestStoreState>(() => ({
    currentPageId: "p2",
    selectedElementIds: [],
    pagePositions: {},
  }));
  return { useStore };
});

import { useStore as testStore } from "../../../../stores";

import { resetCanvasFramePresentation } from "../../canvasFramePresentation";
import { PageHeaderLayer } from "./PageHeaderLayer";

const frames = [
  { id: "p1", title: "One", x: 0, y: 0, width: 400, height: 800 },
  { id: "p2", title: "Two", x: 1000, y: 0, width: 400, height: 800 },
  { id: "p3", title: "Three", x: 2000, y: 0, width: 400, height: 800 },
  { id: "untitled", title: "", x: 3000, y: 0, width: 400, height: 800 },
];

function order(layer: HTMLElement): string[] {
  return Array.from(layer.querySelectorAll<HTMLElement>("[data-page-id]")).map(
    (node) => node.dataset.pageId ?? "",
  );
}

describe("PageHeaderLayer — DOM 순서 · 활성 표시", () => {
  beforeEach(() => {
    testStore.setState({ currentPageId: "p2", selectedElementIds: [] });
    resetCanvasFramePresentation();
  });
  afterEach(cleanup);

  it("DOM 순서 = orderPagesForPaint (활성 페이지 마지막), 제목 없는 페이지는 제외", () => {
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;
    expect(layer.hasAttribute("data-page-header-layer")).toBe(true);
    expect(order(layer)).toEqual(["p1", "p3", "p2"]);
    expect(layer.querySelectorAll("[data-page-header]").length).toBe(3);
    expect(layer.textContent).toBe("OneThreeTwo");
  });

  it("data-active 는 currentPageId 하나, data-highlighted 는 선택이 있을 때만", () => {
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;
    const active = layer.querySelectorAll("[data-active]");
    expect(active.length).toBe(1);
    expect((active[0] as HTMLElement).dataset.pageId).toBe("p2");
    expect(layer.querySelectorAll("[data-highlighted]").length).toBe(0);

    act(() => testStore.setState({ selectedElementIds: ["el-1"] }));
    expect(layer.querySelectorAll("[data-highlighted]").length).toBe(1);

    act(() => testStore.setState({ currentPageId: "p1" }));
    // 문서 순서 유지 + 활성만 마지막
    expect(order(layer)).toEqual(["p2", "p3", "p1"]);
    expect(
      (layer.querySelector("[data-active]") as HTMLElement).dataset.pageId,
    ).toBe("p1");
  });

  it("키가 pageId 라 순서가 바뀌어도 같은 노드가 이동한다 (inline transform 보존)", () => {
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;
    const p1 = layer.querySelector('[data-page-id="p1"]') as HTMLElement;
    act(() => testStore.setState({ currentPageId: "p1" }));
    expect(layer.querySelector('[data-page-id="p1"]')).toBe(p1);
  });
});
