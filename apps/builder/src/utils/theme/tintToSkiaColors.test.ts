/**
 * ADR-302 — accent 사다리 (생성) 와 chart-accent. chart-accent 1 ~ 4 는 accent 사다리의 단 (1200 · 900 · 700 ·
 * 400, 사용자 결정 6) 이라 tint 를 바꾸면 그 hue 를 따라간다. 기본 tint (blue) 는 Spectrum blue 사다리 그대로.
 */
import { describe, expect, it } from "vitest";
import {
  CHART_ACCENT_TOKENS,
  COLOR_ALIASES,
  SPECTRUM_LADDERS,
} from "@composition/rendering";
import { TINT_PRESETS } from "./tintToSkiaColors";
import { hexToOklch } from "./oklchToHex";
import {
  buildThemeColors,
  generateLadder,
} from "../../../../../packages/shared/src/catalog/runtime/ladderGenerate";

const MODES = ["light", "dark"] as const;

describe("ADR-302 accent 사다리 — chart-accent", () => {
  it("축 입력이 없으면 Spectrum blue 사다리 그대로 (기본 preset = seed)", () => {
    const out = buildThemeColors({});
    for (const mode of MODES) {
      expect(out.ladders.accent[mode]).toBe(SPECTRUM_LADDERS.blue[mode]);
      expect(out.failures).toEqual([]);
    }
  });

  it("chart-accent N = 생성 accent 사다리의 alias 단 · pink 는 blue 와 다르다", () => {
    const pink = buildThemeColors({ accent: TINT_PRESETS.pink });
    const blue = buildThemeColors({});
    for (const mode of MODES)
      for (const token of CHART_ACCENT_TOKENS) {
        const step = COLOR_ALIASES[token]![mode] as number;
        expect(pink[mode][token]).toBe(pink.ladders.accent[mode][step]);
        expect(pink[mode][token]).not.toBe(blue[mode][token]);
      }
  });
});

describe("ADR-302 생성식 — 기준 사다리 모양 유지", () => {
  it("단 순서대로 명도 방향이 기준과 같고 (light 감소 · dark 증가) hue 는 입력 hue", () => {
    for (const mode of MODES) {
      const gray = SPECTRUM_LADDERS.gray[mode];
      const ladder = generateLadder({
        ref: SPECTRUM_LADDERS.blue[mode],
        refBg: gray[25]!,
        bg: gray[25]!,
        ...TINT_PRESETS.green,
        mode,
      });
      const ls = Object.keys(ladder)
        .map(Number)
        .sort((a, b) => a - b)
        .map((step) => hexToOklch(ladder[step]!)!.l);
      for (let i = 1; i < ls.length; i++)
        if (mode === "light") expect(ls[i]!).toBeLessThanOrEqual(ls[i - 1]!);
        else expect(ls[i]!).toBeGreaterThanOrEqual(ls[i - 1]!);
      const mid = hexToOklch(ladder[900]!)!;
      expect(Math.abs(mid.h - TINT_PRESETS.green.h)).toBeLessThan(6);
    }
  });
});
