/**
 * ADR-215 — Chart 팔레트 표 (categorical 리터럴 · accent 사다리 단) 의 consumer 가 같은 표를 읽는지.
 * G3 정적 조건 일부: 토큰 12 가 colors.ts · tokenResolver 에 있고, 생성 CSS 가 표의 hex 를 그대로 낸다.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderChartPaletteCss } from "../../../scripts/paletteGenerator";
import {
  CHART_ACCENT_TOKENS,
  CHART_CATEGORICAL_COUNT,
  CHART_CATEGORICAL_HEX,
  CHART_CATEGORICAL_TOKENS,
  chartCategoricalCssVar,
} from "../chartPaletteMap";
import { darkColors, lightColors } from "../colors";
import { COLOR_ALIASES } from "../colorAliases";
import { SPECTRUM_LADDERS } from "../generated/spectrumLadders";
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

  it("colors.ts — categorical 은 표의 값 (테마 공용), accent 는 alias 표의 accent 사다리 단 (ADR-302 결정 6)", () => {
    CHART_CATEGORICAL_TOKENS.forEach((token, i) => {
      expect(lightColors[token]).toBe(CHART_CATEGORICAL_HEX[i]);
      expect(darkColors[token]).toBe(CHART_CATEGORICAL_HEX[i]);
    });
    CHART_ACCENT_TOKENS.forEach((token) => {
      const entry = COLOR_ALIASES[token]!;
      expect(entry.axis).toBe("accent");
      expect(lightColors[token]).toBe(
        SPECTRUM_LADDERS.blue.light[entry.light as number],
      );
      expect(darkColors[token]).toBe(
        SPECTRUM_LADDERS.blue.dark[entry.dark as number],
      );
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

  it("accent 4 단은 짙은 → 옅은 순서 (alias 단 내림차순)", () => {
    const steps = CHART_ACCENT_TOKENS.map((t) => COLOR_ALIASES[t]!.light as number);
    expect(steps).toEqual([...steps].sort((a, b) => b - a));
  });
});
