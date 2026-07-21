import { describe, expect, it } from "vitest";
import { resolveBreakpointViewport } from "./viewportActions";

describe("resolveBreakpointViewport", () => {
  it("처음 방문하는 breakpoint는 현재 zoom을 유지하고 중앙 정렬한다", () => {
    const viewport = resolveBreakpointViewport({
      canvasSize: { width: 390, height: 844 },
      containerSize: { width: 1000, height: 800 },
      zoom: 1,
    });

    expect(viewport).toEqual({
      scale: 1,
      x: 305,
      y: -22,
    });
  });

  it("기존 breakpoint snapshot은 zoom과 pan을 함께 복원한다", () => {
    const savedViewport = { x: 42, y: 84, scale: 1 };

    expect(
      resolveBreakpointViewport({
        canvasSize: { width: 1920, height: 1080 },
        containerSize: { width: 1000, height: 800 },
        zoom: 0.6,
        savedViewport,
      }),
    ).toEqual(savedViewport);
  });
});
