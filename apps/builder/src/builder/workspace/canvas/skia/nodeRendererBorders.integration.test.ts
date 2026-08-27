// @vitest-environment node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Canvas, CanvasKit, Paint, Path } from "canvaskit-wasm";
import { renderBox } from "./nodeRendererBorders";
import type { SkiaNodeData } from "./nodeRendererTypes";

interface CanvasKitInitializer {
  (options: { locateFile: (file: string) => string }): Promise<CanvasKit>;
}

interface PathSnapshot {
  path: Path;
  isEmpty: boolean;
  pointCount: number;
  fillType: ReturnType<Path["getFillType"]>;
  containsTopLeft: boolean;
  containsBottomRight: boolean;
  containsCenter: boolean;
  containsOuter: boolean;
}

interface CanvasRecorder {
  canvas: Canvas;
  clipPaths: PathSnapshot[];
  drawPaths: PathSnapshot[];
  drawColors: number[][];
}

const require = createRequire(import.meta.url);

async function loadCanvasKit(): Promise<CanvasKit> {
  const binDirectory = dirname(
    require.resolve("canvaskit-wasm/bin/canvaskit.js"),
  );
  const initialize = require(
    join(binDirectory, "canvaskit.js"),
  ) as CanvasKitInitializer;
  return initialize({ locateFile: (file) => join(binDirectory, file) });
}

function snapshotPath(path: Path): PathSnapshot {
  return {
    path,
    isEmpty: path.isEmpty(),
    pointCount: path.countPoints(),
    fillType: path.getFillType(),
    containsTopLeft: path.contains(5, 5),
    containsBottomRight: path.contains(95, 75),
    containsCenter: path.contains(50, 40),
    containsOuter: path.contains(-1, -1),
  };
}

function createCanvasRecorder(): CanvasRecorder {
  const clipPaths: PathSnapshot[] = [];
  const drawPaths: PathSnapshot[] = [];
  const drawColors: number[][] = [];

  const canvas = {
    save(): void {},
    restore(): void {},
    translate(): void {},
    clipRect(): void {},
    clipRRect(): void {},
    drawRRect(): void {},
    clipPath(path: Path): void {
      clipPaths.push(snapshotPath(path));
    },
    drawRect(_rect: unknown, paint: Paint): void {
      drawColors.push(Array.from(paint.getColor()));
    },
    drawPath(path: Path, paint: Paint): void {
      drawPaths.push(snapshotPath(path));
      drawColors.push(Array.from(paint.getColor()));
    },
  } as unknown as Canvas;

  return { canvas, clipPaths, drawPaths, drawColors };
}

function createNode(): SkiaNodeData {
  return {
    type: "box",
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    visible: true,
    box: {
      fillColor: Float32Array.of(1, 1, 1, 1),
      borderRadius: 0,
    },
  };
}

describe("nodeRendererBorders 실제 CanvasKit 통합", () => {
  let ck: CanvasKit;

  beforeAll(async () => {
    ck = await loadCanvasKit();
  });

  it("inset/outset clip 경계와 양쪽 명암을 보존하고 Path를 해제한다", () => {
    const renderBorder = (style: "inset" | "outset"): CanvasRecorder => {
      const recorder = createCanvasRecorder();
      const node = createNode();
      node.box!.strokeColor = Float32Array.of(0.5, 0.5, 0.5, 1);
      node.box!.strokeWidth = 10;
      node.box!.strokeStyle = style;
      renderBox(ck, recorder.canvas, node);
      return recorder;
    };

    const inset = renderBorder("inset");
    expect(inset.clipPaths).toHaveLength(2);
    expect(inset.clipPaths[0]).toMatchObject({
      isEmpty: false,
      containsTopLeft: true,
      containsBottomRight: false,
    });
    expect(inset.clipPaths[1]).toMatchObject({
      isEmpty: false,
      containsTopLeft: false,
      containsBottomRight: true,
    });
    expect(inset.drawColors[1][0]).toBeLessThan(inset.drawColors[2][0]);
    expect(inset.clipPaths.every(({ path }) => path.isDeleted())).toBe(true);

    const outset = renderBorder("outset");
    expect(outset.clipPaths).toHaveLength(2);
    expect(outset.drawColors[1][0]).toBeGreaterThan(outset.drawColors[2][0]);
    expect(outset.clipPaths.every(({ path }) => path.isDeleted())).toBe(true);
  });

  it("inner shadow EvenOdd donut과 arc geometry를 보존하고 Path를 해제한다", () => {
    const shadowRecorder = createCanvasRecorder();
    const shadowNode = createNode();
    shadowNode.box!.borderRadius = 10;
    shadowNode.effects = [
      {
        type: "drop-shadow",
        dx: 2,
        dy: 2,
        sigmaX: 0,
        sigmaY: 0,
        color: Float32Array.of(0, 0, 0, 0.5),
        inner: true,
        spread: 0,
      },
    ];
    renderBox(ck, shadowRecorder.canvas, shadowNode);

    expect(shadowRecorder.drawPaths).toHaveLength(1);
    expect(shadowRecorder.drawPaths[0]).toMatchObject({
      isEmpty: false,
      containsCenter: false,
      containsOuter: true,
    });
    expect(shadowRecorder.drawPaths[0].fillType).toBe(ck.FillType.EvenOdd);
    expect(shadowRecorder.drawPaths[0].path.isDeleted()).toBe(true);

    const arcRecorder = createCanvasRecorder();
    const arcNode = createNode();
    arcNode.arc = {
      cx: 50,
      cy: 40,
      radius: 30,
      startAngle: 0,
      sweepAngle: 120,
      strokeColor: Float32Array.of(1, 0, 0, 1),
      strokeWidth: 4,
      strokeCap: "round",
    };
    renderBox(ck, arcRecorder.canvas, arcNode);

    expect(arcRecorder.drawPaths).toHaveLength(1);
    expect(arcRecorder.drawPaths[0].isEmpty).toBe(false);
    expect(arcRecorder.drawPaths[0].pointCount).toBeGreaterThan(0);
    expect(arcRecorder.drawPaths[0].path.isDeleted()).toBe(true);
  });
});
