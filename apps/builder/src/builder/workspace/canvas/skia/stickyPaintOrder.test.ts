// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { buildRenderCommandStream } from "./renderCommands";

/**
 * ADR-275 Phase 6 — a sticky box with no z-index paints in its stacking context's positioned layer
 * (CSS 2 Appendix E step 8): after its in-flow siblings wherever it is in the tree, and under a
 * positive z-index.
 */
const element = (id: string, parent: string | null): CanvasSceneNode =>
  ({
    id,
    type: "Box",
    page_id: "page-1",
    parent_id: parent,
    order_num: 0,
    props: {},
    deleted: false,
  }) as unknown as CanvasSceneNode;

const STICKY = {
  owner: "body",
  constrainingRect: { x: 0, y: 0, width: 400, height: 300 },
  stickyRect: { x: 0, y: 0, width: 400, height: 20 },
  containingBlockRect: { x: 0, y: 0, width: 400, height: 300 },
  top: 0,
  right: null,
  bottom: null,
  left: null,
};

function paintOrder(
  nodes: Record<string, Record<string, unknown>>,
): readonly string[] {
  registerSkiaNode("body", {
    elementId: "body",
    type: "container",
    visible: true,
    x: 0,
    y: 0,
    width: 400,
    height: 300,
  } as never);
  const children = Object.keys(nodes).map((id) => element(id, "body"));
  for (const [id, extra] of Object.entries(nodes))
    registerSkiaNode(id, {
      elementId: id,
      type: "container",
      visible: true,
      x: 0,
      y: 0,
      width: 400,
      height: 20,
      ...extra,
    } as never);
  const stream = buildRenderCommandStream(
    ["body"],
    new Map([["body", children]]),
    new Map(
      Object.keys(nodes).map((id, i) => [
        id,
        { x: 0, y: i * 20, width: 400, height: 20 } as ComputedLayout,
      ]),
    ),
    { body: { x: 0, y: 0 } },
    { presentationRevision: 0, baseCanonicalRevision: 0 },
  );
  return stream.childElementIds.get("body") ?? [];
}

describe("ADR-275 Phase 6 — sticky paint order", () => {
  afterEach(() => clearSkiaRegistry());

  it("a sticky box without z-index paints after its in-flow siblings", () => {
    expect(paintOrder({ header: { sticky: STICKY }, a: {}, b: {} })).toEqual([
      "a",
      "b",
      "header",
    ]);
  });

  it("tree order without sticky; a positive z-index stays over the sticky box", () => {
    expect(paintOrder({ header: {}, a: {}, b: {} })).toEqual([
      "header",
      "a",
      "b",
    ]);
    expect(
      paintOrder({ header: { sticky: STICKY }, a: { zIndex: 1 }, b: {} }),
    ).toEqual(["b", "header", "a"]);
  });
});
