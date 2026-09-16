/**
 * PropertySegment CSS 정적 가드 — 글자 seg 의 ToggleButton 에 overflow:hidden 금지.
 *
 * RAC SelectionIndicator 는 버튼 안의 absolute 자식이라 버튼이 overflow 를 자르면 이전 버튼에서
 * 미끄러져 오는 동안 잘려 「닦여 나오는」 모양이 된다 (2026-09-16 — 아이콘 seg 는 Styles 처럼
 * 미끄러지는데 글자 seg 만 달랐던 원인). 말줄임은 콘텐츠 span 에만.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "");

describe("PropertySegment.css — 인디케이터 슬라이드를 자르는 overflow 금지", () => {
  it("ToggleButton 자신에는 overflow:hidden 이 없고, 말줄임은 > span 에만", async () => {
    const css = stripComments(
      await readFile(resolve(__dirname, "PropertySegment.css"), "utf-8"),
    );
    const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
      selector: m[1]!.trim(),
      body: m[2]!,
    }));
    const buttonBlocks = blocks.filter(
      (b) =>
        /\.react-aria-ToggleButton(?!\s*>)/.test(b.selector) &&
        !b.selector.includes("> span"),
    );
    expect(buttonBlocks.length).toBeGreaterThan(0);
    for (const b of buttonBlocks) {
      expect(b.body, b.selector).not.toMatch(/overflow\s*:\s*(hidden|clip|auto|scroll)/);
    }
    const spanBlock = blocks.find((b) =>
      b.selector.includes(".react-aria-ToggleButton > span"),
    );
    expect(spanBlock?.body).toMatch(/overflow\s*:\s*hidden/);
    expect(spanBlock?.body).toMatch(/text-overflow\s*:\s*ellipsis/);
  });
});
