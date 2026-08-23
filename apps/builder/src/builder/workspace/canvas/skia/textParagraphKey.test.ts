import { describe, expect, it } from "vitest";
import type { SkiaNodeData } from "./nodeRendererTypes";
import { getTextParagraphCacheKey } from "./textParagraphKey";

function makeTextNode(): SkiaNodeData {
  return {
    height: 40,
    text: {
      color: Float32Array.of(0, 0, 0, 1),
      content: "Parity",
      fontFamilies: ["Inter"],
      fontSize: 16,
      fontWeight: 400,
      maxWidth: 120,
      paddingLeft: 0,
      paddingTop: 0,
    },
    type: "text",
    visible: true,
    width: 120,
    x: 10,
    y: 20,
  };
}

describe("Skia retained text paragraph identity", () => {
  it("changes only the paragraph key when fixed Text metrics change", () => {
    const node = makeTextNode();
    const baseKey = getTextParagraphCacheKey(node);
    const baseRect = {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };

    node.text!.fontSize = 18;
    const sizeKey = getTextParagraphCacheKey(node);
    node.text!.fontWeight = 700;
    const weightKey = getTextParagraphCacheKey(node);

    expect(sizeKey).not.toBe(baseKey);
    expect(weightKey).not.toBe(sizeKey);
    expect({
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    }).toEqual(baseRect);
  });
});
