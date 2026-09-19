import { describe, expect, it } from "vitest";
import type { CanvasKit, FontMgr, ParagraphStyle } from "canvaskit-wasm";
import { cssNormalBreakProcess } from "../textWrapUtils";

/**
 * ADR-027 후속 5 — pre-wrap Text 의 `\n` 은 hard break. 종전 `cssNormalBreakProcess` 는 `/\s+/` 로
 * 나눠 `\n` 을 삼켰다 (사용자 live: 첫 조각이 폭을 넘자 Skia 가 7 조각을 5줄로 다시 접었다 —
 * 상자·Preview 는 8줄). 글리프 폭 10px 고정 · 공백 10px 인 가짜 CanvasKit.
 */
const fakeCk = {
  ParagraphBuilder: {
    Make: () => {
      let text = "";
      return {
        addText: (t: string) => {
          text += t;
        },
        build: () => ({
          layout: () => {},
          getMaxIntrinsicWidth: () => text.length * 10,
          delete: () => {},
        }),
        delete: () => {},
      };
    },
  },
} as unknown as CanvasKit;
const ps = {} as ParagraphStyle;
const fm = {} as FontMgr;

describe("cssNormalBreakProcess — hard break 보존", () => {
  it("조각마다 따로 접고 `\\n` 으로 잇는다", () => {
    // 폭 150 = 15 글자. "ABCDEFG ABCDEFG ABCDEFG" (23) 는 2줄, 나머지 조각은 1줄.
    const r = cssNormalBreakProcess(
      fakeCk,
      ps,
      fm,
      "ABCDEFG ABCDEFG ABCDEFG\n12345\n\nEND",
      150,
    );
    expect(r.text).toBe("ABCDEFG ABCDEFG\nABCDEFG\n12345\n\nEND");
    expect(r.effectiveWidth).toBe(150);
  });

  it("`\\n` 없는 텍스트는 종전 그대로 (폭 안이면 원문)", () => {
    expect(cssNormalBreakProcess(fakeCk, ps, fm, "ABC DEF", 150).text).toBe(
      "ABC DEF",
    );
  });
});
