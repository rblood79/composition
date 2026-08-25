// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getSkiaPrimitive, type Shape } from "@composition/specs";
import { specShapesToSkia } from "./specShapeConverter";

describe("specShapesToSkia presentation fill materialization", () => {
  it("materializes standalone text color as a root-owned paint slot", () => {
    const node = specShapesToSkia(
      [
        {
          align: "left",
          fill: "#123456",
          fontFamily: "Inter",
          fontSize: 14,
          id: "text",
          text: "Hello",
          type: "text",
          x: 0,
          y: 0,
        },
      ],
      "light",
      100,
      40,
    );

    expect(node.presentationTextTargets).toHaveLength(1);
    expect(node.presentationTextTargets?.[0]?.color).toBe(
      node.children?.[0]?.text?.presentationColor,
    );
    expect(node.presentationTextMetricTargets).toHaveLength(1);
    expect(node.presentationTextMetricTargets?.[0]?.text).toBe(
      node.children?.[0]?.text,
    );
    expect(node.children?.[0]?.text?.color).not.toBe(
      node.children?.[0]?.text?.presentationColor,
    );
  });

  it("maps a full-size bg rect to the root draw primitive", () => {
    const shapes: Shape[] = [
      {
        fill: "#123456",
        height: "auto",
        id: "bg",
        radius: 8,
        type: "roundRect",
        width: "auto",
        x: 0,
        y: 0,
      },
    ];

    const node = specShapesToSkia(shapes, "light", 100, 40);

    expect(node.presentationFillTargets).toHaveLength(1);
    expect(node.presentationFillTargets?.[0]?.color).toBe(node.box?.fillColor);
  });

  it("maps Avatar's named circle bg to its child primitive, not the transparent root", () => {
    const shapes: Shape[] = [
      {
        fill: "#123456",
        id: "bg",
        radius: 20,
        type: "circle",
        x: 20,
        y: 20,
      },
    ];

    const node = specShapesToSkia(shapes, "light", 40, 40);

    expect(node.presentationFillTargets).toHaveLength(1);
    expect(node.presentationFillTargets?.[0]?.color).toBe(
      node.children?.[0]?.box?.fillColor,
    );
    expect(node.presentationFillTargets?.[0]?.color).not.toBe(
      node.box?.fillColor,
    );
  });

  it("maps StatusLight's real dot primitive to its child fill slot", () => {
    const shapes = getSkiaPrimitive("status_light")?.({
      props: { children: "Ready" },
      size: { dotSize: 10, gap: 8, height: 24 } as never,
      style: { backgroundColor: "#123456" },
      visual: undefined,
      paint: {
        backgroundColor: "#123456",
        backgroundAlpha: 1,
        staticTrackWash: false,
        hasVisibleBoxPaint: true,
        hasOpaqueCatalogBackground: false,
      },
    });
    expect(shapes).not.toBeNull();

    const node = specShapesToSkia(shapes ?? [], "light", 80, 24);

    expect(node.presentationFillTargets).toHaveLength(1);
    expect(node.presentationFillTargets?.[0]?.color).toBe(
      node.children?.[0]?.box?.fillColor,
    );
  });

  it("maps multiple line and arc background roles to their exact stroke slots", () => {
    const shapes: Shape[] = [
      {
        presentationRole: "background-fill",
        stroke: "#123456",
        strokeWidth: 2,
        type: "line",
        x1: 0,
        x2: 10,
        y1: 0,
        y2: 10,
      },
      {
        presentationRole: "background-fill",
        stroke: "#654321",
        strokeWidth: 2,
        type: "line",
        x1: 10,
        x2: 0,
        y1: 0,
        y2: 10,
      },
      {
        presentationRole: "background-fill",
        radius: 8,
        startAngle: 0,
        stroke: "#ABCDEF",
        strokeWidth: 2,
        sweepAngle: 360,
        type: "arc",
        x: 10,
        y: 10,
      },
    ];

    const node = specShapesToSkia(shapes, "light", 20, 20);

    expect(node.presentationFillTargets).toHaveLength(3);
    expect(node.presentationFillTargets?.[0]?.color).toBe(
      node.children?.[0]?.line?.strokeColor,
    );
    expect(node.presentationFillTargets?.[1]?.color).toBe(
      node.children?.[1]?.line?.strokeColor,
    );
    expect(node.presentationFillTargets?.[2]?.color).toBe(
      node.children?.[2]?.arc?.strokeColor,
    );
  });
});
