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

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resetCanvasFramePresentation } from "../../canvasFramePresentation";
import { useViewportSyncStore } from "../../stores";
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

  it("액션 버튼 (타이틀 앞 Play · 뒤 close) — 헤더마다 둘, 누르면 페이지 선택·드래그·이름편집으로 새지 않는다", () => {
    const onHeaderPointerDown = vi.fn();
    const onBeginRename = vi.fn();
    const { container } = render(
      <PageHeaderLayer
        frames={frames}
        onBeginRename={onBeginRename}
        onHeaderPointerDown={onHeaderPointerDown}
      />,
    );
    const layer = container.firstElementChild as HTMLElement;
    // 제목 있는 헤더 3개 각각에 액션 버튼 2개 (앞 Play · 뒤 close)
    expect(layer.querySelectorAll(".page-header__action").length).toBe(6);

    const actions = headerOf(layer, "p1").querySelectorAll<HTMLElement>(
      ".page-header__action",
    );
    // DOM 순서 = 시각 순서: Play 가 타이틀 앞, close 가 뒤
    expect(actions[0].getAttribute("aria-label")).toBe("Play One");
    expect(actions[1].getAttribute("aria-label")).toBe("Close One");
    const title = headerOf(layer, "p1").querySelector(".page-header__title");
    expect(
      actions[0].compareDocumentPosition(title!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const action = actions[1];

    // 액션 위 제스처는 헤더 제스처에서 제외 (층 루트 리스너가 버튼 자손을 삼키지 않는다)
    fireEvent.pointerDown(action, { button: 0, pointerId: 3 });
    expect(onHeaderPointerDown).not.toHaveBeenCalled();
    fireEvent.dblClick(action, { button: 0 });
    expect(onBeginRename).not.toHaveBeenCalled();
    expect(layer.querySelector("input")).toBeNull();
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

describe("PageHeaderLayer — 헤더 폭 티어 (ADR-226 Decision 2)", () => {
  const tierFrames = [
    { id: "desktop", title: "Desktop", x: 0, y: 0, width: 1920, height: 1080 },
    { id: "mobile", title: "Mobile", x: 3000, y: 0, width: 390, height: 844 },
  ];
  beforeEach(() => {
    testStore.setState({ currentPageId: "desktop", selectedElementIds: [] });
    resetCanvasFramePresentation();
    useViewportSyncStore.getState().reset();
  });
  afterEach(() => {
    cleanup();
    useViewportSyncStore.getState().reset();
  });

  it("settle zoom 0.1: 1920 → full (버튼 2) · 390 → compact (버튼 0 · 타이틀 유지)", () => {
    act(() =>
      useViewportSyncStore
        .getState()
        .setViewportSnapshot({ zoom: 0.1, panOffset: { x: 0, y: 0 } }),
    );
    const { container } = render(<PageHeaderLayer frames={tierFrames} />);
    const layer = container.firstElementChild as HTMLElement;
    const desktop = headerOf(layer, "desktop");
    const mobile = headerOf(layer, "mobile");
    expect(desktop.dataset.lod).toBe("full");
    expect(desktop.querySelectorAll(".page-header__action").length).toBe(2);
    expect(mobile.dataset.lod).toBe("compact");
    expect(mobile.querySelectorAll(".page-header__action").length).toBe(0);
    expect(mobile.querySelector(".page-header__title")?.textContent).toBe(
      "Mobile",
    );

    // zoom 0.3 → 117 px → full 복귀
    act(() =>
      useViewportSyncStore
        .getState()
        .setViewportSnapshot({ zoom: 0.3, panOffset: { x: 0, y: 0 } }),
    );
    expect(headerOf(layer, "mobile").dataset.lod).toBe("full");
    expect(
      headerOf(layer, "mobile").querySelectorAll(".page-header__action").length,
    ).toBe(2);
  });

  it("제스처 중에는 zoom 미러가 바뀌어도 티어가 바뀌지 않는다 (settle 스냅샷)", () => {
    const { container } = render(<PageHeaderLayer frames={tierFrames} />);
    const layer = container.firstElementChild as HTMLElement;
    expect(headerOf(layer, "mobile").dataset.lod).toBe("full");
    act(() => useViewportSyncStore.getState().setCameraGestureActive(true));
    // settle 순서: 카메라 미러 commit 이 gate-off 보다 먼저 온다 (reviews/226 l1)
    act(() =>
      useViewportSyncStore
        .getState()
        .setViewportSnapshot({ zoom: 0.1, panOffset: { x: 0, y: 0 } }),
    );
    expect(headerOf(layer, "mobile").dataset.lod).toBe("full");
    act(() => useViewportSyncStore.getState().setCameraGestureActive(false));
    expect(headerOf(layer, "mobile").dataset.lod).toBe("compact");
  });

  it("이름 편집 중인 헤더는 compact 폭에서도 full (편집기 폭 확보)", () => {
    act(() =>
      useViewportSyncStore
        .getState()
        .setViewportSnapshot({ zoom: 0.1, panOffset: { x: 0, y: 0 } }),
    );
    const { container } = render(
      <PageHeaderLayer frames={tierFrames} onRenamePage={() => {}} />,
    );
    const layer = container.firstElementChild as HTMLElement;
    expect(headerOf(layer, "mobile").dataset.lod).toBe("compact");
    fireEvent.dblClick(headerOf(layer, "mobile"), { button: 0 });
    const mobile = headerOf(layer, "mobile");
    expect(mobile.hasAttribute("data-editing")).toBe(true);
    expect(mobile.dataset.lod).toBe("full");
    expect(mobile.querySelector("input")).not.toBeNull();
    const input = mobile.querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(headerOf(layer, "mobile").querySelector("input")).toBeNull();
    expect(headerOf(layer, "mobile").dataset.lod).toBe("compact");
  });

  it("CSS 정적 계약 — 일반 타이틀 12px 600 · 편집 input 700 · compact 규칙은 gap 만", async () => {
    const css = await readFile(
      resolve(__dirname, "PageHeaderLayer.css"),
      "utf-8",
    );
    const base = css.match(/\n\.page-header \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(base).toContain("font-size: 12px;");
    expect(base).toContain("font-weight: 600;");
    const input =
      css.match(/\.page-header \.page-title-edit-input \{[\s\S]*?\n\}/)?.[0] ??
      "";
    expect(input).toContain("font-weight: 700;");
    const compact =
      css.match(/\.page-header\[data-lod="compact"\] \{[\s\S]*?\n\}/)?.[0] ??
      "";
    expect(compact).not.toBe("");
    expect(compact).toContain("gap: 0;");
    // padding 은 full 과 같다 (사용자 판정 2026-09-19) · 타이포그래피 재정의 없음
    expect(compact).not.toContain("--page-header-padding-x");
    expect(compact).not.toMatch(/padding|font-(size|weight)/);
  });
});
