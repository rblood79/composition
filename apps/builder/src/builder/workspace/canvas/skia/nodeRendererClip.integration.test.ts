// @vitest-environment node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit, Path } from "canvaskit-wasm";
import { buildClipPath, createRoundRectPath } from "./nodeRendererClip";

interface CanvasKitInitializer {
  (options: { locateFile: (file: string) => string }): Promise<CanvasKit>;
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

function expectContains(
  path: Path | null,
  inside: [number, number],
  outside: [number, number],
): void {
  expect(path).not.toBeNull();
  try {
    expect(path!.isEmpty()).toBe(false);
    expect(path!.contains(inside[0], inside[1])).toBe(true);
    expect(path!.contains(outside[0], outside[1])).toBe(false);
  } finally {
    path?.delete();
  }
}

describe("nodeRendererClip 실제 CanvasKit 통합", () => {
  let ck: CanvasKit;

  beforeAll(async () => {
    ck = await loadCanvasKit();
  });

  it("round-rect와 clip-path 4종의 내부/외부 영역을 보존한다", () => {
    expectContains(
      createRoundRectPath(ck, 0, 0, 100, 80, [20, 10, 15, 5]),
      [50, 40],
      [1, 1],
    );
    expectContains(
      buildClipPath(
        ck,
        {
          type: "inset",
          top: 10,
          right: 20,
          bottom: 30,
          left: 5,
          borderRadius: 8,
        },
        100,
        100,
      ),
      [50, 40],
      [2, 50],
    );
    expectContains(
      buildClipPath(
        ck,
        { type: "circle", radius: 25, cx: 50, cy: 40 },
        100,
        80,
      ),
      [50, 40],
      [10, 10],
    );
    expectContains(
      buildClipPath(
        ck,
        { type: "ellipse", rx: 40, ry: 20, cx: 50, cy: 40 },
        100,
        80,
      ),
      [50, 40],
      [50, 5],
    );
    expectContains(
      buildClipPath(
        ck,
        {
          type: "polygon",
          points: [
            { x: 10, y: 70 },
            { x: 50, y: 10 },
            { x: 90, y: 70 },
          ],
        },
        100,
        80,
      ),
      [50, 40],
      [5, 5],
    );
  });

  it("퇴화 inset과 점이 부족한 polygon은 Path를 만들지 않는다", () => {
    expect(
      buildClipPath(
        ck,
        {
          type: "inset",
          top: 0,
          right: 60,
          bottom: 0,
          left: 50,
          borderRadius: 0,
        },
        100,
        80,
      ),
    ).toBeNull();
    expect(
      buildClipPath(
        ck,
        {
          type: "polygon",
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 80 },
          ],
        },
        100,
        80,
      ),
    ).toBeNull();
  });
});
