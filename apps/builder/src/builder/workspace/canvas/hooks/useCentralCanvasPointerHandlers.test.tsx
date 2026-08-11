// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
import { useCentralCanvasPointerHandlers } from "./useCentralCanvasPointerHandlers";

const { getStateMock, hitTestPointMock } = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  hitTestPointMock: vi.fn(() => [] as string[]),
}));

vi.mock("../../../stores", () => ({
  useStore: {
    getState: getStateMock,
  },
}));

vi.mock("../../../hooks/useKeyboardShortcutsRegistry", () => ({
  useKeyboardShortcutsRegistry: () => {},
}));

vi.mock("../../../utils/perfMarks", () => ({
  observe: (_label: string, callback: () => void) => callback(),
  PERF_LABEL: { INPUT_POINTERDOWN: "input.pointerdown" },
}));

vi.mock("../wasm-bindings/spatialIndex", () => ({
  hitTestPoint: hitTestPointMock,
}));

function ref<T>(current: T): MutableRefObject<T> {
  return { current };
}

function createPointerDown(
  pointerId: number,
  clientX: number,
  clientY: number,
): Event {
  const event = new Event("pointerdown", { bubbles: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: pointerId },
  });
  return event;
}

describe("useCentralCanvasPointerHandlers page body drag", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0 }),
    });
    hitTestPointMock.mockReturnValue([]);
  });

  afterEach(() => {
    cleanup();
    container.remove();
    vi.clearAllMocks();
  });

  it("선택된 page body의 빈 영역을 끌면 page drag를 시작한다", () => {
    const body: CanvasInteractionNode = {
      id: "page-1-body",
      type: "body",
      page_id: "page-1",
      parent_id: null,
      props: {},
    };
    const elementsMap = new Map([[body.id, body]]);
    const gestureSession = new CanvasGestureSession();
    const handleElementClick = vi.fn();
    const startPageDrag = vi.fn();

    getStateMock.mockReturnValue({
      activeBreakpoint: "desktop",
      currentPageId: "page-1",
      editingContextId: null,
      pageIndex: { elementsByPage: new Map([["page-1", new Set([body.id])]]) },
      pagePositions: { "page-1": { x: 0, y: 0 } },
      pages: [{ id: "page-1" }],
      selectedElementIds: [body.id],
    });

    renderHook(() =>
      useCentralCanvasPointerHandlers({
        gestureSession,
        completeEditRef: ref(() => {}),
        computeSelectionBoundsForHitTest: () => ({
          x: 0,
          y: 0,
          width: 390,
          height: 844,
        }),
        containerRef: ref(container),
        editingElementIdRef: ref(null),
        handleElementClickRef: ref(handleElementClick),
        handleElementDoubleClickRef: ref(() => {}),
        getHitChildrenMap: () => new Map(),
        getHitElementsMap: () => elementsMap,
        isEditingRef: ref(false),
        lastClickTargetRef: ref(null),
        lastClickTimeRef: ref(0),
        onCancelDrag: ref(() => {}),
        onEndDrag: ref(() => {}),
        onStartMove: ref(() => {}),
        onUpdateDrag: ref(() => {}),
        pageHeight: 844,
        pageWidth: 390,
        screenToCanvasPoint: (position) => position,
        selectionBoundsRef: ref(null),
        selectElementWithPageTransition: () => {},
        setCurrentPageId: () => {},
        setCursor: () => {},
        setSelectedElements: () => {},
        startPageDrag,
        zoom: 1,
      }),
    );

    gestureSession.beginPointer(7, 0);
    act(() => {
      container.dispatchEvent(createPointerDown(7, 120, 200));
    });

    expect(hitTestPointMock).toHaveBeenCalledWith(120, 200);
    expect(handleElementClick).not.toHaveBeenCalled();
    expect(gestureSession.ownerFor(7)).toBe("page");
    expect(startPageDrag).toHaveBeenCalledWith("page-1", 7, 120, 200);
  });

  it("선택된 page body의 selection outline을 끌면 page drag를 시작한다", () => {
    const body: CanvasInteractionNode = {
      id: "page-1-body",
      type: "body",
      pageId: "page-1",
      parent_id: null,
      props: {},
    };
    const elementsMap = new Map([[body.id, body]]);
    const gestureSession = new CanvasGestureSession();
    const startPageDrag = vi.fn();

    getStateMock.mockReturnValue({
      activeBreakpoint: "desktop",
      currentPageId: "page-1",
      editingContextId: null,
      pageIndex: { elementsByPage: new Map([["page-1", new Set([body.id])]]) },
      pagePositions: { "page-1": { x: 0, y: 0 } },
      pages: [{ id: "page-1" }],
      selectedElementIds: [body.id],
    });

    renderHook(() =>
      useCentralCanvasPointerHandlers({
        gestureSession,
        completeEditRef: ref(() => {}),
        computeSelectionBoundsForHitTest: () => ({
          x: 0,
          y: 0,
          width: 390,
          height: 844,
        }),
        containerRef: ref(container),
        editingElementIdRef: ref(null),
        handleElementClickRef: ref(() => {}),
        handleElementDoubleClickRef: ref(() => {}),
        getHitChildrenMap: () => new Map(),
        getHitElementsMap: () => elementsMap,
        isEditingRef: ref(false),
        lastClickTargetRef: ref(null),
        lastClickTimeRef: ref(0),
        onCancelDrag: ref(() => {}),
        onEndDrag: ref(() => {}),
        onStartMove: ref(() => {}),
        onUpdateDrag: ref(() => {}),
        pageHeight: 844,
        pageWidth: 390,
        screenToCanvasPoint: (position) => position,
        selectionBoundsRef: ref(null),
        selectElementWithPageTransition: () => {},
        setCurrentPageId: () => {},
        setCursor: () => {},
        setSelectedElements: () => {},
        startPageDrag,
        zoom: 1,
      }),
    );

    gestureSession.beginPointer(8, 0);
    act(() => {
      container.dispatchEvent(createPointerDown(8, 0, 400));
    });

    expect(startPageDrag).toHaveBeenCalledWith("page-1", 8, 0, 400);
    expect(gestureSession.ownerFor(8)).toBe("page");
  });

  it("projection body가 page id를 생략해도 현재 page의 outline drag를 유지한다", () => {
    const body: CanvasInteractionNode = {
      id: "page-1-body",
      type: "body",
      parent_id: null,
      props: {},
    };
    const elementsMap = new Map([[body.id, body]]);
    const gestureSession = new CanvasGestureSession();
    const startPageDrag = vi.fn();

    getStateMock.mockReturnValue({
      activeBreakpoint: "desktop",
      currentPageId: "page-1",
      editingContextId: null,
      pageIndex: { elementsByPage: new Map([["page-1", new Set([body.id])]]) },
      pagePositions: { "page-1": { x: 0, y: 0 } },
      pages: [{ id: "page-1" }],
      selectedElementIds: [body.id],
    });

    renderHook(() =>
      useCentralCanvasPointerHandlers({
        gestureSession,
        completeEditRef: ref(() => {}),
        computeSelectionBoundsForHitTest: () => ({
          x: 0,
          y: 0,
          width: 390,
          height: 844,
        }),
        containerRef: ref(container),
        editingElementIdRef: ref(null),
        handleElementClickRef: ref(() => {}),
        handleElementDoubleClickRef: ref(() => {}),
        getHitChildrenMap: () => new Map(),
        getHitElementsMap: () => elementsMap,
        isEditingRef: ref(false),
        lastClickTargetRef: ref(null),
        lastClickTimeRef: ref(0),
        onCancelDrag: ref(() => {}),
        onEndDrag: ref(() => {}),
        onStartMove: ref(() => {}),
        onUpdateDrag: ref(() => {}),
        pageHeight: 844,
        pageWidth: 390,
        screenToCanvasPoint: (position) => position,
        selectionBoundsRef: ref(null),
        selectElementWithPageTransition: () => {},
        setCurrentPageId: () => {},
        setCursor: () => {},
        setSelectedElements: () => {},
        startPageDrag,
        zoom: 1,
      }),
    );

    gestureSession.beginPointer(9, 0);
    act(() => {
      container.dispatchEvent(createPointerDown(9, 0, 400));
    });

    expect(startPageDrag).toHaveBeenCalledWith("page-1", 9, 0, 400);
    expect(gestureSession.ownerFor(9)).toBe("page");
  });
});
