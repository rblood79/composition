// @vitest-environment node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { Canvas, CanvasKit, Paint, Path } from "canvaskit-wasm";
import {
  renderDataSourceEdges,
  renderWorkflowEdges,
  type PageFrame,
} from "./workflowRenderer";
import type { DataSourceEdge, WorkflowEdge } from "./workflowEdges";

interface CanvasKitInitializer {
  (options: { locateFile: (file: string) => string }): Promise<CanvasKit>;
}

interface PathSnapshot {
  path: Path;
  isEmpty: boolean;
  pointCount: number;
  bounds: number[];
  svg: string;
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
    drawPath(path: Path, _paint: Paint): void {
      paths.push({
        path,
        isEmpty: path.isEmpty(),
        pointCount: path.countPoints(),
        bounds: Array.from(path.getBounds()),
        svg: path.toSVGString(),
      });
    },
    drawCircle(cx: number, cy: number, radius: number): void {
      circles.push([cx, cy, radius]);
    },
  } as unknown as Canvas;

  return { canvas, paths, circles };
}

const workflowEdge: WorkflowEdge = {
  id: "page-a-page-b-navigation",
  type: "navigation",
  sourcePageId: "page-a",
  targetPageId: "page-b",
};

const pageFrames = new Map<string, PageFrame>([
  ["page-a", { id: "page-a", x: 0, y: 0, width: 100, height: 80 }],
  ["page-b", { id: "page-b", x: 300, y: 120, width: 100, height: 80 }],
]);

describe("workflowRenderer 실제 CanvasKit 통합", () => {
  let ck: CanvasKit;

  beforeAll(async () => {
    ck = await loadCanvasKit();
  });

  it.each([
    ["orthogonal", true, false],
    ["bezier", false, true],
  ] as const)(
    "%s edge와 닫힌 화살표 geometry 및 Path 해제를 보존한다",
    (_mode, straightEdges, expectsCubic) => {
      const recorder = createCanvasRecorder();

      renderWorkflowEdges(
        ck,
        recorder.canvas,
        [workflowEdge],
        pageFrames,
        1,
        undefined,
        undefined,
        undefined,
        straightEdges,
      );

      expect(recorder.paths).toHaveLength(2);
      const [edge, arrow] = recorder.paths;
      expect(edge).toMatchObject({
        isEmpty: false,
        bounds: [100, 40, 300, 160],
      });
      expect(edge.pointCount).toBeGreaterThan(1);
      expect(edge.svg.includes("C")).toBe(expectsCubic);

      expect(arrow.isEmpty).toBe(false);
      expect(arrow.svg.endsWith("Z")).toBe(true);
      expect(arrow.bounds[0]).toBeLessThan(300);
      expect(arrow.bounds[2]).toBe(300);
      expect(arrow.bounds[1]).toBeLessThan(160);
      expect(arrow.bounds[3]).toBeGreaterThan(160);
      expect(recorder.paths.every(({ path }) => path.isDeleted())).toBe(true);
    },
  );

  it("data-source indicator line geometry 및 Path 해제를 보존한다", () => {
    const recorder = createCanvasRecorder();
    const dataSourceEdge: DataSourceEdge = {
      id: "table-orders",
      sourceType: "dataTable",
      name: "Orders",
      boundElements: [
        { elementId: "element-a", elementTag: "Table", pageId: "page-a" },
      ],
    };

    renderDataSourceEdges(
      ck,
      recorder.canvas,
      [dataSourceEdge],
      pageFrames,
      new Map([["element-a", { x: 30, y: 40, width: 40, height: 20 }]]),
      1,
    );

    expect(recorder.circles).toEqual([[20, -20, 5]]);
    expect(recorder.paths).toHaveLength(1);
    expect(recorder.paths[0]).toMatchObject({
      isEmpty: false,
      bounds: [20, -15, 50, 40],
    });
    expect(recorder.paths[0].pointCount).toBe(2);
    expect(recorder.paths[0].path.isDeleted()).toBe(true);
  });
});
