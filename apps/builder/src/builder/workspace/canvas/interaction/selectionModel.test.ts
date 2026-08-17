import { afterEach, describe, expect, it } from "vitest";
import { withFrameElementMirrorId } from "../../../../adapters/canonical/frameMirror";
import type { Element } from "../../../../types/core/store.types";
import {
  computeSelectionBounds,
  isContainerWithinDragTargets,
  resolveBodySelection,
  resolveMultiDragTargets,
  resolveSelectedElementsForPage,
  resolveSelectionDragIntent,
  resolveTopPageIdAtPoint,
} from "./selectionModel";
import type { CanvasInteractionNode } from "./interactionNode";
import {
  beginPagePositionPresentation,
  finishPagePositionPresentation,
  resetPagePositionPresentation,
} from "./pagePositionPresentation";

function makeBody(id: string, frameId: string): Element {
  return withFrameElementMirrorId(
    {
      id,
      type: "body",
      page_id: null,
      parent_id: null,
      order_num: 0,
      props: {},
    } as Element,
    frameId,
  );
}

describe("selectionModel frame body selection", () => {
  it("keeps canonical frame bodies selectable even without a page_id", () => {
    const body = makeBody("frame-body", "frame-1");

    const selectedElements = resolveSelectedElementsForPage({
      currentPageId: "page-1",
      elementsMap: new Map([[body.id, body]]),
      selectedElementIds: [body.id],
    });

    expect(selectedElements).toEqual([body]);
  });

  it("resolves a page body through its camelCase pageId alias", () => {
    const body: CanvasInteractionNode = {
      id: "page-body",
      type: "body",
      pageId: "page-1",
      parent_id: null,
      props: {},
    };

    const selectedElements = resolveSelectedElementsForPage({
      currentPageId: "page-1",
      elementsMap: new Map([[body.id, body]]),
      selectedElementIds: [body.id],
    });

    expect(selectedElements).toEqual([body]);
  });

  it("keeps element selection bounds in scene coordinates (pan/zoom 무보정)", () => {
    // getBounds(=getElementBoundsSimple) 는 이미 **scene 좌표**를 반환하고,
    // 히트 판정 상대인 canvasPos 도 screenToCanvasPoint 결과라 scene 좌표다.
    // 여기서 panOffset 을 빼거나 zoom 으로 나누면 선택 박스가 유령 위치로 이동해
    // 엉뚱한 좌표의 클릭이 inSelectionBounds 로 먹힌다 (2026-07-24 실측:
    // scene 20,104 350x84 → -195,-124 로 panOffset(215,228) 만큼 이탈).
    const element = {
      id: "listbox-item",
      type: "ListBoxItem",
      page_id: "page-1",
      parent_id: "body-1",
      order_num: 0,
      props: {},
    } as unknown as Element;

    expect(
      computeSelectionBounds({
        getBounds: () => ({ x: 20, y: 104, width: 350, height: 84 }),
        pageHeight: 844,
        pageWidth: 390,
        selectedElements: [element],
        zoom: 1,
      }),
    ).toEqual({ x: 20, y: 104, width: 350, height: 84 });
  });

  it("does not rescale element selection bounds by zoom", () => {
    const element = {
      id: "card",
      type: "Card",
      page_id: "page-1",
      parent_id: "body-1",
      order_num: 0,
      props: {},
    } as unknown as Element;

    // zoom 은 화면 표시 배율일 뿐, scene 박스 크기는 변하지 않는다.
    expect(
      computeSelectionBounds({
        getBounds: () => ({ x: 40, y: 60, width: 200, height: 120 }),
        pageHeight: 844,
        pageWidth: 390,
        selectedElements: [element],
        zoom: 0.5,
      }),
    ).toEqual({ x: 40, y: 60, width: 200, height: 120 });
  });

  it("uses the frame area as the selection bounds for a frame body", () => {
    const body = makeBody("frame-body", "frame-1");

    expect(
      computeSelectionBounds({
        frameAreas: [
          { frameId: "frame-1", x: 120, y: 80, width: 640, height: 480 },
        ],
        pageHeight: 600,
        pageWidth: 800,
        selectedElements: [body],
      }),
    ).toEqual({ x: 120, y: 80, width: 640, height: 480 });
  });
});

describe("selectionModel breakpoint position reads", () => {
  const desktopPositions = {
    "page-1": { x: 0, y: 0 },
    "page-2": { x: 2000, y: 0 },
  };
  const tabletPositions = {
    "page-1": { x: 0, y: 0 },
    "page-2": { x: 848, y: 0 },
  };
  const pages = [{ id: "page-1" }, { id: "page-2" }];
  const page2Body: CanvasInteractionNode = {
    id: "page-2-body",
    type: "body",
    page_id: "page-2",
    parent_id: null,
    props: {},
  };

  afterEach(() => {
    resetPagePositionPresentation();
  });

  function finishDesktopPresentation(): void {
    beginPagePositionPresentation(desktopPositions, ["page-2"], "desktop");
    finishPagePositionPresentation(desktopPositions);
  }

  it("uses the active breakpoint positions for page body selection after a completed drag", () => {
    finishDesktopPresentation();

    expect(
      resolveBodySelection({
        canvasPoint: { x: 900, y: 100 },
        currentPageId: "page-1",
        elementsMap: new Map([[page2Body.id, page2Body]]),
        pageHeight: 1024,
        pageIndexElementsByPage: new Map([["page-2", new Set([page2Body.id])]]),
        pagePositions: tabletPositions,
        pageWidth: 768,
        pages,
      }),
    ).toEqual({ bodyElementId: page2Body.id, pageId: "page-2" });
  });

  it("uses the active breakpoint positions for page occlusion after a completed drag", () => {
    finishDesktopPresentation();

    expect(
      resolveTopPageIdAtPoint({
        canvasPoint: { x: 900, y: 100 },
        activePageId: "page-1",
        pageHeight: 1024,
        pagePositions: tabletPositions,
        pageWidth: 768,
        pages,
      }),
    ).toBe("page-2");
  });
});

describe("resolveSelectionDragIntent", () => {
  // body
  //  ├─ listbox ─ listbox-row
  //  └─ form    ─ form-input
  //
  // listbox 와 form 은 형제이고, listbox 의 선택 박스가 form 위에 겹칠 수 있다
  // (2026-07-24 실측: component-gridlist 박스 안에 component-form 입력이 들어옴).
  function node(
    id: string,
    type: string,
    parentId: string | null,
  ): CanvasInteractionNode {
    return { id, type, parent_id: parentId, props: {} };
  }

  const elementsMap: ReadonlyMap<string, CanvasInteractionNode> = new Map([
    ["body-1", node("body-1", "body", null)],
    ["listbox", node("listbox", "ListBox", "body-1")],
    ["listbox-row", node("listbox-row", "ListBoxItem", "listbox")],
    ["form", node("form", "Form", "body-1")],
    ["form-input", node("form-input", "TextField", "form")],
  ]);

  function intent(
    selectedIds: string[],
    hitElementId: string | null,
    editingContextId: string | null = null,
  ): boolean {
    return resolveSelectionDragIntent({
      editingContextId,
      elementsMap,
      hitElementId,
      selectedIds,
    });
  }

  it("treats a press on the selected element itself as drag intent", () => {
    expect(intent(["listbox"], "listbox")).toBe(true);
  });

  it("treats a press on a descendant of the selection as drag intent", () => {
    // 계층 정규화(resolveClickTarget)가 자손을 선택 요소로 되돌린다.
    expect(intent(["listbox"], "listbox-row")).toBe(true);
  });

  it("does NOT swallow a press on a different element that merely overlaps the selection box", () => {
    // 회귀: bbox 로 판정하면 여기가 true 가 되어 클릭이 통째로 무시됐다.
    // Figma / Pencil 실측 — 겹친 다른 객체를 클릭하면 그 객체가 선택된다.
    expect(intent(["listbox"], "form-input")).toBe(false);
    expect(intent(["listbox"], "form")).toBe(false);
  });

  it("does not swallow child presses while body is selected", () => {
    // body 선택 박스는 페이지 전체를 덮으므로 bbox 판정이면 모든 클릭이 무시된다.
    expect(intent(["body-1"], "form-input")).toBe(false);
    expect(intent(["body-1"], "listbox")).toBe(false);
  });

  it("keeps drag intent when the press hits nothing (기존 동작 보존)", () => {
    expect(intent(["listbox"], null)).toBe(true);
  });

  it("returns false when there is no selection", () => {
    expect(intent([], "listbox")).toBe(false);
    expect(intent([], null)).toBe(false);
  });

  it("supports multi-selection", () => {
    expect(intent(["listbox", "form"], "form-input")).toBe(true);
    expect(intent(["listbox", "form"], "listbox-row")).toBe(true);
  });

  it("normalizes against the active editing context", () => {
    // listbox 안으로 진입한 상태에서는 row 가 선택 단위가 된다.
    expect(intent(["listbox-row"], "listbox-row", "listbox")).toBe(true);
    expect(intent(["listbox-row"], "form-input", "listbox")).toBe(false);
  });
});

describe("resolveMultiDragTargets (ADR-178 §3.1 정규화)", () => {
  const node = (
    id: string,
    parentId: string | null,
    type = "Card",
  ): CanvasInteractionNode =>
    ({ id, type, parent_id: parentId, props: {} }) as CanvasInteractionNode;

  const makeMap = (nodes: CanvasInteractionNode[]) =>
    new Map(nodes.map((n) => [n.id, n]));

  it("excludes body from element drag targets (다중 body 혼합 엣지 폐쇄)", () => {
    const elementsMap = makeMap([
      node("body-1", null, "body"),
      node("card-1", "body-1"),
    ]);

    expect(
      resolveMultiDragTargets({
        elementsMap,
        selectedIds: ["body-1", "card-1"],
      }),
    ).toEqual(["card-1"]);
  });

  it("returns empty when only body is selected (단일 body 가드와 동일 결과)", () => {
    const elementsMap = makeMap([node("body-1", null, "body")]);

    expect(
      resolveMultiDragTargets({ elementsMap, selectedIds: ["body-1"] }),
    ).toEqual([]);
  });

  it("drops descendants when an ancestor is also selected (이중 이동 방지)", () => {
    const elementsMap = makeMap([
      node("body-1", null, "body"),
      node("parent", "body-1"),
      node("child", "parent"),
      node("grandchild", "child"),
      node("sibling", "body-1"),
    ]);

    expect(
      resolveMultiDragTargets({
        elementsMap,
        selectedIds: ["parent", "grandchild", "sibling"],
      }),
    ).toEqual(["parent", "sibling"]);
  });

  it("preserves selection order — 첫 요소가 드래그 리더", () => {
    const elementsMap = makeMap([
      node("body-1", null, "body"),
      node("a", "body-1"),
      node("b", "body-1"),
    ]);

    expect(
      resolveMultiDragTargets({ elementsMap, selectedIds: ["b", "a"] }),
    ).toEqual(["b", "a"]);
  });

  it("skips deleted or missing elements", () => {
    const deleted = {
      ...node("gone", "body-1"),
      deleted: true,
    } as CanvasInteractionNode;
    const elementsMap = makeMap([node("body-1", null, "body"), deleted]);

    expect(
      resolveMultiDragTargets({
        elementsMap,
        selectedIds: ["gone", "missing"],
      }),
    ).toEqual([]);
  });
});

describe("isContainerWithinDragTargets (ADR-178 R2 — 자기 안으로 드롭 금지)", () => {
  const node = (
    id: string,
    parentId: string | null,
    type = "Card",
  ): CanvasInteractionNode =>
    ({ id, type, parent_id: parentId, props: {} }) as CanvasInteractionNode;

  const elementsMap = new Map(
    [
      node("body-1", null, "body"),
      node("card", "body-1"),
      node("card-inner", "card"),
      node("other", "body-1"),
    ].map((n) => [n.id, n]),
  );

  it("rejects the drag target itself as a container", () => {
    expect(
      isContainerWithinDragTargets({
        containerId: "card",
        elementsMap,
        targetIds: new Set(["card"]),
      }),
    ).toBe(true);
  });

  it("rejects descendants of a drag target", () => {
    expect(
      isContainerWithinDragTargets({
        containerId: "card-inner",
        elementsMap,
        targetIds: new Set(["card"]),
      }),
    ).toBe(true);
  });

  it("allows unrelated containers", () => {
    expect(
      isContainerWithinDragTargets({
        containerId: "other",
        elementsMap,
        targetIds: new Set(["card"]),
      }),
    ).toBe(false);
  });
});
