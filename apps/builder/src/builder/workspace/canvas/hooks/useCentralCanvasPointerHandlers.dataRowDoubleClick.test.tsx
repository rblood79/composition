// @vitest-environment jsdom
/**
 * ADR-150 Phase 2 · G2 (a)(b) — 데이터 카드 double-click 의 연속성 키 (round 4 h1).
 *
 * 펼친 GridList 카드의 Text 자식은 선택이 owner (`grid`) 로 돌아간다. 연속성 키가 owner id 면 서로 다른
 * 카드를 300ms 안에 한 번씩 눌러도 double-click 이 된다 — 키는 원래 hit 노드 (카드 · 자식 단위) 여야 한다.
 * 선택 경계 밖 (처음 클릭) · 안 (owner 선택 뒤) 두 분기 각각을 실제 scene 노드로 확인한다.
 */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MutableRefObject } from "react";
import type { CompositionDocument } from "@composition/shared";
import { CanvasGestureSession } from "../interaction/canvasGestureSession";
import type { CanvasInteractionNode } from "../interaction/interactionNode";
import { buildCanonicalSceneModel } from "../scene/canonicalSceneModel";
import { useCentralCanvasPointerHandlers } from "./useCentralCanvasPointerHandlers";

const { getStateMock, hitTestPointMock } = vi.hoisted(() => ({
  getStateMock: vi.fn(),
  hitTestPointMock: vi.fn(() => [] as string[]),
}));

vi.mock("../../../stores", () => ({
  useStore: { getState: getStateMock },
}));
vi.mock("../../../hooks/useKeyboardShortcutsRegistry", () => ({
  useKeyboardShortcutsRegistry: () => {},
}));
vi.mock("../../../utils/perfMarks", () => ({
  observe: (_label: string, callback: () => void) => callback(),
  PERF_LABEL: { INPUT_POINTERDOWN: "input.pointerdown" },
}));
vi.mock("../../../layout/panelWorkspaceVisibility", () => ({
  dismissCanvasSelectionPanels: vi.fn(),
}));
vi.mock("../wasm-bindings/spatialIndex", () => ({
  hitTestPoint: hitTestPointMock,
}));

function ref<T>(current: T): MutableRefObject<T> {
  return { current };
}

function pointerDown(pointerId: number): Event {
  const event = new Event("pointerdown", { bubbles: true });
  Object.defineProperties(event, {
    button: { value: 0 },
    clientX: { value: 50 },
    clientY: { value: 50 },
    pointerId: { value: pointerId },
  });
  return event;
}

function expandedGridListDoc(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-1",
        type: "frame",
        metadata: { type: "legacy-page", pageId: "page-1" },
        children: [
          {
            id: "card-origin",
            type: "GridListItem",
            reusable: true,
            props: {},
            children: [
              { id: "heading", type: "Text", props: { children: "{label}" } },
              {
                id: "detail",
                type: "Text",
                props: { children: "{description}" },
              },
            ],
          },
          {
            id: "grid",
            type: "GridList",
            slot: ["card-origin"],
            props: {
              items: [
                { id: "a", label: "A", description: "A detail" },
                { id: "b", label: "B", description: "B detail" },
              ],
            },
            children: [
              { id: "anchor", type: "ref", ref: "card-origin", props: {} },
            ],
          },
        ],
      },
    ],
  } as CompositionDocument;
}

describe("ADR-150 G2 — 데이터 카드 double-click 연속성 키 (두 분기)", () => {
  const model = buildCanonicalSceneModel(expandedGridListDoc());
  const elementsMap = model.sceneNodesMap as unknown as Map<
    string,
    CanvasInteractionNode
  >;
  const childrenMap = model.sceneChildrenByParent as unknown as Map<
    string,
    CanvasInteractionNode[]
  >;
  const textHit = (card: "a" | "b", child: "heading" | "detail") => {
    const node = model.sceneNodes.find(
      (n) =>
        n.type === "Text" &&
        n.projection?.kind === "gridlist-row" &&
        n.id.includes(`:${card}/`) &&
        n.id.endsWith(child),
    );
    if (!node) throw new Error(`no ${card}/${child} hit node`);
    return node.id;
  };

  let container: HTMLDivElement;
  let clock = 0;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    Object.defineProperty(container, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0 }),
    });
    clock = 1000;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
  });

  afterEach(() => {
    cleanup();
    container.remove();
    vi.restoreAllMocks();
  });

  function mount(selectedOwner: boolean) {
    const doubleClick = vi.fn();
    getStateMock.mockReturnValue({
      activeBreakpoint: "desktop",
      currentPageId: "page-1",
      editingContextId: null,
      pageIndex: {
        elementsByPage: new Map([["page-1", new Set(elementsMap.keys())]]),
      },
      derivedPagePositions: { "page-1": { x: 0, y: 0 } },
      pages: [{ id: "page-1" }],
      selectedElementIds: selectedOwner ? ["grid"] : [],
    });
    const gestureSession = new CanvasGestureSession();
    renderHook(() =>
      useCentralCanvasPointerHandlers({
        gestureSession,
        completeEditRef: ref(() => {}),
        // 선택 경계 안 분기: owner 가 선택돼 있고 클릭 지점이 그 박스 안.
        computeSelectionBoundsForHitTest: () =>
          selectedOwner ? { x: 0, y: 0, width: 400, height: 400 } : null,
        containerRef: ref(container),
        editingElementIdRef: ref(null),
        handleElementClickRef: ref(() => {}),
        handleElementDoubleClickRef: ref(doubleClick),
        getHitChildrenMap: () => childrenMap,
        getHitElementsMap: () => elementsMap,
        isEditingRef: ref(false),
        lastClickTargetRef: ref(null),
        lastClickTimeRef: ref(0),
        onCancelDrag: ref(() => {}),
        onEndDrag: ref(() => {}),
        onStartResize: ref(() => false),
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
        startPageDrag: () => {},
        zoom: 1,
      }),
    );
    let pointerId = 1;
    const click = (hitId: string, at: number) => {
      clock = at;
      hitTestPointMock.mockReturnValue([hitId]);
      const id = pointerId++;
      gestureSession.beginPointer(id, 0);
      act(() => {
        container.dispatchEvent(pointerDown(id));
      });
      gestureSession.endPointer?.(id);
    };
    return { doubleClick, click };
  }

  it.each([
    ["선택 경계 밖", false],
    ["선택 경계 안 (owner 선택 뒤)", true],
  ])(
    "%s: 카드 A → 200ms 뒤 카드 B 는 double-click 이 아니다",
    (_, selected) => {
      const { doubleClick, click } = mount(selected);
      click(textHit("a", "heading"), 1000);
      click(textHit("b", "detail"), 1200);
      expect(doubleClick).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["선택 경계 밖", false],
    ["선택 경계 안 (owner 선택 뒤)", true],
  ])(
    "%s: 같은 카드의 다른 자식 연속 클릭도 double-click 이 아니다",
    (_, selected) => {
      const { doubleClick, click } = mount(selected);
      click(textHit("a", "heading"), 1000);
      click(textHit("a", "detail"), 1200);
      expect(doubleClick).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["선택 경계 밖", false],
    ["선택 경계 안 (owner 선택 뒤)", true],
  ])(
    "%s: 같은 자식 두 번은 double-click — owner id + 원래 hit 를 넘긴다",
    (_, selected) => {
      const { doubleClick, click } = mount(selected);
      const heading = textHit("a", "heading");
      click(heading, 1000);
      click(heading, 1200);
      expect(doubleClick).toHaveBeenCalledOnce();
      const [targetId, options] = doubleClick.mock.calls[0]!;
      expect(targetId).toBe("grid");
      expect(options?.sourceHit?.nodeId).toBe(heading);
    },
  );
});
