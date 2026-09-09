import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  createChartInitialProps,
  resolveToken,
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
for (const theme of ["light", "dark"] as const)
  for (const kind of ["area", "bar", "line", "pie", "radar", "radial"] as const)
    for (const size of [
      { width: 320, height: 240 },
      { width: 640, height: 360 },
    ])
      it(`${kind} ${theme} ${size.width}: 실제 CSS와 Skia 토큰·wrapper·원본 불변`, async () => {
        document.documentElement.setAttribute("data-theme", theme);
        const props = createChartInitialProps(kind);
        const before = JSON.stringify(props);
        Object.freeze(props.data);
        props.data.forEach(Object.freeze);
        const rule = COMPONENT_RULES_TABLE.Chart;
        const shapes = SKIA_PRIMITIVES.chart_scene({
          props: {
            ...props,
            _chartRule: rule.chart,
            _containerWidth: size.width,
            _containerHeight: size.height,
          },
          // chart_scene의 기존 dispatch와 같은 catalog size 객체를 전달한다.
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
        expect(shapes?.length).toBeGreaterThan(0);
        expect(JSON.stringify(shapes)).toContain(rule.chart!.series[0]);
        host = document.createElement("div");
        document.body.append(host);
        root = createRoot(host);
        root.render(
          <Chart {...props} size="md" isAnimationActive={false} style={size} />,
        );
        await vi.waitFor(() =>
          expect(host.querySelector(".recharts-surface")).toBeTruthy(),
        );
        const wrapper = host.querySelector<HTMLElement>(".react-aria-Chart")!;
        const probe = document.createElement("span");
        wrapper.append(probe);
        for (let i = 0; i < rule.chart!.series.length; i++) {
          probe.style.color = `var(--chart-series-${i + 1})`;
          const actual = rgba(getComputedStyle(probe).color);
          const expected = rgba(
            String(resolveToken(rule.chart!.series[i] as TokenRef, theme)),
          );
          actual.forEach((channel, index) =>
            expect(Math.abs(channel - expected[index])).toBeLessThanOrEqual(1),
          );
        }
        probe.remove();
        const svg = host
          .querySelector(".recharts-surface")!
          .getBoundingClientRect();
        const box = wrapper.getBoundingClientRect();
        expect(svg.width).toBe(size.width);
        expect(svg.height).toBe(size.height);
        expect(svg.x).toBe(box.x);
        expect(svg.y).toBe(box.y);
        expect(JSON.stringify(props)).toBe(before);
      });
