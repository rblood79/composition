// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNode";
import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";
import {
  getCachedCommandStream,
  getCachedCommandStreamSnapshot,
  invalidateCommandStreamCache,
} from "../workspace/canvas/skia/renderCommands";
import {
  clearSkiaRegistry,
  registerSkiaNode,
} from "../workspace/canvas/skia/useSkiaNode";
import type { SkiaNodeData } from "../workspace/canvas/skia/nodeRendererTypes";
import { StoreRenderBridge } from "../workspace/canvas/skia/StoreRenderBridge";

function makeSceneNode(
  id: string,
  parentId: string | null,
  type: string,
): CanvasSceneNode {
  const sourceNode = { id, type, props: { style: { position: "absolute" } } };
  return {
    id,
    type,
    page_id: "page-1",
    parent_id: parentId,
    parentId,
    pageId: "page-1",
    props: sourceNode.props,
    sourceNode,
  } as unknown as CanvasSceneNode;
}

function makeTextNode(): SkiaNodeData {
  const text = {
    color: Float32Array.of(0, 0, 0, 1),
    content: "Parity",
    fontFamilies: ["Inter"],
    fontSize: 16,
    fontWeight: 400,
    maxWidth: 120,
    paddingLeft: 0,
    paddingTop: 0,
  };
  return {
    elementId: "text-1",
    height: 40,
    presentationTextMetricTargets: [{ text }],
    text,
    type: "text",
    visible: true,
    width: 120,
    x: 10,
    y: 20,
  };
}

afterEach(() => {
  invalidateCommandStreamCache();
  clearSkiaRegistry();
});

describe("fixed Text Preview/Skia rect-hit parity", () => {
  it("keeps the atomic Skia hitBounds slot while paragraph metrics update", () => {
    const body = makeSceneNode("body-1", null, "body");
    const text = makeSceneNode("text-1", body.id, "Text");
    registerSkiaNode(body.id, {
      elementId: body.id,
      height: 200,
      type: "container",
      visible: true,
      width: 300,
      x: 0,
      y: 0,
    });
    registerSkiaNode(text.id, makeTextNode());
    const childrenMap = new Map<string, CanvasSceneNode[]>([[body.id, [text]]]);
    const layoutMap = new Map<string, ComputedLayout>([
      [
        body.id,
        {
          elementId: body.id,
          x: 0,
          y: 0,
          width: 300,
          height: 200,
        } as ComputedLayout,
      ],
      [
        text.id,
        {
          elementId: text.id,
          x: 10,
          y: 20,
          width: 120,
          height: 40,
        } as ComputedLayout,
      ],
    ]);
    getCachedCommandStream(
      [body.id],
      childrenMap,
      layoutMap,
      { [body.id]: { x: 0, y: 0 } },
      1,
      1,
      1,
      1,
    );
    const before = getCachedCommandStreamSnapshot()!.hitBoundsMap.get(text.id);
    expect(before).toMatchObject({ x: 10, y: 20, width: 120, height: 40 });

    const bridge = new StoreRenderBridge();
    expect(bridge.applyPresentationStylePatch(text.id, { fontSize: 18 })).toBe(
      true,
    );
    expect(
      bridge.applyPresentationStylePatch(text.id, { fontWeight: 700 }),
    ).toBe(true);

    const after = getCachedCommandStreamSnapshot()!.hitBoundsMap.get(text.id);
    expect(after).toEqual(before);
    expect(getCachedCommandStreamSnapshot()!.boundsMap.get(text.id)).toEqual(
      before,
    );
  });
});
