import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveSingleLineGlyphTop } from "../textGlyphCentering";

/**
 * 단일행 글리프 중앙 배치 — 스크립트와 무관하게 alphabetic baseline 기준 (ADR-027 D3, 2026-09-20).
 * 16px Pretendard · line 24 (baseline 17.69 · descent 6.31) · 한글 ink ascent ≈ 14 · 높이 ≈ 16:
 *   글리프 top 은 (24 − 16) / 2 = 4, paragraph top = 4 − (17.69 − 14) = 0.31 (≈ 0, line box 안).
 *   종전 ideographic 원점 (24) 은 4 − (24 − 14) = −6 → descent 만큼 위.
 */
describe("resolveSingleLineGlyphTop", () => {
  const line = { contentTop: 0, contentHeight: 24, alphabeticBaseline: 17.6875 };

  it("한글 ink (ascent 14 · 높이 16) 도 alphabetic baseline 으로 → paragraph top ≈ 0", () => {
    const y = resolveSingleLineGlyphTop({ ...line, inkAscent: 14, inkHeight: 16 });
    expect(y).toBeCloseTo(0.31, 2);
    expect(y).toBeGreaterThan(-1);
  });

  it("Latin ink — 종전과 같은 식 (Button 20px content · 14px 폰트)", () => {
    // 글리프 top 을 content 가운데 (5 + (20 − 10) / 2 = 10) 에 두고 baseline − ascent 만큼 올린다.
    const y = resolveSingleLineGlyphTop({
      contentTop: 5,
      contentHeight: 20,
      alphabeticBaseline: 14.9765625,
      inkAscent: 10,
      inkHeight: 10,
    });
    expect(y).toBeCloseTo(10 - (14.9765625 - 10), 6);
  });

  it("ink 가 content 보다 크면 content top 에 붙인다 (음수 여백 0)", () => {
    const y = resolveSingleLineGlyphTop({ ...line, inkAscent: 20, inkHeight: 30 });
    expect(y).toBeCloseTo(2.3125, 3);
  });
});

describe("nodeRendererText 는 ideographic baseline 원점을 쓰지 않는다 (static)", () => {
  it("getIdeographicBaseline / containsIdeographicText 호출 0", () => {
    const source = readFileSync(
      resolve(__dirname, "../nodeRendererText.ts"),
      "utf8",
    );
    expect(source).not.toContain("getIdeographicBaseline");
    expect(source).not.toContain("containsIdeographicText(");
    expect(source).toContain("resolveSingleLineGlyphTop(");
  });
});
