/**
 * ADR-215 — generate-css 의 `chart.palettes` emit: `.react-aria-X[data-palette="id"] { --chart-series-N }`.
 * DOM 은 `data-palette` 속성만 바꾸고, Skia 는 `resolveChartPalette` 로 같은 배열을 읽는다.
 */
import { describe, expect, it } from "vitest";
import type { ComponentSpec } from "../../types/spec.types";
import type { TokenRef } from "../../types/token.types";
import { generateCSS } from "../CSSGenerator";

const spec: ComponentSpec<{ variant?: string }> = {
  name: "FakeChart",
  archetype: "text",
  element: "div",
  defaultVariant: "default",
  defaultSize: "md",
  variants: {
    default: {
      fill: { default: { base: "{color.layer-1}" as TokenRef } },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
  },
  sizes: {
    md: {
      height: 240,
      paddingX: 12,
      paddingY: 12,
      fontSize: 14 as unknown as TokenRef,
      borderRadius: 6 as unknown as TokenRef,
      borderWidth: 1,
    },
  },
  states: {},
  render: { shapes: () => [], react: () => ({}) },
  chart: {
    series: ["{color.chart-categorical-1}", "{color.chart-categorical-2}"],
    palettes: {
      mono: ["{color.chart-accent-1}", "{color.chart-accent-2}"],
    },
    axis: "{color.neutral-subdued}",
    grid: "{color.border}",
  },
};

describe("generateCSS — chart.palettes → [data-palette] 블록 (ADR-215)", () => {
  const css = generateCSS(spec);

  it("기본 블록은 series, 대안 블록은 같은 --chart-series-N 을 덮는다", () => {
    expect(css).toContain(".react-aria-FakeChart {");
    expect(css).toContain("--chart-series-1: var(--chart-categorical-1);");
    expect(css).toContain('.react-aria-FakeChart[data-palette="mono"] {');
    const mono = css.split('[data-palette="mono"]')[1];
    expect(mono).toContain("--chart-series-1: var(--chart-accent-1);");
    expect(mono).toContain("--chart-series-2: var(--chart-accent-2);");
  });

  it("palettes 가 없으면 [data-palette] 블록 0", () => {
    const { palettes: _drop, ...chart } = spec.chart!;
    expect(generateCSS({ ...spec, chart })).not.toContain("data-palette");
  });
});
