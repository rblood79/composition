import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { withFrameElementMirrorId } from "@/adapters/canonical/frameMirror";
import type { Element } from "../../../../types/core/store.types";
import type { BoundingBox } from "../selection/types";
import {
  clearElementHoverState,
  resolveFrameBodyHoverTarget,
  resolveHoverGroupState,
  resolvePageBodyHoverTarget,
  type ElementHoverState,
} from "./useElementHoverInteraction";
import type { CanvasInteractionNode } from "../interaction/interactionNode";

type BodyFixtureOptions = Partial<Element> & {
  frameId?: string | null;
};

function makeBody({
  frameId = "frame-1",
  ...overrides
}: BodyFixtureOptions): Element {
  return withFrameElementMirrorId(
    {
      id: "frame-body",
      type: "body",
      page_id: null,
      parent_id: null,
      order_num: 0,
      props: {},
      ...overrides,
    } as Element,
    frameId,
  );
}

function makePageBody(overrides: Partial<Element>): Element {
  return {
    id: "frame-body",
    type: "body",
    page_id: null,
    parent_id: null,
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

function makeBounds(overrides: Partial<BoundingBox> = {}): BoundingBox {
  return {
    x: 0,
    y: 0,
    width: 320,
    height: 200,
    ...overrides,
  };
}

describe("resolveFrameBodyHoverTarget", () => {
  it("returns the frame body when the pointer is inside a rendered frame area", () => {
    const result = resolveFrameBodyHoverTarget({
      boundsMap: new Map([["frame-body", makeBounds()]]),
      elementsMap: new Map([["frame-body", makeBody({})]]),
      frameAreas: [{ frameId: "frame-1", x: 0, y: 0, width: 320, height: 200 }],
      sceneX: 40,
      sceneY: 40,
    });

    expect(result).toBe("frame-body");
  });

  it("uses the topmost matching frame area when areas overlap", () => {
    const result = resolveFrameBodyHoverTarget({
      boundsMap: new Map([
        ["frame-body-1", makeBounds()],
        ["frame-body-2", makeBounds({ x: 20, y: 20 })],
      ]),
      elementsMap: new Map([
        ["frame-body-1", makeBody({ id: "frame-body-1", frameId: "frame-1" })],
        ["frame-body-2", makeBody({ id: "frame-body-2", frameId: "frame-2" })],
      ]),
      frameAreas: [
        { frameId: "frame-1", x: 0, y: 0, width: 320, height: 200 },
        { frameId: "frame-2", x: 20, y: 20, width: 320, height: 200 },
      ],
      sceneX: 40,
      sceneY: 40,
    });

    expect(result).toBe("frame-body-2");
  });

  it("ignores page bodies, deleted bodies, and non-rendered bodies", () => {
    const result = resolveFrameBodyHoverTarget({
      boundsMap: new Map([["deleted-body", makeBounds()]]),
      elementsMap: new Map([
        ["page-body", makePageBody({ id: "page-body", page_id: "page-1" })],
        ["deleted-body", makeBody({ id: "deleted-body", deleted: true })],
        ["unrendered-body", makeBody({ id: "unrendered-body" })],
      ]),
      frameAreas: [{ frameId: "frame-1", x: 0, y: 0, width: 320, height: 200 }],
      sceneX: 40,
      sceneY: 40,
    });

    expect(result).toBeNull();
  });

  it("returns null outside every frame area", () => {
    const result = resolveFrameBodyHoverTarget({
      boundsMap: new Map([["frame-body", makeBounds()]]),
      elementsMap: new Map([["frame-body", makeBody({})]]),
      frameAreas: [{ frameId: "frame-1", x: 0, y: 0, width: 320, height: 200 }],
      sceneX: 400,
      sceneY: 40,
    });

    expect(result).toBeNull();
  });
});

describe("resolvePageBodyHoverTarget", () => {
  it("returns the page body when the pointer is inside a visible page frame", () => {
    const result = resolvePageBodyHoverTarget({
      elementsMap: new Map([
        ["page-body", makePageBody({ id: "page-body", page_id: "page-1" })],
      ]),
      pageFrames: [{ id: "page-1", x: 10, y: 20, width: 320, height: 200 }],
      sceneX: 40,
      sceneY: 40,
    });

    expect(result).toBe("page-body");
  });

  it("uses the topmost matching page frame when page frames overlap", () => {
    const result = resolvePageBodyHoverTarget({
      elementsMap: new Map([
        ["page-body-1", makePageBody({ id: "page-body-1", page_id: "page-1" })],
        ["page-body-2", makePageBody({ id: "page-body-2", page_id: "page-2" })],
      ]),
      pageFrames: [
        { id: "page-1", x: 0, y: 0, width: 320, height: 200 },
        { id: "page-2", x: 20, y: 20, width: 320, height: 200 },
      ],
      sceneX: 40,
      sceneY: 40,
    });

    expect(result).toBe("page-body-2");
  });

  it("ignores deleted page bodies and non-body elements", () => {
    const result = resolvePageBodyHoverTarget({
      elementsMap: new Map([
        [
          "deleted-body",
          makePageBody({
            id: "deleted-body",
            deleted: true,
            page_id: "page-1",
          }),
        ],
        [
          "button",
          makePageBody({ id: "button", type: "Button", page_id: "page-1" }),
        ],
      ]),
      pageFrames: [{ id: "page-1", x: 0, y: 0, width: 320, height: 200 }],
      sceneX: 40,
      sceneY: 40,
    });

    expect(result).toBeNull();
  });

  it("returns null outside every visible page frame", () => {
    const result = resolvePageBodyHoverTarget({
      elementsMap: new Map([
        ["page-body", makePageBody({ id: "page-body", page_id: "page-1" })],
      ]),
      pageFrames: [{ id: "page-1", x: 0, y: 0, width: 320, height: 200 }],
      sceneX: 400,
      sceneY: 40,
    });

    expect(result).toBeNull();
  });
});

describe("resolveHoverGroupState", () => {
  function node(
    id: string,
    type: string,
    parentId: string | null,
  ): CanvasInteractionNode {
    return {
      id,
      type,
      parent_id: parentId,
      page_id: "page-1",
      order_num: 0,
      props: {},
    } as unknown as CanvasInteractionNode;
  }

  /** body > listbox > (row-1, row-2) — 페이지 전체가 리프 2개 */
  const elementsMap = new Map<string, CanvasInteractionNode>([
    ["page-body", node("page-body", "body", null)],
    ["listbox", node("listbox", "ListBox", "page-body")],
    ["row-1", node("row-1", "ListBoxItem", "listbox")],
    ["row-2", node("row-2", "ListBoxItem", "listbox")],
  ]);
  const childrenMap = new Map<string, ReadonlyArray<{ id: string }>>([
    ["page-body", [{ id: "listbox" }]],
    ["listbox", [{ id: "row-1" }, { id: "row-2" }]],
  ]);
  const boundsMap = new Map<string, BoundingBox>([
    ["page-body", makeBounds()],
    ["listbox", makeBounds()],
    ["row-1", makeBounds()],
    ["row-2", makeBounds()],
  ]);

  it("expands a container hover into its leaf descendants", () => {
    expect(
      resolveHoverGroupState({
        contextHitId: "listbox",
        childrenMap,
        boundsMap,
        elementsMap,
      }),
    ).toEqual({ hoveredLeafIds: ["row-1", "row-2"], isGroupHover: true });
  });

  it("does not expand a body hover into page-wide child guidelines", () => {
    // 빈 영역 fallback 으로만 body 가 context 가 된다 — 여기서 리프를 펼치면
    // 요소 없는 빈 공간 호버에 페이지 전체 점선 가이드라인이 그려진다.
    expect(
      resolveHoverGroupState({
        contextHitId: "page-body",
        childrenMap,
        boundsMap,
        elementsMap,
      }),
    ).toEqual({ hoveredLeafIds: [], isGroupHover: false });
  });

  it("treats a leaf hover as a non-group hover", () => {
    expect(
      resolveHoverGroupState({
        contextHitId: "row-1",
        childrenMap,
        boundsMap,
        elementsMap,
      }),
    ).toEqual({ hoveredLeafIds: ["row-1"], isGroupHover: false });
  });

  it("returns a cleared state without a hover context or bounds", () => {
    const cleared = { hoveredLeafIds: [], isGroupHover: false };

    expect(
      resolveHoverGroupState({
        contextHitId: null,
        childrenMap,
        boundsMap,
        elementsMap,
      }),
    ).toEqual(cleared);
    expect(
      resolveHoverGroupState({
        contextHitId: "listbox",
        childrenMap,
        boundsMap: null,
        elementsMap,
      }),
    ).toEqual(cleared);
  });
});

describe("clearElementHoverState", () => {
  it("clears stale hover state during drag/drop feedback", () => {
    const state: ElementHoverState = {
      hoveredElementId: "card",
      hoveredLeafIds: ["heading", "button"],
      isGroupHover: true,
    };

    expect(clearElementHoverState(state)).toBe(true);
    expect(state).toEqual({
      hoveredElementId: null,
      hoveredLeafIds: [],
      isGroupHover: false,
    });
  });

  it("does not request an overlay invalidation when already clear", () => {
    const state: ElementHoverState = {
      hoveredElementId: null,
      hoveredLeafIds: [],
      isGroupHover: false,
    };

    expect(clearElementHoverState(state)).toBe(false);
  });
});

describe("useElementHoverInteraction canonical map contract", () => {
  it("requires supplied hover maps instead of falling back to store maps", async () => {
    const source = await readFile(
      resolve(__dirname, "useElementHoverInteraction.ts"),
      "utf-8",
    );

    expect(source).toContain("getHoverElementsMap: () =>");
    expect(source).toContain("getHoverChildrenMap: () =>");
    expect(source).toContain("const childrenMap = getHoverChildrenMap();");
    expect(source).toContain("const elementsMap = getHoverElementsMap();");
    const staleElementsMapRead = ["state", "elementsMap"].join(".");
    const staleChildrenMapRead = ["state", "childrenMap"].join(".");

    expect(source).not.toContain("getHoverElementsMap?.()");
    expect(source).not.toContain("getHoverChildrenMap?.()");
    expect(source).not.toContain(staleElementsMapRead);
    expect(source).not.toContain(staleChildrenMapRead);
    expect(source).not.toContain(
      "const { editingContextId, childrenMap, elementsMap } = state;",
    );
  });
});
