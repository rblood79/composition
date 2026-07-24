import { afterEach, describe, expect, it } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { setDragVisualOffset } from "./nodeRendererTree";
import {
  buildRenderCommandStream,
  executeRenderCommands,
} from "./renderCommands";
import type { SkiaNodeData } from "./nodeRenderers";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Box",
    page_id: "page-1",
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    ...overrides,
  } as CanvasSceneNode;
}

function registerNode(id: string, overrides: Partial<SkiaNodeData> = {}): void {
  registerSkiaNode(id, {
    elementId: id,
    height: 100,
    type: "container",
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    ...overrides,
  } as SkiaNodeData);
}

function elementCommandIds(commands: unknown[]): string[] {
  return commands
    .map((command) =>
      typeof command === "object" && command !== null
        ? (command as { elementId?: unknown }).elementId
        : undefined,
    )
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

describe("buildRenderCommandStream drag top layer", () => {
  afterEach(() => {
    setDragVisualOffset(null, 0, 0, true);
    clearSkiaRegistry();
  });

  it("renders the dragged subtree after all page roots", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
    });
    const source = makeElement("source-card", {
      parent_id: page1Body.id,
      page_id: "page-1",
    });

    registerNode(page1Body.id);
    registerNode(page2Body.id);
    registerNode(source.id);
    setDragVisualOffset(source.id, 900, 0, true);

    const stream = buildRenderCommandStream(
      [page1Body.id, page2Body.id],
      new Map([[page1Body.id, [source]]]),
      new Map([
        [
          source.id,
          { x: 24, y: 32, width: 160, height: 120 } as ComputedLayout,
        ],
      ]),
      {
        [page1Body.id]: { x: 0, y: 0 },
        [page2Body.id]: { x: 900, y: 0 },
      },
    );

    expect(elementCommandIds(stream.commands)).toEqual([
      page1Body.id,
      page2Body.id,
      source.id,
    ]);
  });
});

describe("executeRenderCommands scroll-aware culling", () => {
  afterEach(() => {
    clearSkiaRegistry();
  });

  const stubCk = {
    LTRBRect: () => ({}),
    ClipOp: { Intersect: 0 },
  } as unknown as CanvasKit;

  function makeRecordingCanvas() {
    const translates: Array<[number, number]> = [];
    const canvas = {
      save() {},
      restore() {},
      saveLayer() {},
      concat() {},
      clipRect() {},
      clipPath() {},
      translate(x: number, y: number) {
        translates.push([x, y]);
      },
    } as unknown as Canvas;
    return { canvas, translates };
  }

  function buildScrolledPageStream(childY: number) {
    const body = makeElement("scroll-body", { type: "body" });
    const child = makeElement("below-fold-child", { parent_id: body.id });

    registerNode(body.id, {
      width: 800,
      height: 600,
      clipChildren: true,
      scrollOffset: { scrollTop: 1000, scrollLeft: 0 },
    });
    registerNode(child.id, { width: 100, height: 100 });

    return buildRenderCommandStream(
      [body.id],
      new Map([[body.id, [child]]]),
      new Map([
        [
          child.id,
          { x: 0, y: childY, width: 100, height: 100 } as ComputedLayout,
        ],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );
  }

  const viewport = { x: 0, y: 0, width: 800, height: 600 } as DOMRect;

  it("renders a child scrolled into the viewport", () => {
    // 스크롤 전 y=1400 (뷰포트 밖) → scrollTop=1000 반영 시 400 (뷰포트 안)
    const stream = buildScrolledPageStream(1400);
    const { canvas, translates } = makeRecordingCanvas();

    executeRenderCommands(stubCk, canvas, stream.commands, viewport);

    expect(translates).toContainEqual([0, 1400]);
  });

  it("still culls a child that remains outside the viewport after scroll", () => {
    // y=2400 → scrollTop=1000 반영해도 1400 (뷰포트 밖) → 컬링 유지
    const stream = buildScrolledPageStream(2400);
    const { canvas, translates } = makeRecordingCanvas();

    executeRenderCommands(stubCk, canvas, stream.commands, viewport);

    expect(translates).not.toContainEqual([0, 2400]);
  });
});

describe("buildRenderCommandStream clip-aware hit bounds", () => {
  afterEach(() => {
    setDragVisualOffset(null, 0, 0, true);
    clearSkiaRegistry();
  });

  /**
   * ListBox maxHeight:300 + 내용 350 형태의 최소 재현.
   * owner 는 clipChildren(overflow auto/hidden) 로 300 만 그리므로,
   * 300~350 구간은 화면에 없다 → 히트 대상이 되면 안 된다.
   */
  function buildClippedOwnerStream(): ReturnType<
    typeof buildRenderCommandStream
  > {
    const body = makeElement("clip-body", { type: "body" });
    const owner = makeElement("clip-owner", { parent_id: body.id });
    const rows = makeElement("clip-rows", { parent_id: owner.id });
    const belowFold = makeElement("clip-below-fold", { parent_id: owner.id });

    registerNode(body.id, { width: 390, height: 844 });
    registerNode(owner.id, { width: 390, height: 300, clipChildren: true });
    registerNode(rows.id, { width: 390, height: 350 });
    registerNode(belowFold.id, { width: 390, height: 40 });

    return buildRenderCommandStream(
      [body.id],
      new Map([
        [body.id, [owner]],
        [owner.id, [rows, belowFold]],
      ]),
      new Map<string, ComputedLayout>([
        [owner.id, { x: 0, y: 100, width: 390, height: 300 } as ComputedLayout],
        [rows.id, { x: 0, y: 0, width: 390, height: 350 } as ComputedLayout],
        [
          belowFold.id,
          { x: 0, y: 350, width: 390, height: 40 } as ComputedLayout,
        ],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );
  }

  it("keeps boundsMap unclipped (오버레이/측정 기하는 요소 원본 박스 유지)", () => {
    const stream = buildClippedOwnerStream();

    expect(stream.boundsMap.get("clip-rows")).toEqual({
      x: 0,
      y: 100,
      width: 390,
      height: 350,
    });
  });

  it("clips hit bounds to the nearest clipping ancestor", () => {
    const stream = buildClippedOwnerStream();

    // owner 는 y 100~400 만 그린다 → 자식 히트 영역도 400 에서 잘린다.
    expect(stream.hitBoundsMap.get("clip-rows")).toEqual({
      x: 0,
      y: 100,
      width: 390,
      height: 300,
    });
  });

  it("drops fully clipped descendants from hit bounds", () => {
    const stream = buildClippedOwnerStream();

    // y 450~490 은 clip rect(100~400) 와 교차 0 → 히트 대상 제외
    expect(stream.boundsMap.has("clip-below-fold")).toBe(true);
    expect(stream.hitBoundsMap.has("clip-below-fold")).toBe(false);
  });

  it("leaves the clipping owner itself unclipped", () => {
    const stream = buildClippedOwnerStream();

    // clipChildren 은 자식에만 적용 — owner 자신의 박스는 그대로 히트 가능
    expect(stream.hitBoundsMap.get("clip-owner")).toEqual({
      x: 0,
      y: 100,
      width: 390,
      height: 300,
    });
  });

  it("clips hit bounds under a scrolled clipping ancestor", () => {
    const body = makeElement("scroll-clip-body", { type: "body" });
    const child = makeElement("scroll-clip-child", { parent_id: body.id });

    registerNode(body.id, {
      width: 800,
      height: 600,
      clipChildren: true,
      scrollOffset: { scrollTop: 500, scrollLeft: 0 },
    });
    registerNode(child.id, { width: 100, height: 200 });

    const stream = buildRenderCommandStream(
      [body.id],
      new Map([[body.id, [child]]]),
      new Map([
        [child.id, { x: 0, y: 400, width: 100, height: 200 } as ComputedLayout],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );

    // 스크롤 반영 절대 y = 400 - 500 = -100 → clip rect(0~600) 과 교차 0~100
    expect(stream.boundsMap.get(child.id)).toEqual({
      x: 0,
      y: -100,
      width: 100,
      height: 200,
    });
    expect(stream.hitBoundsMap.get(child.id)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  it("exempts the drag top-layer subtree from ancestor clipping", () => {
    const body = makeElement("drag-clip-body", { type: "body" });
    const owner = makeElement("drag-clip-owner", { parent_id: body.id });
    const dragged = makeElement("drag-clip-child", { parent_id: owner.id });

    registerNode(body.id, { width: 390, height: 844 });
    registerNode(owner.id, { width: 390, height: 100, clipChildren: true });
    registerNode(dragged.id, { width: 100, height: 100 });
    setDragVisualOffset(dragged.id, 0, 0, true);

    const stream = buildRenderCommandStream(
      [body.id],
      new Map([
        [body.id, [owner]],
        [owner.id, [dragged]],
      ]),
      new Map<string, ComputedLayout>([
        [owner.id, { x: 0, y: 0, width: 390, height: 100 } as ComputedLayout],
        [
          dragged.id,
          { x: 0, y: 200, width: 100, height: 100 } as ComputedLayout,
        ],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );

    // top-layer 재방문은 clip save/restore 밖에서 그려진다 → 히트 영역도 클립 미적용
    expect(stream.hitBoundsMap.get(dragged.id)).toEqual({
      x: 0,
      y: 200,
      width: 100,
      height: 100,
    });
  });
});
