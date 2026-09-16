// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
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
import { PageHeaderLayer, isPageHeaderEventTarget } from "./PageHeaderLayer";

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

function headerOf(layer: HTMLElement, pageId: string): HTMLElement {
  const node = layer.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`);
  if (!node) throw new Error(`header ${pageId} 없음`);
  return node;
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

describe("PageHeaderLayer — 히트 (pointerdown · 이름 편집)", () => {
  beforeEach(() => {
    testStore.setState({ currentPageId: "p2", selectedElementIds: [] });
    resetCanvasFramePresentation();
  });
  afterEach(cleanup);

  it("헤더 pointerdown (button 0) → onHeaderPointerDown(pageId, nativeEvent) — 타이틀 span 에서 눌러도 같다", () => {
    const onHeaderPointerDown = vi.fn();
    const { container } = render(
      <PageHeaderLayer
        frames={frames}
        onHeaderPointerDown={onHeaderPointerDown}
      />,
    );
    const layer = container.firstElementChild as HTMLElement;
    const span = headerOf(layer, "p1").querySelector(
      ".page-header__title",
    ) as HTMLElement;
    fireEvent.pointerDown(span, { button: 0, pointerId: 7, shiftKey: true });
    expect(onHeaderPointerDown).toHaveBeenCalledTimes(1);
    expect(onHeaderPointerDown.mock.calls[0][0]).toBe("p1");
    const event = onHeaderPointerDown.mock.calls[0][1] as PointerEvent;
    expect(event.shiftKey).toBe(true);
    expect(event.pointerId).toBe(7);

    // 중클릭 (pan) · 층 빈 곳은 호출 없음
    fireEvent.pointerDown(span, { button: 1 });
    fireEvent.pointerDown(layer, { button: 0 });
    expect(onHeaderPointerDown).toHaveBeenCalledTimes(1);
    expect(isPageHeaderEventTarget(span)).toBe(true);
    expect(isPageHeaderEventTarget(layer)).toBe(false);
  });

  it("dblclick → onBeginRename + 편집기 (헤더 노드 안) · Enter → onRenamePage · Esc → 취소", () => {
    const onBeginRename = vi.fn();
    const onRenamePage = vi.fn();
    const { container } = render(
      <PageHeaderLayer
        frames={frames}
        canRenamePage={(pageId) => pageId !== "p3"}
        onBeginRename={onBeginRename}
        onRenamePage={onRenamePage}
      />,
    );
    const layer = container.firstElementChild as HTMLElement;

    // 편집 불가 페이지는 열리지 않는다
    fireEvent.dblClick(headerOf(layer, "p3"), { button: 0 });
    expect(layer.querySelector("input")).toBeNull();
    expect(onBeginRename).not.toHaveBeenCalled();

    fireEvent.dblClick(headerOf(layer, "p1"), { button: 0 });
    expect(onBeginRename).toHaveBeenCalledWith("p1");
    const header = headerOf(layer, "p1");
    expect(header.hasAttribute("data-editing")).toBe(true);
    const input = header.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe("One");
    expect(input.getAttribute("data-text-editing")).toBe("true");

    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);
    expect(onRenamePage).toHaveBeenCalledWith("p1", "Renamed");
    expect(headerOf(layer, "p1").querySelector("input")).toBeNull();
    expect(headerOf(layer, "p1").textContent).toBe("One");

    // Esc — 취소 (rename 호출 없음)
    fireEvent.dblClick(headerOf(layer, "p1"), { button: 0 });
    const input2 = headerOf(layer, "p1").querySelector(
      "input",
    ) as HTMLInputElement;
    fireEvent.change(input2, { target: { value: "Discard" } });
    fireEvent.keyDown(input2, { key: "Escape" });
    fireEvent.blur(input2);
    expect(onRenamePage).toHaveBeenCalledTimes(1);
    expect(headerOf(layer, "p1").querySelector("input")).toBeNull();
  });

  it("편집기 안 pointerdown 은 헤더 핸들러로 가지 않는다 (drag 시작 금지)", () => {
    const onHeaderPointerDown = vi.fn();
    const { container } = render(
      <PageHeaderLayer
        frames={frames}
        onHeaderPointerDown={onHeaderPointerDown}
        onRenamePage={() => {}}
      />,
    );
    const layer = container.firstElementChild as HTMLElement;
    fireEvent.dblClick(headerOf(layer, "p1"), { button: 0 });
    const input = headerOf(layer, "p1").querySelector("input") as HTMLElement;
    fireEvent.pointerDown(input, { button: 0 });
    expect(onHeaderPointerDown).not.toHaveBeenCalled();
  });
});
