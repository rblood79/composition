import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { withFrameElementMirrorId } from "@/adapters/canonical/frameMirror";
import type { Element } from "../../../../types/core/store.types";
import type { BoundingBox } from "../selection/types";
import {
  clearElementHoverState,
  resolveFrameBodyHoverTarget,
  resolvePageBodyHoverTarget,
  type ElementHoverState,
} from "./useElementHoverInteraction";

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
