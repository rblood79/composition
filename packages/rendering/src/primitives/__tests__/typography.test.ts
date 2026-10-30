/**
 * ADR-295 — typography 토큰 = S2 단계 표 + 식 (ADR-916 R10 의 고정 행간 golden 을 대체).
 *
 * primitive typography.ts 는 Skia 경로 (resolveToken / getLabelLineHeight) 와 resolver `cssVars`
 * (Preview · Publish 의 `--text-*`) 가 공유하는 단일 맵이다. 전수 대조의 독립 oracle 은
 * typographyCssParity.test.ts (S2 설치본 computed) — 이 파일은 식 · 소비 계약의 대표값 앵커.
 */
import { describe, it, expect } from "vitest";

import {
  getLabelLineHeight,
  s2FontSize,
  s2LineHeight,
  s2TypographyTokens,
  typography,
} from "../typography";

describe("ADR-295 — typography S2 식", () => {
  it("글자 = round(14 × 1.125^단계): 본문 11 · 12 · 14 · 16 · 18 · 20 · 제목 18 · 20 · 22 · 28 · 36", () => {
    expect(
      ["text-2xs", "text-xs", "text-sm", "text-base", "text-lg", "text-xl"].map(
        (k) => typography[k as keyof typeof typography],
      ),
    ).toEqual([11, 12, 14, 16, 18, 20]);
    expect(
      [
        "text-heading-xs",
        "text-heading-sm",
        "text-heading-md",
        "text-heading-lg",
        "text-heading-xl",
      ].map((k) => typography[k as keyof typeof typography]),
    ).toEqual([18, 20, 22, 28, 36]);
  });

  it("S2 행간 식 (2px 반올림): 12 → 16 · 14 → 18 · 16 → 20 · 22 → 26 · 28 → 32 · 36 → 42 (S2 computed)", () => {
    expect([12, 14, 16, 22, 28, 36].map(s2LineHeight)).toEqual([
      16, 18, 20, 26, 32, 42,
    ]);
  });

  it("본문 행간은 Phase 3 전까지 지금 값 (사용자 결정 2026-10-30) · 제목 묶음은 식", () => {
    expect(typography["text-sm--line-height"]).toBe(20);
    expect(typography["text-base--line-height"]).toBe(24);
    expect(typography["text-heading-md--line-height"]).toBe(s2LineHeight(22));
  });

  it("touch base 17 은 같은 단계 표로 다른 벌을 낸다 (ADR-295 Phase 2 입력)", () => {
    const touch = s2TypographyTokens(17);
    expect(touch["text-sm"]).toBe(17);
    expect(s2FontSize(-1, 17)).toBe(15);
  });

  it("getLabelLineHeight 는 같은 글자 크기의 본문 토큰 행간 (Skia 소비 계약)", () => {
    expect(getLabelLineHeight(14)).toBe(typography["text-sm--line-height"]);
    expect(getLabelLineHeight(20)).toBe(typography["text-xl--line-height"]);
    expect(getLabelLineHeight(11)).toBe(typography["text-2xs--line-height"]);
    expect(getLabelLineHeight(13)).toBe(Math.ceil(13 * 1.5));
  });

});
