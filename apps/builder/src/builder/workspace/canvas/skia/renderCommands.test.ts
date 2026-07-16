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
