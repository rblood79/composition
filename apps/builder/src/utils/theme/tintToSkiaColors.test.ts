/**
 * ADR-215 — mono 팔레트 (accent 명도 사다리) 의 Skia 쪽 계산이 chartPaletteMap 표와 맞는지.
 * CSS `--chart-accent-N: oklch(from var(--tint) L calc(c × f) h)` 와 같은 (L, f) 를 쓰는 것이 대칭 조건이다.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_ACCENT_DEFAULT_HEX,
  CHART_ACCENT_TOKENS,
  lightColors,
} from "@composition/specs";
import { resolveAccentColorTokens, TINT_PRESETS } from "./tintToSkiaColors";
import { oklchToHex } from "./oklchToHex";

describe("tintToSkiaColors — chart-accent 사다리", () => {
  it("기본 tint (blue) 공식 == chartPaletteMap 초기값 (colors.ts 와 같은 hex)", () => {
    const blue = resolveAccentColorTokens("blue", "light")!;
    CHART_ACCENT_TOKENS.forEach((token, i) => {
      expect(blue[token]).toBe(CHART_ACCENT_DEFAULT_HEX[i]);
      expect(lightColors[token]).toBe(CHART_ACCENT_DEFAULT_HEX[i]);
    });
  });

  it("2단 == accent 자체 (L 55%) · tint 를 바꾸면 4단이 전부 그 hue 를 따라간다", () => {
    for (const tint of ["blue", "pink"] as const) {
      const tokens = resolveAccentColorTokens(tint, "light")!;
      expect(tokens["chart-accent-2"]).toBe(tokens.accent);
      const { h, c } = TINT_PRESETS[tint];
      expect(tokens["chart-accent-1"]).toBe(oklchToHex(0.4, c, h));
      expect(tokens["chart-accent-4"]).toBe(oklchToHex(0.85, c * 0.5, h));
    }
    expect(resolveAccentColorTokens("pink", "light")!["chart-accent-1"]).not.toBe(
      resolveAccentColorTokens("blue", "light")!["chart-accent-1"],
    );
  });

  it("light / dark 같은 값 (accent 가 테마 불변인 규칙과 같다)", () => {
    const l = resolveAccentColorTokens("blue", "light")!;
    const d = resolveAccentColorTokens("blue", "dark")!;
    for (const token of CHART_ACCENT_TOKENS) expect(l[token]).toBe(d[token]);
  });
});
