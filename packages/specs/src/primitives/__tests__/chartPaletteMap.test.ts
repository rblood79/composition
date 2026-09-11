/**
 * ADR-215 — Chart 팔레트 표 (categorical 리터럴 · accent 명도 사다리) 의 세 consumer 가 같은 표를 읽는지.
 * G3 정적 조건 일부: 토큰 12 가 colors.ts · tokenResolver 에 있고, 생성 CSS 가 표의 hex 를 그대로 낸다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderChartPaletteCss } from "../../../scripts/paletteGenerator";
import {
  CHART_ACCENT_DEFAULT_HEX,
  CHART_ACCENT_STEPS,
  CHART_ACCENT_TOKENS,
  CHART_CATEGORICAL_COUNT,
  CHART_CATEGORICAL_HEX,
  CHART_CATEGORICAL_TOKENS,
  chartCategoricalCssVar,
} from "../chartPaletteMap";
import { darkColors, lightColors } from "../colors";
import { tokenToCSSVar } from "../../renderers/utils/tokenResolver";
import type { TokenRef } from "../../types/token.types";

const generatedCss = readFileSync(
  resolve(
    __dirname,
    "../../../../shared/src/components/styles/theme/generated/chart-palette.css",
  ),
  "utf-8",
);

describe("ADR-215 chartPaletteMap — 표 하나, consumer 셋", () => {
  it("categorical 8 = Spectrum 1 categorical-100..800 (RSC spectrumColors.ts) — 순서 고정", () => {
    expect(CHART_CATEGORICAL_COUNT).toBe(8);
    expect(CHART_CATEGORICAL_HEX).toEqual([
      "#0fb5ae",
      "#4046ca",
      "#f68511",
      "#de3d82",
      "#7e84fa",
      "#72e06a",
      "#147af3",
      "#7326d3",
    ]);
  });

  it("colors.ts 는 light/dark 모두 표의 값 (테마 공용)", () => {
    CHART_CATEGORICAL_TOKENS.forEach((token, i) => {
      expect(lightColors[token]).toBe(CHART_CATEGORICAL_HEX[i]);
      expect(darkColors[token]).toBe(CHART_CATEGORICAL_HEX[i]);
    });
    CHART_ACCENT_TOKENS.forEach((token, i) => {
      expect(lightColors[token]).toBe(CHART_ACCENT_DEFAULT_HEX[i]);
      expect(darkColors[token]).toBe(CHART_ACCENT_DEFAULT_HEX[i]);
    });
  });

  it("tokenResolver 는 토큰 12 를 자기 CSS var 로 푼다", () => {
    CHART_CATEGORICAL_TOKENS.forEach((token, i) => {
      expect(tokenToCSSVar(`{color.${token}}` as TokenRef)).toBe(
        `var(${chartCategoricalCssVar(i)})`,
      );
    });
    CHART_ACCENT_TOKENS.forEach((token, i) => {
      expect(tokenToCSSVar(`{color.${token}}` as TokenRef)).toBe(
        `var(--chart-accent-${i + 1})`,
      );
    });
  });

  it("생성 chart-palette.css == 표 (drift 0) — :root 1블록, dark 없음, hex 그대로", () => {
    expect(generatedCss).toBe(renderChartPaletteCss());
    expect(generatedCss).not.toContain('[data-theme="dark"]');
    CHART_CATEGORICAL_HEX.forEach((hex, i) => {
      expect(generatedCss).toContain(`${chartCategoricalCssVar(i)}: ${hex};`);
    });
  });

  it("accent 사다리는 명도 오름차순 4단, 2단이 --accent 의 L 55%", () => {
    const L = CHART_ACCENT_STEPS.map((s) => s.lightness);
    expect(L).toEqual([...L].sort((a, b) => a - b));
    expect(CHART_ACCENT_STEPS[1]).toEqual({ lightness: 0.55, chromaFactor: 1 });
    expect(CHART_ACCENT_STEPS.every((s) => s.chromaFactor <= 1)).toBe(true);
  });
});
