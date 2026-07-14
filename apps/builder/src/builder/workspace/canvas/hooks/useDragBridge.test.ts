import { describe, expect, it } from "vitest";
import type { Element } from "../../../../types/core/store.types";
import {
  isManualPositionDragTarget,
  resolveDragReadModel,
  resolveManualPositionDragProps,
} from "./useDragBridge";
import type { BoundingBox } from "../selection/types";

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
