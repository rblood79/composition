// @vitest-environment node

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import { buildPath } from "./buildPath";

interface CanvasKitInitializer {
  (options: { locateFile: (file: string) => string }): Promise<CanvasKit>;
}

const require = createRequire(import.meta.url);

function resolveBinDirectory(): string {
  const injectedDirectory = process.env.CANVASKIT_BIN_DIR;
  if (injectedDirectory) {
    return injectedDirectory;
  }
  return dirname(require.resolve("canvaskit-wasm/bin/canvaskit.js"));
}

async function loadCanvasKit(): Promise<CanvasKit> {
  const binDirectory = resolveBinDirectory();
  const initialize = require(
    join(binDirectory, "canvaskit.js"),
  ) as CanvasKitInitializer;
  return initialize({
    locateFile: (file) => join(binDirectory, file),
  });
}

describe("buildPath 실제 CanvasKit 통합", () => {
  it("EvenOdd와 close 수명주기를 보존하고 비어 있지 않은 Path를 반환한다", async () => {
    const ck = await loadCanvasKit();
    const path = buildPath(ck, (sink) => {
      sink
        .addRect(ck.LTRBRect(0, 0, 100, 100))
        .addRRect(ck.RRectXY(ck.LTRBRect(25, 25, 75, 75), 8, 8))
        .setFillType(ck.FillType.EvenOdd)
        .moveTo(10, 10)
        .lineTo(20, 10)
        .close()
        .moveTo(30, 10)
        .lineTo(40, 10);
    });

    try {
      expect(path.isEmpty()).toBe(false);
      expect(path.contains(50, 50)).toBe(false);
      expect(path.contains(10, 50)).toBe(true);
    } finally {
      path.delete();
    }
  });
});
