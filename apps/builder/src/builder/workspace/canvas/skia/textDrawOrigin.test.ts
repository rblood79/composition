import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkiaNodeData } from "./nodeRendererTypes";

const nodes = new Map<string, SkiaNodeData>();
let paragraph:
  | {
      getHeight: () => number;
      getMaxWidth: () => number;
      getAlphabeticBaseline: () => number;
      getLineMetrics: () => Array<{ left: number; baseline: number }>;
    }
  | undefined;

vi.mock("./useSkiaNode", () => ({
  getSkiaNode: (id: string) => nodes.get(id) ?? null,
}));
vi.mock("./retainedParagraph", () => ({
  peekRetainedParagraph: () => paragraph,
}));
vi.mock("./nodeRendererState", () => ({ getTextDrawOrigin: () => undefined }));

const { resolveTextEditBox } = await import("./textDrawOrigin");

/** A Badge's text node: the spec converter centres it with an explicit top and bottom padding. */
function badge(lines: number): SkiaNodeData {
  paragraph = {
    getHeight: () => 16 * lines,
    getMaxWidth: () => 38,
    getAlphabeticBaseline: () => 12.27,
    getLineMetrics: () =>
      Array.from({ length: lines }, () => ({ left: 0, baseline: 12.27 })),
  };
  return {
    type: "text",
    x: 0,
    y: 0,
    width: 56,
    height: 8 + 16 * lines,
    visible: true,
    text: {
      content: "Badge",
      fontFamilies: ["Pretendard"],
      fontSize: 12,
      fontWeight: 500,
      lineHeight: 16,
      color: new Float32Array([1, 1, 1, 1]),
      paddingLeft: 9,
      paddingTop: 4,
      paddingBottom: 4,
      maxWidth: 38,
      whiteSpace: "nowrap",
    },
  } as unknown as SkiaNodeData;
}

describe("resolveTextEditBox — the field sits where Skia drew the text", () => {
  beforeEach(() => nodes.clear());

  it("한 줄 · 명시 bottom padding: 줄 상자를 content 가운데 (Canvas `computeDrawY` 와 같은 자리)", () => {
    nodes.set("badge", badge(1));
    const box = resolveTextEditBox("badge")!;
    // Not by the glyphs' ink — the Canvas and the DOM both centre the line box (2026-11-02).
    expect(box.y).toBe(4);
    expect(box.height).toBe(16);
  });

  it("여러 줄도 줄 상자 중앙", () => {
    nodes.set("badge", badge(2));
    const box = resolveTextEditBox("badge")!;
    expect(box.y).toBe(4);
    expect(box.height).toBe(32);
  });
});
