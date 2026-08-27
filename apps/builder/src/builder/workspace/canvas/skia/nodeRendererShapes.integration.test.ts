// @vitest-environment node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Canvas, CanvasKit, Paint, Path } from "canvaskit-wasm";
import {
  renderArc,
  renderIconPath,
  renderPartialBorder,
} from "./nodeRendererShapes";
import type { SkiaNodeData } from "./nodeRendererTypes";

interface CanvasKitInitializer {
  (options: { locateFile: (file: string) => string }): Promise<CanvasKit>;
}

interface PathSnapshot {
  path: Path;
  isEmpty: boolean;
  pointCount: number;
  bounds: number[];
}

interface CanvasRecorder {
  canvas: Canvas;
  paths: PathSnapshot[];
  circles: Array<[number, number, number]>;
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

function createCanvasRecorder(): CanvasRecorder {
  const paths: PathSnapshot[] = [];
  const circles: Array<[number, number, number]> = [];
  const canvas = {
    save(): void {},
    restore(): void {},
    translate(): void {},
    scale(): void {},
    drawPath(path: Path, _paint: Paint): void {
      paths.push({
        path,
        isEmpty: path.isEmpty(),
        pointCount: path.countPoints(),
        bounds: Array.from(path.getBounds()),
      });
    },
    drawCircle(cx: number, cy: number, radius: number): void {
      circles.push([cx, cy, radius]);
    },
  } as unknown as Canvas;

  return { canvas, paths, circles };
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
      fillColor: Float32Array.of(0, 0, 0, 0),
      borderRadius: 0,
    },
  };
}

describe("nodeRendererShapes 실제 CanvasKit 통합", () => {
  let ck: CanvasKit;

  beforeAll(async () => {
    ck = await loadCanvasKit();
  });

  it("arc와 radius가 있는 partial border 4변 geometry 및 Path 해제를 보존한다", () => {
    const arcRecorder = createCanvasRecorder();
    const arcNode = createNode();
    arcNode.arc = {
      cx: 50,
      cy: 40,
      radius: 30,
      startAngle: -90,
      sweepAngle: 270,
      strokeColor: Float32Array.of(0.2, 0.4, 0.8, 1),
      strokeWidth: 4,
      strokeCap: "round",
    };
    renderArc(ck, arcRecorder.canvas, arcNode);

    expect(arcRecorder.paths).toHaveLength(1);
    expect(arcRecorder.paths[0].isEmpty).toBe(false);
    expect(arcRecorder.paths[0].pointCount).toBeGreaterThan(0);
    expect(arcRecorder.paths[0].path.isDeleted()).toBe(true);

    const borderRecorder = createCanvasRecorder();
    const borderNode = createNode();
    borderNode.partialBorder = {
      sides: { top: true, right: true, bottom: true, left: true },
      strokeColor: Float32Array.of(0.8, 0.2, 0.2, 1),
      strokeWidth: 4,
      strokeDasharray: [8, 4],
      borderRadius: [20, 10, 15, 5],
    };
    renderPartialBorder(ck, borderRecorder.canvas, borderNode);

    expect(borderRecorder.paths).toHaveLength(4);
    expect(borderRecorder.paths.map(({ bounds }) => bounds)).toEqual([
      [2, 2, 98, 22],
      [83, 2, 98, 78],
      [2, 63, 98, 78],
      [2, 2, 22, 78],
    ]);
    expect(borderRecorder.paths.every(({ isEmpty }) => !isEmpty)).toBe(true);
    expect(borderRecorder.paths.every(({ path }) => path.isDeleted())).toBe(
      true,
    );
  });

  it("SVG factory path와 circle icon 계약을 그대로 유지한다", () => {
    const recorder = createCanvasRecorder();
    const node = createNode();
    node.iconPath = {
      paths: ["M2 12 L10 20 L22 4"],
      circles: [{ cx: 12, cy: 12, r: 3 }],
      cx: 12,
      cy: 12,
      size: 24,
      strokeColor: Float32Array.of(0, 0, 0, 1),
      strokeWidth: 2,
    };
    renderIconPath(ck, recorder.canvas, node);

    expect(recorder.paths).toHaveLength(1);
    expect(recorder.paths[0]).toMatchObject({
      isEmpty: false,
      bounds: [2, 4, 22, 20],
    });
    expect(recorder.paths[0].path.isDeleted()).toBe(true);
    expect(recorder.circles).toEqual([[12, 12, 3]]);
  });
});
