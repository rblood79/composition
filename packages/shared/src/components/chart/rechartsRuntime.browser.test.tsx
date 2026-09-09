import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  CHART_DESCRIPTORS,
  computeChartScene,
  createChartInitialProps,
  type ChartProps,
  type PathMark,
  type RectMark,
} from "@composition/specs";
import { RechartsChart } from "./RechartsChart";
import { compareBoundaries } from "./chartBoundaryOracle";

let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
});
const size = { width: 320, height: 240 };
const rows = [
  { category: "A", value: 10, series: "one" },
  { category: "B", value: 40, series: "one" },
  { category: "C", value: 20, series: "one" },
  { category: "A", value: 30, series: "two" },
  { category: "B", value: 10, series: "two" },
  { category: "C", value: 20, series: "two" },
];
const selector = {
  bar: ".recharts-bar-rectangle path",
  line: ".recharts-line-curve",
  area: ".recharts-area-area",
  pie: ".recharts-pie-sector path",
  radar: ".recharts-radar-polygon path",
  radial:
    "path.recharts-radial-bar-sector, path.recharts-radial-bar-background-sector",
};
async function check(patch: Partial<ChartProps>, source = rows) {
  const props = {
    ...CHART_DEFAULT_PROPS,
    color: "series",
    ...patch,
    isAnimationActive: false,
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <RechartsChart
      props={props}
      rows={source}
      size={size}
      metrics={CHART_DEFAULT_METRICS}
      label="Test chart"
    />,
  );
  const scene = computeChartScene(props, source, size);
  const expected = scene.marks.filter(
    (mark): mark is PathMark | RectMark =>
      (mark.kind === "path" || mark.kind === "rect") &&
      !(
        mark.kind === "path" &&
        mark.fillSeries !== undefined &&
        !mark.strokeSeries &&
        mark.d.includes(" A ") &&
        props.showDots
      ),
  );
  const wanted = expected.filter(
    (mark) =>
      !(
        props.showDots &&
        mark.kind === "path" &&
        mark.d.includes(" A ") &&
        ["area", "line", "radar"].includes(props.chartType)
      ),
  );
  await vi.waitFor(() =>
    expect(host.querySelectorAll(selector[props.chartType]).length).toBe(
      wanted.length,
    ),
  );
  const actual = Array.from(
    host.querySelectorAll<SVGPathElement>(selector[props.chartType]),
  );
  const actualLabels = Array.from(host.querySelectorAll<SVGTextElement>("svg text")).filter((text) => !text.closest("[data-chart-decoration]"));
  expect(actualLabels.length, `value label count ${props.chartType}`).toBe(scene.marks.filter((mark) => mark.kind === "text").length);
  const remainingLabels = [...scene.marks.filter((mark) => mark.kind === "text")];
  for (const text of actualLabels) {
    const at = remainingLabels.findIndex((label) => label.text === text.textContent &&
      Math.abs(label.x - Number(text.getAttribute("x"))) <= 1 && Math.abs(label.y - Number(text.getAttribute("y"))) <= 1);
    expect(at, JSON.stringify({type: props.chartType, text: text.outerHTML, expected: remainingLabels})).toBeGreaterThanOrEqual(0);
    remainingLabels.splice(at, 1);
  }
  const remaining = [...wanted];
  const deltas = actual.map((path) => {
    const distances = remaining.map((mark) => compareBoundaries(path, mark));
    const best = Math.min(...distances);
    remaining.splice(distances.indexOf(best), 1);
    return best;
  });
  expect(
    Math.max(0, ...deltas),
    JSON.stringify({ type: props.chartType, patch, deltas }),
  ).toBeLessThanOrEqual(1);
}

describe("ADR-209 실제 runtime adapter의 최종 기하", () => {
  for (const descriptor of CHART_DESCRIPTORS) {
    for (const preset of descriptor.presets)
      it(`${descriptor.chartType} / ${preset.id}`, async () => {
        await check({
          ...createChartInitialProps(descriptor.chartType),
          ...preset.patch,
        });
      });
  }
  for (const chartType of ["line", "area"] as const)
    for (const orientation of ["vertical", "horizontal"] as const)
      for (const curve of ["linear", "monotone", "step"] as const)
        it(`${chartType} ${orientation} ${curve} 경계`, async () =>
          check({ chartType, orientation, curve }));
  for (const chartType of ["bar", "line", "area", "pie", "radar", "radial"] as const)
    for (const orientation of ["vertical", "horizontal"] as const)
      it(`${chartType} ${orientation} 값 레이블`, async () => check({chartType, orientation, showValueLabels: true, innerRadius: 30}, rows.map((row, i) => ({...row, value: i === 2 ? -12 : row.value}))));
  for (const chartType of ["bar", "line", "area", "pie", "radar", "radial"] as const)
    it(`${chartType} 한 범주`, async () => check({chartType, showValueLabels: true, showTotal: true, innerRadius: 30}, rows.filter((row) => row.category === "A")));
  for (const chartType of ["radar", "radial"] as const)
    it(`${chartType} 전체 음수`, async () => check({chartType, innerRadius: 30}, rows.map((row) => ({...row, value: -row.value}))));
  for (const chartType of [
    "bar",
    "line",
    "area",
    "pie",
    "radar",
    "radial",
  ] as const)
    it(`${chartType} 음수·결측·중복`, async () =>
      check({ chartType, innerRadius: 30, stackType: "stacked" }, [
        ...rows.filter(
          (row) => !(row.category === "B" && row.series === "two"),
        ),
        { category: "C", value: -32, series: "two" },
        { category: "A", value: 2, series: "one" },
      ]));
});
