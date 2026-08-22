// @vitest-environment node

import { describe, expect, it } from "vitest";
import { FillType, type FillItem } from "../../../../types/builder/fill.types";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { buildSpecNodeData } from "./buildSpecNodeData";

function colorFill(): FillItem {
  return {
    blendMode: "normal",
    color: "#33669980",
    enabled: true,
    id: "fill-1",
    opacity: 0.5,
    type: FillType.Color,
  };
}

function build(type: string) {
  const element = {
    fills: [colorFill()],
    id: `${type}-1`,
    order_num: 0,
    page_id: "page-1",
    parent_id: null,
    props: { children: "Ready", size: "md" },
    type,
  } as unknown as CanvasSceneNode;
  return buildSpecNodeData({
    element,
    elementsMap: new Map([[element.id, element]]),
    layout: {
      height: 40,
      width: 120,
      x: 0,
      y: 0,
    } as ComputedLayout,
    theme: "light",
  });
}

describe("buildSpecNodeData presentation materialization", () => {
  it.each(["Avatar", "StatusLight", "ProgressCircle"])(
    "%s primitive가 canonical fill alpha를 typed target에 materialize한다",
    (type) => {
      const node = build(type);
      const target = node?.presentationFillTargets?.[0];
      const canonicalAlpha = 0.5 * 0.5;

      expect(target).toBeDefined();
      expect(target?.color[3]).toBeCloseTo(
        canonicalAlpha * (target?.opacityMultiplier ?? 1),
        5,
      );
    },
  );

  it("Slot native spec은 intrinsic opacity와 canonical alpha를 함께 유지한다", () => {
    const node = build("Slot");
    const target = node?.presentationFillTargets?.[0];

    expect(target?.opacityMultiplier).toBe(0.5);
    expect(target?.color[3]).toBeCloseTo(0.5 * 0.5 * 0.5, 5);
  });
});
