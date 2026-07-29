import { describe, expect, it } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import {
  isManualPositionDragTarget,
  resolveDragReadModel,
  resolveManualPositionDragProps,
  resolveManualPositionDropProps,
  resolveManualPositionDropTarget,
} from "./useDragBridge";
import type { BoundingBox } from "../selection/types";
import type { DropTarget } from "../selection/dropTargetResolver";

type LegacyOverrides = Partial<Element> & {
  order_num?: number;
  reusable?: boolean;
  ref?: string;
  componentName?: string;
  componentRole?: string;
  layout_id?: string | null;
  layoutId?: string | null;
  slot_name?: string | null;
  placeholder?: boolean;
  schemaVersion?: string;
};

function makeElement(overrides: LegacyOverrides): Element {
  return {
    id: "element",
    type: "Box",
    page_id: "page-1",
    parent_id: "body",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("manual position drag semantics", () => {
  it("treats absolute-position elements as manual drag targets", () => {
    expect(
      isManualPositionDragTarget(
        makeElement({ props: { style: { position: "absolute" } } }),
      ),
    ).toBe(true);
    expect(
      isManualPositionDragTarget(
        makeElement({ props: { style: { position: "relative" } } }),
      ),
    ).toBe(false);
  });

  it("commits drag delta to left/top while preserving style", () => {
    const props = resolveManualPositionDragProps(
      makeElement({
        props: {
          style: {
            color: "red",
            left: "10px",
            position: "absolute",
            top: "20px",
          },
        },
      }),
      { x: 12.5, y: -4 },
    );

    expect(props).toEqual({
      style: {
        color: "red",
        left: "22.5px",
        position: "absolute",
        top: "16px",
      },
    });
  });

  it("falls back to scene bounds when left/top are not px values", () => {
    const bounds = new Map<string, BoundingBox>([
      ["body", { x: 100, y: 50, width: 300, height: 200 }],
      ["element", { x: 130, y: 90, width: 40, height: 20 }],
    ]);
    const props = resolveManualPositionDragProps(
      makeElement({
        props: {
          style: {
            left: "auto",
            position: "absolute",
            top: "calc(10px + 2px)",
          },
        },
      }),
      { x: 5, y: 6 },
      (id) => bounds.get(id),
    );

    expect(props).toEqual({
      style: {
        left: "35px",
        position: "absolute",
        top: "46px",
      },
    });
  });

  it("recomputes left/top from the destination container when reparenting", () => {
    const destinationBounds = {
      x: 100,
      y: 40,
      width: 800,
      height: 600,
    };
    const bounds = new Map<string, BoundingBox>([
      ["source-body", { x: 900, y: 50, width: 800, height: 600 }],
      ["element", { x: 930, y: 120, width: 40, height: 20 }],
    ]);
    const props = resolveManualPositionDragProps(
      makeElement({
        parent_id: "source-body",
        props: {
          style: {
            left: "30px",
            position: "absolute",
            top: "70px",
          },
        },
      }),
      { x: -500, y: 20 },
      (id) => bounds.get(id),
      destinationBounds,
    );

    expect(props).toEqual({
      style: {
        left: "330px",
        position: "absolute",
        top: "100px",
      },
    });
  });

  it("accepts only cross-page reparent targets for manual-position drops", () => {
    const dragged = makeElement({
      id: "element",
      page_id: "page-1",
      parent_id: "page-1-body",
      props: { style: { position: "absolute" } },
    });
    const page1Body = makeElement({
      id: "page-1-body",
      type: "body",
      page_id: "page-1",
      parent_id: null,
    });
    const page2Body = makeElement({
      id: "page-2-body",
      type: "body",
      page_id: "page-2",
      parent_id: null,
    });
    const model = {
      elementsById: new Map([
        [dragged.id, dragged],
        [page1Body.id, page1Body],
        [page2Body.id, page2Body],
      ]),
      childrenByParent: new Map(),
    };
    const baseTarget: DropTarget = {
      containerId: page2Body.id,
      insertionIndex: 2,
      isAdjacentInsertion: false,
      isHorizontal: false,
      containerBounds: { x: 100, y: 40, width: 800, height: 600 },
      siblingBounds: [],
      isReparent: true,
      originalParentId: page1Body.id,
    };

    expect(resolveManualPositionDropTarget(dragged, baseTarget, model)).toEqual(
      {
        ...baseTarget,
        insertionIndex: 0,
      },
    );
    expect(
      resolveManualPositionDropTarget(
        dragged,
        { ...baseTarget, containerId: page1Body.id },
        model,
      ),
    ).toBeNull();
    expect(
      resolveManualPositionDropTarget(
        dragged,
        { ...baseTarget, isReparent: false },
        model,
      ),
    ).toBeNull();
  });

  it.each(["Group", "Frame", "ButtonGroup"])(
    "accepts a same-page %s as a reparent target for an absolute element",
    (containerType) => {
      const dragged = makeElement({
        id: "element",
        page_id: "page-1",
        parent_id: "page-1-body",
        props: { style: { position: "absolute" } },
      });
      const pageBody = makeElement({
        id: "page-1-body",
        type: "body",
        page_id: "page-1",
        parent_id: null,
      });
      const container = makeElement({
        id: "target-container",
        type: containerType,
        page_id: "page-1",
        parent_id: pageBody.id,
      });
      const model = {
        elementsById: new Map([
          [dragged.id, dragged],
          [pageBody.id, pageBody],
          [container.id, container],
        ]),
        childrenByParent: new Map([[pageBody.id, [dragged, container]]]),
      };
      const target: DropTarget = {
        containerId: container.id,
        insertionIndex: 0,
        isAdjacentInsertion: false,
        isHorizontal: false,
        containerBounds: { x: 100, y: 40, width: 320, height: 240 },
        siblingBounds: [],
        isReparent: true,
        originalParentId: pageBody.id,
      };

      expect(resolveManualPositionDropTarget(dragged, target, model)).toEqual(
        target,
      );
    },
  );

  it.each(["Group", "Frame", "ButtonGroup"])(
    "releases absolute positioning when committing a drop into a %s",
    (containerType) => {
      const dragged = makeElement({
        id: "element",
        page_id: "page-1",
        parent_id: "page-1-body",
        props: {
          style: {
            color: "red",
            left: "24px",
            position: "absolute",
            top: "12px",
          },
        },
      });
      const container = makeElement({
        id: "target-container",
        type: containerType,
        page_id: "page-1",
        parent_id: "page-1-body",
      });
      const model = {
        elementsById: new Map([
          [dragged.id, dragged],
          [container.id, container],
        ]),
        childrenByParent: new Map<string, Element[]>(),
      };
      const target: DropTarget = {
        containerId: container.id,
        insertionIndex: 0,
        isAdjacentInsertion: false,
        isHorizontal: false,
        containerBounds: { x: 100, y: 40, width: 320, height: 240 },
        siblingBounds: [],
        isReparent: true,
        originalParentId: "page-1-body",
      };

      expect(
        resolveManualPositionDropProps(dragged, target, model, {
          x: 80,
          y: 60,
        }),
      ).toEqual({
        style: {
          color: "red",
          left: "24px",
          top: "12px",
        },
      });
    },
  );

  it("keeps absolute positioning when committing a cross-page Body drop", () => {
    const dragged = makeElement({
      id: "element",
      page_id: "page-1",
      parent_id: "page-1-body",
      props: {
        style: {
          left: "30px",
          position: "absolute",
          top: "70px",
        },
      },
    });
    const destinationBody = makeElement({
      id: "page-2-body",
      type: "body",
      page_id: "page-2",
      parent_id: null,
    });
    const model = {
      elementsById: new Map([
        [dragged.id, dragged],
        [destinationBody.id, destinationBody],
      ]),
      childrenByParent: new Map<string, Element[]>(),
    };
    const target: DropTarget = {
      containerId: destinationBody.id,
      insertionIndex: 0,
      isAdjacentInsertion: false,
      isHorizontal: false,
      containerBounds: { x: 100, y: 40, width: 800, height: 600 },
      siblingBounds: [],
      isReparent: true,
      originalParentId: "page-1-body",
    };
    const bounds = new Map<string, BoundingBox>([
      ["element", { x: 930, y: 120, width: 40, height: 20 }],
    ]);

    expect(
      resolveManualPositionDropProps(
        dragged,
        target,
        model,
        { x: -500, y: 20 },
        (id) => bounds.get(id),
      ),
    ).toEqual({
      style: {
        left: "330px",
        position: "absolute",
        top: "100px",
      },
    });
  });

  it("promotes a nested absolute element to the top of the same-page body on an empty-canvas drop", () => {
    const dragged = makeElement({
      id: "element",
      page_id: "page-1",
      parent_id: "group-1",
      props: { style: { position: "absolute" } },
    });
    const group = makeElement({
      id: "group-1",
      type: "Group",
      page_id: "page-1",
      parent_id: "page-1-body",
    });
    const pageBody = makeElement({
      id: "page-1-body",
      type: "body",
      page_id: "page-1",
      parent_id: null,
    });
    const model = {
      elementsById: new Map([
        [dragged.id, dragged],
        [group.id, group],
        [pageBody.id, pageBody],
      ]),
      childrenByParent: new Map([
        [pageBody.id, [group]],
        [group.id, [dragged]],
      ]),
    };
    const bodyTarget: DropTarget = {
      containerId: pageBody.id,
      insertionIndex: 1,
      isAdjacentInsertion: false,
      isHorizontal: false,
      containerBounds: { x: 100, y: 40, width: 800, height: 600 },
      siblingBounds: [{ x: 140, y: 80, width: 300, height: 200 }],
      isReparent: true,
      originalParentId: group.id,
    };

    expect(resolveManualPositionDropTarget(dragged, bodyTarget, model)).toEqual(
      {
        ...bodyTarget,
        insertionIndex: 0,
      },
    );

    expect(
      resolveManualPositionDropTarget(
        dragged,
        { ...bodyTarget, containerId: group.id },
        model,
      ),
    ).toBeNull();

    const bodyChild = makeElement({
      ...dragged,
      parent_id: pageBody.id,
    });
    expect(
      resolveManualPositionDropTarget(bodyChild, bodyTarget, model),
    ).toBeNull();
  });
});

describe("drag snapshot collection", () => {
  it("uses interactive canonical maps ahead of fallback store maps", () => {
    const fallbackElement = makeElement({
      id: "button",
      parent_id: "body",
      props: { label: "legacy" },
    });
    const canonicalElement = makeElement({
      id: "button",
      parent_id: "body",
      props: { label: "canonical" },
    });
    const fallback = {
      elementsById: new Map([[fallbackElement.id, fallbackElement]]),
      childrenByParent: new Map([["body", [fallbackElement]]]),
    };
    const interactive = {
      elementsById: new Map([[canonicalElement.id, canonicalElement]]),
      childrenByParent: new Map([["body", [canonicalElement]]]),
    };

    const resolved = resolveDragReadModel(fallback, {
      getInteractiveElementsMap: () => interactive.elementsById,
      getInteractiveChildrenMap: () => interactive.childrenByParent,
    });

    expect(resolved.elementsById.get("button")?.props).toEqual({
      label: "canonical",
    });
    expect(resolved.childrenByParent.get("body")).toEqual([canonicalElement]);
  });
});
