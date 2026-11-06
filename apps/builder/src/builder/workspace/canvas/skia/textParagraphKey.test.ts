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
  it("동일한 서체에서도 locale 변경은 기존 조판을 재사용하지 않는다", () => {
    const node = makeTextNode();
    node.text!.locale = "en-US";
    const before = getTextParagraphCacheKey(node);
    node.text!.locale = "ko-KR";
    expect(getTextParagraphCacheKey(node)).not.toBe(before);
  });

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
