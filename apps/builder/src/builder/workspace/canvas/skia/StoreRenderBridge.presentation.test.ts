// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  FillType,
  type FillItem,
  type LinearGradientFillItem,
} from "../../../../types/builder/fill.types";
import { StoreRenderBridge } from "./StoreRenderBridge";
import { isVolatileNode } from "./nodePictureCache";
import type { SkiaNodeData } from "./nodeRendererTypes";
import {
  clearSkiaRegistry,
  getRegistryVersion,
  getSkiaNode,
  registerSkiaNode,
} from "./useSkiaNode";

function fill(color: string): FillItem {
  return {
    blendMode: "normal",
    color,
    enabled: true,
    id: "fill-1",
    opacity: 1,
    type: FillType.Color,
  };
}

function gradientFill(
  firstColor: string,
  secondColor: string,
  opacity = 1,
): LinearGradientFillItem {
  return {
    blendMode: "normal",
    enabled: true,
    id: "fill-1",
    opacity,
    rotation: 0,
    stops: [
      { color: firstColor, position: 0 },
      { color: secondColor, position: 1 },
    ],
    type: FillType.LinearGradient,
  };
}

function makeNode(): SkiaNodeData {
  const box: NonNullable<SkiaNodeData["box"]> = {
    borderRadius: 0,
    fillColor: Float32Array.of(0.1, 0.2, 0.3, 1),
  };
  return {
    box,
    height: 40,
    presentationFillTargets: [{ color: box.fillColor, opacityMultiplier: 1 }],
    type: "box",
    visible: true,
    width: 80,
    x: 0,
    y: 0,
  };
}

describe("StoreRenderBridge ADR-187 presentation patch", () => {
  beforeEach(() => clearSkiaRegistry());
  afterEach(() => clearSkiaRegistry());

  it("box/registry identity를 보존하고 terminal에서 exact base를 복원한다", () => {
    const node = makeNode();
    const box = node.box!;
    const baseFillColor = box.fillColor;
    registerSkiaNode("node-1", node);
    const registryVersion = getRegistryVersion();
    const bridge = new StoreRenderBridge();

    expect(
      bridge.applyPresentationFillPatch("node-1", [fill("#FF000080")]),
    ).toBe(true);
    expect(getRegistryVersion()).toBe(registryVersion);
    expect(getSkiaNode("node-1")).toBe(node);
    expect(getSkiaNode("node-1")?.box).toBe(box);
    expect(box.fillColor).toEqual(Float32Array.of(1, 0, 0, 0.5));
    expect(isVolatileNode("node-1")).toBe(true);

    expect(bridge.restorePresentationFillPatch("node-1")).toBe(true);
    expect(box.fillColor).toBe(baseFillColor);
    expect(box.fillColor).toEqual(Float32Array.of(0.1, 0.2, 0.3, 1));
    expect(Object.prototype.hasOwnProperty.call(box, "fill")).toBe(false);
    expect(getRegistryVersion()).toBe(registryVersion);
    expect(isVolatileNode("node-1")).toBe(false);
  });

  it("동일 presentation 값은 no-op이고 없는/non-box 대상은 건너뛴다", () => {
    const node = makeNode();
    registerSkiaNode("node-1", node);
    const bridge = new StoreRenderBridge();

    expect(
      bridge.applyPresentationFillPatch("node-1", [fill("#00FF00FF")]),
    ).toBe(true);
    expect(
      bridge.applyPresentationFillPatch("node-1", [fill("#00FF00FF")]),
    ).toBe(false);
    expect(
      bridge.applyPresentationFillPatch("missing", [fill("#00FF00FF")]),
    ).toBe(false);
    expect(bridge.restoreAllPresentationFillPatches()).toBe(1);
  });

  it("root가 아닌 catalog bg primitive를 명시적 materialization target으로 갱신한다", () => {
    const rootBox: NonNullable<SkiaNodeData["box"]> = {
      borderRadius: 0,
      fillColor: Float32Array.of(0, 0, 0, 0),
    };
    const avatarBox: NonNullable<SkiaNodeData["box"]> = {
      borderRadius: 20,
      fillColor: Float32Array.of(0.1, 0.2, 0.3, 1),
    };
    const node: SkiaNodeData = {
      box: rootBox,
      children: [
        {
          box: avatarBox,
          height: 40,
          type: "box",
          visible: true,
          width: 40,
          x: 0,
          y: 0,
        },
      ],
      height: 40,
      presentationFillTargets: [
        { color: avatarBox.fillColor, opacityMultiplier: 1 },
      ],
      type: "box",
      visible: true,
      width: 40,
      x: 0,
      y: 0,
    };
    registerSkiaNode("avatar-1", node);
    const bridge = new StoreRenderBridge();

    expect(
      bridge.applyPresentationFillPatch("avatar-1", [fill("#FF0000FF")]),
    ).toBe(true);
    expect(rootBox.fillColor).toEqual(Float32Array.of(0, 0, 0, 0));
    expect(avatarBox.fillColor).toEqual(Float32Array.of(1, 0, 0, 1));

    expect(bridge.restorePresentationFillPatch("avatar-1")).toBe(true);
    expect(avatarBox.fillColor).toEqual(Float32Array.of(0.1, 0.2, 0.3, 1));
  });

  it("복수 primitive color slot을 같은 patch로 갱신하고 각 base로 복원한다", () => {
    const firstColor = Float32Array.of(0.1, 0.2, 0.3, 1);
    const secondColor = Float32Array.of(0.3, 0.2, 0.1, 0.5);
    const node = makeNode();
    node.presentationFillTargets = [
      { color: firstColor, opacityMultiplier: 1 },
      { color: secondColor, opacityMultiplier: 0.5 },
    ];
    registerSkiaNode("multi-1", node);
    const bridge = new StoreRenderBridge();

    expect(
      bridge.applyPresentationFillPatch("multi-1", [fill("#00FF00FF")]),
    ).toBe(true);
    expect(firstColor).toEqual(Float32Array.of(0, 1, 0, 1));
    expect(secondColor).toEqual(Float32Array.of(0, 1, 0, 0.5));

    expect(bridge.restorePresentationFillPatch("multi-1")).toBe(true);
    expect(firstColor).toEqual(Float32Array.of(0.1, 0.2, 0.3, 1));
    expect(secondColor).toEqual(Float32Array.of(0.3, 0.2, 0.1, 0.5));
  });

  it("primitive opacity multiplier를 drag와 canonical handoff에서 유지한다", () => {
    const node = makeNode();
    const color = node.box!.fillColor;
    node.presentationFillTargets = [{ color, opacityMultiplier: 0.5 }];
    registerSkiaNode("alpha-1", node);
    const bridge = new StoreRenderBridge();

    expect(
      bridge.applyPresentationFillPatch("alpha-1", [fill("#FF000080")]),
    ).toBe(true);
    expect(color).toEqual(Float32Array.of(1, 0, 0, 0.25));

    expect(bridge.releasePresentationFillPatch("alpha-1")).toBe(true);
    expect(color).toEqual(Float32Array.of(1, 0, 0, 0.25));
    expect(isVolatileNode("alpha-1")).toBe(false);
  });

  it("single gradient의 stop color/position/opacity를 shader 배열만 patch하고 exact restore한다", () => {
    const fallbackColor = Float32Array.of(0, 0, 0, 0);
    const gradientColors = [
      Float32Array.of(1, 0, 0, 1),
      Float32Array.of(0, 0, 1, 1),
    ];
    const gradientPositions = [0, 1];
    const node: SkiaNodeData = {
      box: {
        borderRadius: 0,
        fillColor: fallbackColor,
        fill: {
          type: "linear-gradient",
          start: [0, 0],
          end: [80, 0],
          colors: gradientColors,
          positions: gradientPositions,
        },
      },
      height: 40,
      presentationFillTargets: [
        {
          color: fallbackColor,
          opacityMultiplier: 1,
          fillId: "fill-1",
          gradientColors,
          gradientPositions,
          gradientWidth: 80,
          gradientHeight: 40,
        },
      ],
      type: "box",
      visible: true,
      width: 80,
      x: 0,
      y: 0,
    };
    registerSkiaNode("gradient-1", node);
    const bridge = new StoreRenderBridge();

    expect(
      bridge.applyPresentationFillPatch("gradient-1", [
        gradientFill("#00FF0080", "#0000FFFF", 0.5),
      ]),
    ).toBe(true);
    expect(gradientColors[0]).toEqual(Float32Array.of(0, 1, 0, 0.25));
    expect(gradientColors[1]).toEqual(Float32Array.of(0, 0, 1, 0.5));
    expect(gradientPositions).toEqual([0, 1]);
    expect(bridge.restorePresentationFillPatch("gradient-1")).toBe(true);
    expect(gradientColors[0]).toEqual(Float32Array.of(1, 0, 0, 1));
    expect(gradientColors[1]).toEqual(Float32Array.of(0, 0, 1, 1));
    expect(gradientPositions).toEqual([0, 1]);
  });

  it("gradient stop 위치 변경은 기존 position array identity를 유지한다", () => {
    const node = makeNode();
    const gradientColors = [
      Float32Array.of(1, 0, 0, 1),
      Float32Array.of(0, 0, 1, 1),
    ];
    const gradientPositions = [0, 1];
    node.box!.fill = {
      type: "linear-gradient",
      start: [0, 0],
      end: [80, 0],
      colors: gradientColors,
      positions: gradientPositions,
    };
    node.presentationFillTargets = [
      {
        color: node.box!.fillColor,
        opacityMultiplier: 1,
        fillId: "fill-1",
        gradientColors,
        gradientPositions,
        gradientWidth: 80,
        gradientHeight: 40,
      },
    ];
    registerSkiaNode("gradient-position-1", node);
    const bridge = new StoreRenderBridge();

    expect(
      bridge.applyPresentationFillPatch("gradient-position-1", [
        {
          ...gradientFill("#FF0000FF", "#0000FFFF"),
          stops: [
            { color: "#FF0000FF", position: 0.25 },
            { color: "#0000FFFF", position: 0.75 },
          ],
        },
      ]),
    ).toBe(true);
    expect(gradientPositions).toBe(node.box!.fill.positions);
    expect(gradientPositions).toEqual([0.25, 0.75]);
    expect(bridge.restorePresentationFillPatch("gradient-position-1")).toBe(
      true,
    );
    expect(gradientPositions).toEqual([0, 1]);
  });
});
