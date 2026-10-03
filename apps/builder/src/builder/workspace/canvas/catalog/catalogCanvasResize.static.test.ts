// @vitest-environment node
/**
 * ADR-248 4e (user report 2026-10-01: "브라우저 리사이즈시 page 들이 깜빡임"): a window resize
 * sets the Canvas size, which clears its bitmap. The ResizeObserver callback runs after this
 * frame's animation frame, so a draw left to the frame scheduler lands one frame later and the
 * browser paints the cleared canvas first — live: 24 of 25 resize steps painted a blank Canvas.
 * Contract: the resize callback draws the frame itself, after resizing the surface.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "CatalogCanvas.tsx"),
  "utf-8",
);

describe("catalog Canvas resize", () => {
  it("draws inside the resize callback, after the surface is resized", () => {
    const callback = source.match(
      /new ResizeObserver\(\(\) => \{([\s\S]*?)\n {4}\}\);/,
    )?.[1];
    expect(callback).toBeDefined();
    const resized = callback!.indexOf("renderer.resize(canvas)");
    const drawn = callback!.indexOf("renderFrame()");
    expect(resized).toBeGreaterThanOrEqual(0);
    expect(drawn).toBeGreaterThan(resized);
  });
});
