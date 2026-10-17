// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import {
  buildRenderCommandStream,
  buildSelfCommandStream,
  buildSubtreeCommandStream,
  createCommandReader,
  type RenderCommandStream,
} from "./renderCommands";

/**
 * ADR-267 1-c — a stuck sticky header's place is one place: its paint, its bounds and hit area
 * (selection · hover · click), and its children's context (a label inside it), in the full, the
 * subtree and the self-only rebuild alike (리뷰 Round 1 H2 — the paint alone moved and the bounds
 * stayed at the static y = −100).
 *
 * list (scroll owner, clips, scrollTop 100) > section (h400) > header (h20, `top: 0`) > label.
 */
const node = (id: string, parent: string | null): CanvasSceneNode =>
  ({
    id,
    type: "Box",
    page_id: "page",
    parent_id: parent,
    order_num: 0,
    props: {},
    deleted: false,
  }) as unknown as CanvasSceneNode;
const register = (id: string, data: Record<string, unknown>) =>
  registerSkiaNode(id, {
    elementId: id,
    type: "container",
    visible: true,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...data,
  } as never);

const list = node("list", null);
const section = node("section", "list");
const header = node("header", "section");
const label = node("label", "header");
const children = new Map<string, CanvasSceneNode[]>([
  ["list", [section]],
  ["section", [header]],
  ["header", [label]],
  ["label", []],
]);
const layouts = new Map<string, ComputedLayout>([
  ["list", { x: 0, y: 0, width: 300, height: 200 } as ComputedLayout],
  ["section", { x: 0, y: 0, width: 300, height: 400 } as ComputedLayout],
  ["header", { x: 0, y: 0, width: 300, height: 20 } as ComputedLayout],
  ["label", { x: 16, y: 4, width: 100, height: 12 } as ComputedLayout],
]);

function setup(scrollTop: number) {
  register("list", {
    width: 300,
    height: 200,
    clipChildren: true,
    ...(scrollTop ? { scrollOffset: { scrollTop, scrollLeft: 0 } } : {}),
  });
  register("section", { width: 300, height: 400 });
  register("header", {
    width: 300,
    height: 20,
    sticky: {
      owner: "list",
      constrainingRect: { x: 0, y: 0, width: 300, height: 200 },
      stickyRect: { x: 0, y: 0, width: 300, height: 20 },
      containingBlockRect: { x: 0, y: 0, width: 300, height: 400 },
      top: 0,
      right: null,
      bottom: null,
      left: null,
    },
  });
  register("label", { width: 100, height: 12 });
}

const build = () =>
  buildRenderCommandStream(["list"], children, layouts, {
    list: { x: 0, y: 0 },
  });

/** `renderCommands.ts` `CMD_ELEMENT_BEGIN` (module-local, as in `subtreeTranslate.ts`). */
const CMD_ELEMENT_BEGIN = 0;
const beginOf = (stream: RenderCommandStream, id: string) => {
  const read = createCommandReader(stream.commands);
  const span = stream.subtreeSpans.get(id)!;
  const command = read(span.start)!;
  expect(command.type).toBe(CMD_ELEMENT_BEGIN);
  return command as { x: number; y: number };
};

describe("ADR-267 — sticky header coordinates", () => {
  afterEach(() => clearSkiaRegistry());

  it("scrollTop 100: paint, bounds and hit at the scrollport top; the label moves with it", () => {
    setup(100);
    const stream = build();
    // Painted 100 into the section, which the list's scroll moved up 100.
    expect(beginOf(stream, "header").y).toBe(100);
    expect(stream.boundsMap.get("section")?.y).toBe(-100);
    expect(stream.boundsMap.get("header")).toEqual({
      x: 0,
      y: 0,
      width: 300,
      height: 20,
    });
    expect(stream.hitBoundsMap.get("header")?.y).toBe(0);
    expect(stream.boundsMap.get("label")?.y).toBe(4);
    expect(stream.hitBoundsMap.get("label")?.y).toBe(4);
    // The label's context is the moved header's.
    expect(stream.subtreeBuildContextByElement.get("label")?.parentAbsY).toBe(
      0,
    );
  });

  it("scroll 0: the header stays where the layout put it", () => {
    setup(0);
    const stream = build();
    expect(beginOf(stream, "header").y).toBe(0);
    expect(stream.boundsMap.get("header")?.y).toBe(0);
  });

  it("the subtree and the self-only rebuilds store and use the same moved place", () => {
    setup(100);
    const full = build();
    const revision = { presentationRevision: 1, baseCanonicalRevision: 0 };
    const subtree = buildSubtreeCommandStream({
      rootId: "section",
      childrenMap: children,
      layoutMap: layouts,
      context: full.subtreeBuildContextByElement.get("section")!,
      revision,
    });
    expect(subtree.boundsMap.get("header")).toEqual(
      full.boundsMap.get("header"),
    );
    expect(subtree.boundsMap.get("label")).toEqual(full.boundsMap.get("label"));
    const self = buildSelfCommandStream({
      rootId: "header",
      childrenMap: children,
      layoutMap: layouts,
      context: full.subtreeBuildContextByElement.get("header")!,
      revision,
    });
    expect(self.stream.boundsMap.get("header")).toEqual(
      full.boundsMap.get("header"),
    );
    expect(self.childContexts.get("label")).toEqual(
      full.subtreeBuildContextByElement.get("label"),
    );
  });
});
