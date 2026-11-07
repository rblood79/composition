/**
 * ADR-193 semanticPaletteMap — 변수 표 (cssVar · hook) 의 계약.
 *
 * ADR-302 (2026-11-08): 값은 표의 Tailwind 좌표가 아니라 alias 표 × Spectrum 사다리 (seed) 다 — colors.ts 전 키
 * 스냅샷 · 「표 값으로 파생」 단언은 G1 (`packages/shared/.../adr302SpectrumOracle.static.test.ts`, design-data
 * oracle) 로 옮겼다. 여기는 변수 이름 계약과 Skia 결손 행만 남는다. 표 자체는 Phase 2 에서 지운다.
 */
import { describe, expect, it } from "vitest";
import { darkColors, lightColors } from "../colors";
import { SEMANTIC_PALETTE_MAP } from "../semanticPaletteMap";

describe("ADR-193 semanticPaletteMap — 변수 표", () => {
  it("cssVar 는 전부 유일하고 status(-subtle/-strong 포함) 는 --{token}, named hue 는 --hue- 접두 (tint preset --indigo 류와 충돌 금지), hook 은 negative 만", () => {
    const vars = Object.values(SEMANTIC_PALETTE_MAP).map((e) => e.cssVar);
    expect(new Set(vars).size).toBe(vars.length);
    const STATUS = ["negative", "informative", "positive", "notice"];
    for (const [token, entry] of Object.entries(SEMANTIC_PALETTE_MAP)) {
      const base = token.replace(/-(subtle|strong)$/, "");
      if (STATUS.includes(base)) {
        expect(entry.cssVar, token).toBe(`--${token}`);
      } else {
        expect(entry.cssVar, token).toMatch(/^--hue-/);
      }
      if (token === "negative") {
        expect((entry as { hook?: string }).hook).toBe("--color-invalid");
      } else {
        expect((entry as { hook?: string }).hook).toBeUndefined();
      }
    }
  });

  it("Skia 결손 행 (Badge gray 캔버스 비가시) 이 닫혔다 — gray / green-named 가 undefined 가 아니다", () => {
    for (const k of [
      "gray",
      "gray-subtle",
      "green-named",
      "green-named-subtle",
    ] as const) {
      expect(lightColors[k]).toMatch(/^#/);
      expect(darkColors[k]).toMatch(/^#/);
    }
    // ADR-302: gray = Spectrum gray-background (700 · 500), green-named = green-background (900 · 800)
    expect(lightColors.gray).toBe("#505050");
    expect(darkColors.gray).toBe("#6d6d6d");
    expect(lightColors["green-named"]).toBe("#05834e");
  });
});
