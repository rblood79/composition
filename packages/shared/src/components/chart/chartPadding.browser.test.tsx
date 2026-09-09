import { createRoot, type Root } from "react-dom/client";
import type { CSSProperties } from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  computeChartScene,
  createChartInitialProps,
  type PathMark,
  type RectMark,
  type SizeSpec,
} from "@composition/specs";
import { SKIA_PRIMITIVES } from "@composition/specs/renderers";
import { COMPONENT_RULES_TABLE } from "../../catalog/generated/componentRulesTable";
import { Chart } from "../Chart";
import { compareBoundaries } from "./chartBoundaryOracle";
import "../styles/generated/Chart.css";

let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
});

const selectors = {
  area: ".recharts-area-area",
  bar: ".recharts-bar-rectangle path",
  line: ".recharts-line-curve",
  pie: ".recharts-pie-sector path",
  radar: ".recharts-radar-polygon path",
  radial:
    "path.recharts-radial-bar-sector, path.recharts-radial-bar-background-sector",
};
const cases: Array<{
  style: CSSProperties;
  padding: { top: number; right: number; bottom: number; left: number };
}> = [
  {
    style: { padding: 24 },
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
  },
  {
    style: { padding: "48px" },
    padding: { top: 48, right: 48, bottom: 48, left: 48 },
  },
  {
    style: {
      paddingTop: 0,
      paddingRight: 36,
      paddingBottom: 20,
      paddingLeft: 60,
    },
    padding: { top: 0, right: 36, bottom: 20, left: 60 },
  },
  {
    style: { paddingLeft: 40 },
    padding: { top: 12, right: 12, bottom: 12, left: 40 },
  },
  { style: {}, padding: { top: 12, right: 12, bottom: 12, left: 12 } },
];

for (const kind of Object.keys(selectors) as Array<keyof typeof selectors>) {
  it(`${kind}: 같은 크기에서 padding 편집·4방향·초기화가 Canvas와 runtime에 반영된다`, async () => {
    const props = {
      ...createChartInitialProps(kind),
      showDots: false,
      showValueLabels: false,
      isAnimationActive: false,
    };
    const size = { width: 320, height: 240 };
    const rule = COMPONENT_RULES_TABLE.Chart;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);

    for (const { style, padding } of cases) {
      // 입력 style 해석과 독립적으로 기대 여백을 지정한다.
      const expected = computeChartScene(props, props.data, size, {
        ...CHART_DEFAULT_METRICS,
        padding,
      });
      const shapes = SKIA_PRIMITIVES.chart_scene({
        props: {
          ...props,
          _chartRule: rule.chart,
          _containerWidth: size.width,
          _containerHeight: size.height,
        },
        size: rule.sizes.md as SizeSpec,
        visual: undefined,
        paint: {
          backgroundAlpha: 1,
          staticTrackWash: false,
          hasVisibleBoxPaint: true,
          hasOpaqueCatalogBackground: true,
        },
        style: { ...style },
      })!;
      const marks = expected.marks.filter(
        (mark): mark is PathMark | RectMark =>
          mark.kind === "path" || mark.kind === "rect",
      );
      for (const mark of marks) {
        if (mark.kind === "path")
          expect(shapes).toContainEqual(
            expect.objectContaining({ type: "path", d: mark.d }),
          );
        else
          expect(shapes).toContainEqual(
            expect.objectContaining({
              type: "rect",
              x: mark.x,
              y: mark.y,
              width: mark.w,
              height: mark.h,
            }),
          );
      }
      root.render(<Chart {...props} size="md" style={{ ...size, ...style }} />);
      await vi.waitFor(() => {
        const paths = Array.from(
          host.querySelectorAll<SVGPathElement>(selectors[kind]),
        );
        expect(paths).toHaveLength(marks.length);
        const remaining = [...marks];
        for (const path of paths) {
          const distances = remaining.map((mark) =>
            compareBoundaries(path, mark),
          );
          const closest = Math.min(...distances);
          expect(closest).toBeLessThanOrEqual(1);
          remaining.splice(distances.indexOf(closest), 1);
        }
      });
    }
  });
}
