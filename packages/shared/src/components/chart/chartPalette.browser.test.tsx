/**
 * ADR-215 G1 — 팔레트 2 × 테마 2 × 시리즈 8: Preview `--chart-series-N` 해소값 == Skia 토큰 해소값.
 * `data-palette` 가 CSS 블록을 고르고, Skia 는 `resolveChartPalette` 로 같은 배열을 읽는다.
 * mono 는 `--chart-accent-N` (CSS `oklch(from var(--tint) …)`) ↔ colors.ts (`oklchToHex`, 기본 tint) — 채널 ±1.
 */
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  CHART_PALETTES,
  createChartInitialProps,
  resolveChartPalette,
  resolveToken,
  type ChartPalette,
  type TokenRef,
  type SizeSpec,
} from "@composition/specs";
import { SKIA_PRIMITIVES } from "@composition/specs/renderers";
import { COMPONENT_RULES_TABLE } from "../../catalog/generated/componentRulesTable";
import { Chart } from "../Chart";
import "../styles/theme/preview-system.css";
import "../styles/theme/shared-tokens.css";
import "../styles/theme/generated/tailwind-palette.css";
import "../styles/theme/generated/semantic-palette.css";
import "../styles/theme/generated/chart-palette.css";
import "../styles/generated/Chart.css";

let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  root?.unmount();
  host?.remove();
  document.documentElement.removeAttribute("data-theme");
});

function rgba(paint: string): number[] {
  const ctx = document.createElement("canvas").getContext("2d")!;
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, 1, 1);
  return Array.from(ctx.getImageData(0, 0, 1, 1).data);
}

const rule = COMPONENT_RULES_TABLE.Chart;

it("rule: palettes.* 길이 == series 길이 (순번 계약) · 기본 팔레트 = Spectrum categorical", () => {
  expect(rule.chart!.series).toEqual(
    Array.from({ length: 8 }, (_, i) => `{color.chart-categorical-${i + 1}}`),
  );
  for (const [id, tokens] of Object.entries(rule.chart!.palettes ?? {})) {
    expect(tokens.length, id).toBe(rule.chart!.series.length);
  }
  expect(resolveChartPalette(rule.chart, undefined)).toBe(rule.chart!.series);
  expect(resolveChartPalette(rule.chart, "categorical")).toBe(rule.chart!.series);
  expect(resolveChartPalette(rule.chart, "mono")).toBe(rule.chart!.palettes!.mono);
  expect(resolveChartPalette(rule.chart, "nope")).toBe(rule.chart!.series);
});

for (const theme of ["light", "dark"] as const)
  for (const palette of CHART_PALETTES as readonly ChartPalette[])
    it(`${palette} ${theme}: Skia 토큰 == Preview --chart-series-N (8 시리즈) · data-palette 속성`, async () => {
      document.documentElement.setAttribute("data-theme", theme);
      const props = { ...createChartInitialProps("bar"), palette };
      const tokens = resolveChartPalette(rule.chart, palette);
      const shapes = SKIA_PRIMITIVES.chart_scene({
        props: {
          ...props,
          _chartRule: rule.chart,
          _containerWidth: 320,
          _containerHeight: 240,
        },
        size: rule.sizes.md as SizeSpec,
        visual: undefined,
        paint: {
          backgroundColor: "{color.layer-1}",
          color: "{color.neutral}",
          borderColor: "{color.border}",
          backgroundAlpha: 1,
          staticTrackWash: false,
          hasVisibleBoxPaint: true,
          hasOpaqueCatalogBackground: true,
        },
        style: undefined,
      });
      const serialized = JSON.stringify(shapes);
      expect(serialized).toContain(tokens[0]);
      if (palette === "mono") expect(serialized).not.toContain("chart-categorical");

      host = document.createElement("div");
      document.body.append(host);
      root = createRoot(host);
      root.render(
        <Chart
          {...props}
          size="md"
          isAnimationActive={false}
          style={{ width: 320, height: 240 }}
        />,
      );
      await vi.waitFor(() =>
        expect(host.querySelector(".recharts-surface")).toBeTruthy(),
      );
      const wrapper = host.querySelector<HTMLElement>(".react-aria-Chart")!;
      expect(wrapper.getAttribute("data-palette")).toBe(
        palette === "categorical" ? null : palette,
      );
      const probe = document.createElement("span");
      wrapper.append(probe);
      for (let i = 0; i < tokens.length; i++) {
        probe.style.color = `var(--chart-series-${i + 1})`;
        const actual = rgba(getComputedStyle(probe).color);
        const expected = rgba(String(resolveToken(tokens[i] as TokenRef, theme)));
        actual.forEach((channel, index) =>
          expect(
            Math.abs(channel - expected[index]),
            `${palette} ${theme} series ${i + 1}: css ${actual} vs skia ${expected}`,
          ).toBeLessThanOrEqual(1),
        );
      }
      probe.remove();
    });
