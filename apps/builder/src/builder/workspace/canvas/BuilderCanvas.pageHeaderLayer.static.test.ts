import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-221 배선 정적 가드 (breakdown §7 "BuilderCanvas 정적 가드").
 * - 게이트 신호: `ViewportControlBridge` 마운트가 `onInteractionStart/End` 를 전달한다
 *   (round 1 h2 — 이전에는 dead prop 이었다).
 * - 헤더 층 마운트 1.
 */
describe("BuilderCanvas — 페이지 헤더 DOM 층 배선", () => {
  it("ViewportControlBridge 에 게이트 신호 2개를 넘기고 PageHeaderLayer 를 1회 마운트한다", async () => {
    const source = await readFile(
      resolve(__dirname, "BuilderCanvas.tsx"),
      "utf-8",
    );
    const bridge = source.match(/<ViewportControlBridge[\s\S]*?\/>/);
    expect(bridge).not.toBeNull();
    expect(bridge?.[0]).toContain(
      "onInteractionStart={handleCameraGestureStart}",
    );
    expect(bridge?.[0]).toContain("onInteractionEnd={handleCameraGestureEnd}");
    expect(source).toContain("setCameraGestureActive(true)");
    expect(source).toContain("setCameraGestureActive(false)");

    expect(source.match(/<PageHeaderLayer\b/g)?.length).toBe(1);
    expect(source).toContain(
      "frames={sceneStructureSnapshot.document.visiblePageFrames}",
    );
  });
});
