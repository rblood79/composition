/**
 * ADR-191 Phase 2 — Skia 색 파서가 Tailwind v4 theme.css 의 무채색 표기(`oklch(L% 0 none)`)를 받는다.
 *
 * 팔레트 정의 원천이 theme.css 로 단일화되면서 Builder DOM 의 neutral 계열 토큰(`--border`, `--fg-muted` …)이
 * `oklch(87% 0 none)` 형식으로 도달한다. `none` 은 CSS Color 4 의 결측 성분(= 0)인데 parseFloat 는 NaN 을
 * 내므로 fallback 색으로 조용히 떨어졌다 — 회귀 고정.
 */
import { describe, expect, it } from "vitest";
import { cssColorToHex } from "../styleConverter";

const FALLBACK = 0xff00ff;

describe("cssColorToHex — oklch `none` 성분", () => {
  it("무채색 `oklch(L% 0 none)` 을 hue 0 과 동일하게 해석한다", () => {
    // neutral-700 / neutral-300 (tailwindcss@4.3.3 theme.css) — sRGB #404040 / #d4d4d4
    expect(cssColorToHex("oklch(37.1% 0 none)", FALLBACK)).toBe(0x404040);
    expect(cssColorToHex("oklch(87% 0 none)", FALLBACK)).toBe(0xd4d4d4);
    expect(cssColorToHex("oklch(37.1% 0 none)", FALLBACK)).toBe(
      cssColorToHex("oklch(37.1% 0 0)", FALLBACK),
    );
  });

  it("유채색 oklch 는 기존대로 파싱된다 (gray-500 → canvas 실측 106,114,130)", () => {
    expect(cssColorToHex("oklch(55.1% 0.027 264.364)", FALLBACK)).toBe(
      0x6a7282,
    );
  });

  it("파싱 불가 문자열은 여전히 fallback", () => {
    expect(cssColorToHex("oklch(garbage)", FALLBACK)).toBe(FALLBACK);
  });
});
