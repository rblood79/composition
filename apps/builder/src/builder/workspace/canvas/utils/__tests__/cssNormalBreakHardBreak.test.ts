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

  // 2026-09-20 sweep — 한글 연속은 음절 사이가 break 기회 (힌트 경로와 같은 토큰화).
  it("한글 연속은 음절 단위로 접는다 (폭 30 = 3자)", () => {
    const r = cssNormalBreakProcess(fakeCk, ps, fm, "가나다라마바사", 30);
    expect(r.text).toBe("가나다\n라마바\n사");
    expect(r.effectiveWidth).toBe(30);
  });

  it("구두점은 앞 토큰에 붙고 공백은 줄 끝에 hang 한다", () => {
    // "Hello, World" 폭 60 = 6자: "Hello," (6) 가 한 줄, 줄 끝 공백은 hang (버림), "World" 다음 줄.
    const r = cssNormalBreakProcess(fakeCk, ps, fm, "Hello, World", 60);
    expect(r.text).toBe("Hello,\nWorld");
  });

  it("wordSpacing 은 공백 토큰에 직접 더한다 (skparagraph 는 줄 첫 공백에 안 준다)", () => {
    const psWs = { textStyle: { wordSpacing: 10 } } as unknown as ParagraphStyle;
    // "AB CD EF" (fake 80 > 55 라 early exit 없음). wordSpacing 0: "AB CD" 50 ≤ 55 → 2줄.
    //   wordSpacing 10: AB 20 + 공백 (10 + 10) + CD 20 = 60 > 55 → 3줄.
    expect(cssNormalBreakProcess(fakeCk, ps, fm, "AB CD EF", 55).text).toBe(
      "AB CD\nEF",
    );
    expect(cssNormalBreakProcess(fakeCk, psWs, fm, "AB CD EF", 55).text).toBe(
      "AB\nCD\nEF",
    );
  });
});
