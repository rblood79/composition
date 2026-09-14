// @vitest-environment node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Canvas, CanvasKit, Paint, Path } from "canvaskit-wasm";
import {
  renderArc,
  renderIconPath,
  renderPartialBorder,
  renderPath,
  clearSvgPathCache,
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
  /** ADR-219 — 변별 stroke 의 wedge clip (drawPath 앞에 걸린다) */
  clips: number[][];
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
  const clips: number[][] = [];
  const circles: Array<[number, number, number]> = [];
  const canvas = {
    save(): void {},
    restore(): void {},
    translate(): void {},
    scale(): void {},
    clipPath(path: Path): void {
      clips.push(Array.from(path.getBounds()));
    },
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

  return { canvas, paths, clips, circles };
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
  beforeEach(() => {
    clearSvgPathCache(ck);
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

    // ADR-219 — 변마다 자기 폭의 중심선 rrect (inset 2) 를 전체 stroke 하고, 그 변의
    // wedge (바깥 두 꼭짓점 → 안쪽 두 꼭짓점) 로 clip 한다. wedge 4개는 겹치지 않으므로
    // 코너 호가 한 번만 칠해진다 (종전엔 인접 두 변이 각각 호 전체를 그렸다).
    expect(borderRecorder.paths).toHaveLength(4);
    expect(borderRecorder.paths.map(({ bounds }) => bounds)).toEqual([
      [2, 2, 98, 78],
      [2, 2, 98, 78],
      [2, 2, 98, 78],
      [2, 2, 98, 78],
    ]);
    expect(borderRecorder.clips).toEqual([
      [0, 0, 100, 4],
      [96, 0, 100, 80],
      [0, 76, 100, 80],
      [0, 0, 4, 80],
    ]);
    expect(borderRecorder.paths.every(({ isEmpty }) => !isEmpty)).toBe(true);
    expect(borderRecorder.paths.every(({ path }) => path.isDeleted())).toBe(
      true,
    );
  });

  it("partial border: 한 변만 있는 코너는 그 변이 코너 전체를 갖는다 (wedge 대각선이 세로/가로)", () => {
    const recorder = createCanvasRecorder();
    const node = createNode();
    node.partialBorder = {
      sides: { top: true, right: true },
      strokeColor: Float32Array.of(0.8, 0.2, 0.2, 0.5),
      strokeWidth: 6,
      borderRadius: [20, 20, 20, 20],
    };
    renderPartialBorder(ck, recorder.canvas, node);

    expect(recorder.paths).toHaveLength(2);
    // top wedge: 왼쪽 끝은 left 폭 0 이라 (0,0)→(0,6) 세로 — TL 코너 전체가 top 소유.
    // TR 은 right 도 있어 (100,0)→(94,6) 대각선에서 갈린다.
    expect(recorder.clips).toEqual([
      [0, 0, 100, 6],
      [94, 0, 100, 80],
    ]);
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

  // ADR-211 P4 — 같은 `d` 는 wasm 파싱 1회 · Path 공유 (그리기 뒤 delete 하지 않는다) ·
  //   fillRule 이 다르면 다른 Path.
  it("renderPath 는 같은 SVG d 를 한 번만 파싱해 재사용한다", () => {
    const recorder = createCanvasRecorder();
    const make = ck.Path.MakeFromSVGString.bind(ck.Path);
    let parsed = 0;
    ck.Path.MakeFromSVGString = (d: string) => {
      parsed++;
      return make(d);
    };
    try {
      const node = (fillRule?: "nonzero" | "evenodd"): SkiaNodeData => ({
        ...createNode(),
        path: {
          d: "M0 0 L10 0 L10 10 Z",
          offsetX: 0,
          offsetY: 0,
          fillColor: Float32Array.of(1, 0, 0, 1),
          strokeWidth: 0,
          ...(fillRule ? { fillRule } : {}),
        },
      });
      renderPath(ck, recorder.canvas, node());
      renderPath(ck, recorder.canvas, node());
      expect(parsed).toBe(1);
      expect(recorder.paths).toHaveLength(2);
      expect(recorder.paths[0].path).toBe(recorder.paths[1].path);
      expect(recorder.paths[0].path.isDeleted()).toBe(false);
      renderPath(ck, recorder.canvas, node("evenodd"));
      expect(parsed).toBe(2);
      expect(recorder.paths[2].path).not.toBe(recorder.paths[0].path);
    } finally {
      ck.Path.MakeFromSVGString = make;
    }
  });
});
