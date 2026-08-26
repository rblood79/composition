/**
 * ADR-191 drift 게이트 — 커밋된 팔레트 산출물이 설치된 tailwindcss/theme.css 와 일치하는가.
 *
 * (a) 재생성 결과 == 커밋 파일 byte-diff 0 (G3)
 * (b) oklch→sRGB 변환이 Phase 0 브라우저 canvas 실측과 일치 (G1 샘플)
 * (c) 소비자가 기대하는 family × step 구조 유지
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  loadPaletteSource,
  renderOutputs,
  PALETTE_CSS_OUT,
  PALETTE_TS_OUT,
} from "../../../scripts/generate-palette";
import { cssColorToSrgbHex } from "../../../scripts/paletteGenerator";
import { TAILWIND_PALETTE } from "../generated/tailwindPalette";

describe("ADR-191 tailwind palette drift", () => {
  const source = loadPaletteSource();
  const { css, ts } = renderOutputs(source);

  it("생성 CSS 가 커밋된 산출물과 byte 단위로 같다 (재생성 필요 시 pnpm generate:palette)", () => {
    expect(readFileSync(PALETTE_CSS_OUT, "utf-8")).toBe(css);
  });

  it("생성 TS 가 커밋된 산출물과 byte 단위로 같다", () => {
    expect(readFileSync(PALETTE_TS_OUT, "utf-8")).toBe(ts);
  });

  it("oklch→sRGB 가 브라우저 canvas 실측 (2026-08-26) 과 일치한다", () => {
    // Phase 0 실측: gray-500 106,114,130 / blue-500 43,127,255 / green-400 5,223,114 (gamut clamp)
    expect(TAILWIND_PALETTE.gray[500]).toBe("#6a7282");
    expect(TAILWIND_PALETTE.blue[500]).toBe("#2b7fff");
    expect(TAILWIND_PALETTE.green[400]).toBe("#05df72");
    // hue none (무채색) — C=0 이라 H 무관
    expect(cssColorToSrgbHex("oklch(55.6% 0 none)")).toBe("#737373");
    expect(cssColorToSrgbHex("#fff")).toBe("#ffffff");
  });

  it("22 family × 11 step 구조를 유지한다 (Skia neutral 프리셋·catalog 가 의존)", () => {
    const families = Object.keys(TAILWIND_PALETTE);
    expect(families.length).toBeGreaterThanOrEqual(22);
    for (const family of [
      "slate",
      "gray",
      "zinc",
      "neutral",
      "stone",
      "blue",
      "purple",
      "green",
      "red",
    ]) {
      expect(families).toContain(family);
    }
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
    for (const family of families) {
      const record = TAILWIND_PALETTE[family as keyof typeof TAILWIND_PALETTE];
      expect(Object.keys(record).map(Number)).toEqual(steps);
    }
  });

  it("CSS 산출물은 plain CSS — Tailwind 전용 at-rule 없이 shared-tokens 레이어만 쓴다", () => {
    expect(css).not.toMatch(/@theme|@apply|@utility/);
    expect(css).toMatch(/^@layer shared-tokens \{/m);
    expect(css).toContain("--color-gray-500: oklch(55.1% 0.027 264.364);");
  });
});
