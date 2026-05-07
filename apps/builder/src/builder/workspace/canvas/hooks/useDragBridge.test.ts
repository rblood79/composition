import { describe, expect, it } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import {
  collectDragSnapshotEntries,
  isManualPositionDragTarget,
  resolveManualPositionDragProps,
} from "./useDragBridge";
import type { BoundingBox } from "../selection/types";

function makeElement(overrides: Partial<Element>): Element {
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
});

describe("drag snapshot collection", () => {
  it("captures old siblings and dragged subtree page/parent state", () => {
    const body = makeElement({ id: "body", type: "body", parent_id: null });
    const dragged = makeElement({
      id: "card",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 0,
    });
    const sibling = makeElement({
      id: "button",
      page_id: "page-1",
      parent_id: body.id,
      order_num: 1,
    });
    const child = makeElement({
      id: "heading",
      page_id: "page-1",
      parent_id: dragged.id,
      order_num: 0,
    });

    const elements = [body, dragged, sibling, child];
    const snapshot = collectDragSnapshotEntries(
      new Map(elements.map((element) => [element.id, element])),
      new Map([
        [body.id, [dragged, sibling]],
        [dragged.id, [child]],
      ]),
      dragged.id,
    );

    expect(snapshot).toEqual([
      {
        id: dragged.id,
        order_num: 0,
        page_id: "page-1",
        parent_id: body.id,
      },
      {
        id: sibling.id,
        order_num: 1,
        page_id: "page-1",
        parent_id: body.id,
      },
      {
        id: child.id,
        order_num: 0,
        page_id: "page-1",
        parent_id: dragged.id,
      },
    ]);
  });
});
