import { describe, expect, it } from "vitest";
import { normalizeMiddleBaselineTextLineHeight } from "./specBuildHelpers";
import type { Shape } from "@composition/rendering";

describe("normalizeMiddleBaselineTextLineHeight", () => {
  it("injects sizeSpec lineHeight into middle-baseline text shapes", () => {
    const shapes = [
      {
        type: "text",
        text: "Button",
        x: 12,
        y: 0,
        fontSize: 14,
        baseline: "middle",
      },
    ] as Shape[];

    normalizeMiddleBaselineTextLineHeight(shapes, {
      lineHeight: 20,
    });

    expect(shapes[0].type).toBe("text");
    if (shapes[0].type !== "text") {
      throw new Error("unexpected shape type");
    }
    expect(shapes[0].lineHeight).toBe(20);
  });

  it("does not override an explicit shape lineHeight", () => {
    const shapes = [
      {
        type: "text",
        text: "Button",
        x: 12,
        y: 0,
        fontSize: 14,
        baseline: "middle",
        lineHeight: 24,
      },
    ] as Shape[];

    normalizeMiddleBaselineTextLineHeight(shapes, {
      lineHeight: 20,
    });

    expect(shapes[0].type).toBe("text");
    if (shapes[0].type !== "text") {
      throw new Error("unexpected shape type");
    }
    expect(shapes[0].lineHeight).toBe(24);
  });
});
