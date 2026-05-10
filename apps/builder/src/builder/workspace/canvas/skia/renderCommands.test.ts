import { afterEach, describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { setDragVisualOffset } from "./nodeRendererTree";
import { buildRenderCommandStream } from "./renderCommands";
import type { SkiaNodeData } from "./nodeRenderers";

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
      new Map([[source.id, { x: 24, y: 32, width: 160, height: 120 }]]),
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
