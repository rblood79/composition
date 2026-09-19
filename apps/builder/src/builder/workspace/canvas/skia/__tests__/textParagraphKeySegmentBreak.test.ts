import { describe, expect, it } from "vitest";
import { getTextParagraphCacheKey } from "../textParagraphKey";
import type { SkiaNodeData } from "../nodeRendererTypes";

/**
 * ADR-027 후속 — normal 의 `\n` 은 공백으로 접힌 문단이 retained paragraph 의 정체성이다.
 * 렌더 (`renderText`) 와 키가 같은 `collapseTextWhiteSpace` 를 읽는다 — 안 그러면 `\n` 만 다른
 * 두 문서가 다른 키로 두 문단을 만든다 (또는 반대로 같은 키에 다른 그림).
 */
function node(content: string, whiteSpace?: string): SkiaNodeData {
  return {
    id: "t",
    rect: { x: 0, y: 0, width: 200, height: 24 },
    text: {
      content,
      whiteSpace,
      maxWidth: 200,
      fontFamilies: ["Pretendard"],
      fontSize: 16,
      color: new Float32Array([0, 0, 0, 1]),
    },
  } as unknown as SkiaNodeData;
}

describe("getTextParagraphCacheKey — segment break", () => {
  it("normal: `가\\n나` 와 `가 나` 는 같은 문단", () => {
    expect(getTextParagraphCacheKey(node("가\n나", "normal"))).toBe(
      getTextParagraphCacheKey(node("가 나", "normal")),
    );
    expect(getTextParagraphCacheKey(node("가\n나"))).toBe(
      getTextParagraphCacheKey(node("가 나")),
    );
  });

  it("pre-wrap: `\\n` 은 hard break 라 다른 문단", () => {
    expect(getTextParagraphCacheKey(node("가\n나", "pre-wrap"))).not.toBe(
      getTextParagraphCacheKey(node("가 나", "pre-wrap")),
    );
  });

  it("renderText 와 키가 같은 함수를 읽는다 (정적)", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    // renderText 가 한 번 접은 processedText 를 키 빌더에 넘긴다 — 키 빌더 단독 호출은 같은 함수로 접는다
    const renderSrc = await readFile(
      resolve(__dirname, "../nodeRendererText.ts"),
      "utf8",
    );
    expect(renderSrc).toContain(
      "collapseTextWhiteSpace(node.text.content, whiteSpace)",
    );
    expect(renderSrc).toContain(
      "getTextParagraphCacheKey(node, processedText)",
    );
    const keySrc = await readFile(
      resolve(__dirname, "../textParagraphKey.ts"),
      "utf8",
    );
    expect(keySrc).toContain("processedText: string = collapseTextWhiteSpace(");
    for (const src of [renderSrc, keySrc]) {
      expect(src).not.toContain('replace(/[ \\t]+/g, " ")');
    }
  });
});
