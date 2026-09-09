import { compareBoundaries } from "./chartBoundaryOracle";
import React, { type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_DEFAULT_PROPS,
  computeChartScene,
  buildSeriesGrid,
  niceTicks,
  valueExtent,
  stackRangesBySeries,
} from "@composition/specs";
import type {
  ChartProps,
  ChartRow,
  PathMark,
  RectMark,
} from "@composition/specs";
import {
  legacyMonotoneVertical,
  legacyMonotoneHorizontal,
} from "./legacyMonotone";

const size = { width: 320, height: 240 };
const margin = { top: 12, right: 12, bottom: 12, left: 12 };
const rows: ChartRow[] = [
  { category: "A", value: 10, series: "one" },
  { category: "B", value: 40, series: "one" },
  { category: "C", value: 20, series: "one" },
  { category: "A", value: 30, series: "two" },
  { category: "B", value: 10, series: "two" },
  { category: "C", value: 20, series: "two" },
];
let root: Root | undefined;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
});

function mount(element: ReactElement): void {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(element);
}

function sceneProps(patch: Partial<ChartProps>): ChartProps {
  return { ...CHART_DEFAULT_PROPS, showAxis: false, color: "series", ...patch };
}


async function check(
  selector: string,
  props: ChartProps,
  source = rows,
): Promise<void> {
  const marks = computeChartScene(props, source, size).marks.filter(
    (m): m is PathMark | RectMark => m.kind === "path" || m.kind === "rect",
  );
  await vi.waitFor(() =>
    expect(host.querySelectorAll(selector).length).toBe(marks.length),
  );
  const actual = Array.from(host.querySelectorAll<SVGPathElement>(selector));
  const deltas = actual.map((path, i) => compareBoundaries(path, marks[i]));
  if (Math.max(...deltas) > 1)
    console.log(
      JSON.stringify({
        actual: actual.map((p) => p.getAttribute("d")),
        expected: marks,
      }),
    );
  console.log(
    JSON.stringify({
      chart: props.chartType,
      orientation: props.orientation,
      stack: props.stackType,
      deltas,
    }),
  );
  expect(Math.max(...deltas)).toBeLessThanOrEqual(1);
}

function cartesian(props: ChartProps, nativeMonotone = false): ReactElement {
  const grid = buildSeriesGrid(rows, props, 8);
  const mode = props.stackType === "dodged" ? "none" : props.stackType;
  const extent = valueExtent(grid, mode);
  const domain = niceTicks(extent.min, extent.max, 5).domain;
  const bands = stackRangesBySeries(grid, mode);
  const data = grid.categories.map((category, ci) => ({
    category,
    index: ci + 0.5,
    ...Object.fromEntries(
      grid.series.map((s, si) => [
        "s" + si,
        props.chartType === "area" && mode !== "none"
          ? [bands[si].get(ci)!.from, bands[si].get(ci)!.to]
          : s.values.get(ci),
      ]),
    ),
  }));
  const horizontal = props.orientation === "horizontal";
  const curve =
    props.curve === "monotone"
      ? nativeMonotone
        ? "monotone"
        : horizontal
          ? legacyMonotoneHorizontal
          : legacyMonotoneVertical
      : props.curve;
  const Parent =
    props.chartType === "bar"
      ? BarChart
      : props.chartType === "area"
        ? AreaChart
        : LineChart;
  return (
    <Parent
      {...size}
      data={data}
      margin={margin}
      layout={horizontal ? "vertical" : "horizontal"}
      barCategoryGap="10%"
      barGap={0}
    >
      <XAxis
        hide
        type={
          horizontal
            ? "number"
            : props.chartType === "bar"
              ? "category"
              : "number"
        }
        dataKey={
          horizontal
            ? undefined
            : props.chartType === "bar"
              ? "category"
              : "index"
        }
        domain={horizontal ? [...domain] : [0, 3]}
        allowDataOverflow
      />
      <YAxis
        hide
        type={horizontal ? "number" : "number"}
        dataKey={horizontal ? "index" : undefined}
        domain={horizontal ? [0, 3] : [...domain]}
        reversed={false}
        allowDataOverflow
      />
      {grid.series.map((s, si) =>
        props.chartType === "bar" ? (
          <Bar
            key={si}
            dataKey={"s" + si}
            fill="black"
            isAnimationActive={false}
          />
        ) : props.chartType === "area" ? (
          <Area
            key={si}
            dataKey={"s" + si}
            type={curve}
            fill="black"
            stroke="none"
            dot={false}
            isAnimationActive={false}
          />
        ) : (
          <Line
            key={si}
            dataKey={"s" + si}
            type={curve}
            stroke="black"
            dot={false}
            isAnimationActive={false}
          />
        ),
      )}
    </Parent>
  );
}

describe("ADR-209 G0 실제 Recharts 공개 API spike", () => {
  it("Bar 기본형", async () => {
    const props = sceneProps({ chartType: "bar" });
    mount(cartesian(props));
    // Recharts는 series 우선, Canvas는 category 우선 순서다.
    await vi.waitFor(() =>
      expect(
        host.querySelectorAll(".recharts-bar-rectangle path"),
      ).toHaveLength(6),
    );
    const marks = computeChartScene(props, rows, size).marks.filter(
      (m): m is RectMark => m.kind === "rect",
    );
    const paths = Array.from(
      host.querySelectorAll<SVGPathElement>(".recharts-bar-rectangle path"),
    );
    expect(
      Math.max(
        ...paths.map((p, i) =>
          compareBoundaries(p, marks[(i % 3) * 2 + Math.floor(i / 3)]),
        ),
      ),
    ).toBeLessThanOrEqual(1);
  });
  for (const chartType of ["line", "area"] as const)
    for (const orientation of ["vertical", "horizontal"] as const) {
      it(`${chartType} monotone ${orientation}: 앵커 사이 경계`, async () => {
        const props = sceneProps({ chartType, orientation, curve: "monotone" });
        mount(cartesian(props));
        await check(
          chartType === "line" ? ".recharts-line-curve" : ".recharts-area-area",
          props,
        );
      });
    }
  it("Area 100% 누적", async () => {
    const props = sceneProps({
      chartType: "area",
      stackType: "expand",
      curve: "linear",
    });
    mount(cartesian(props));
    await check(".recharts-area-area", props);
  });
  it("Pie 다중 링", async () => {
    const props = sceneProps({
      chartType: "pie",
      stackType: "stacked",
      innerRadius: 30,
    });
    const grid = buildSeriesGrid(rows, props, 8);
    const outer = 108,
      hole = 32.4,
      band = (outer - hole) / 2;
    mount(
      <PieChart {...size} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        {grid.series.map((s, si) => (
          <Pie
            key={si}
            data={grid.categories.map((category, ci) => ({
              category,
              value: Math.abs(s.values.get(ci) ?? 0),
            }))}
            dataKey="value"
            cx={160}
            cy={120}
            outerRadius={outer - si * band}
            innerRadius={outer - (si + 1) * band + 2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          />
        ))}
      </PieChart>,
    );
    await check(".recharts-pie-sector path", props);
  });
  it("Radar 결측과 innerRadius", async () => {
    const source = rows.filter(
      (r) => !(r.category === "B" && r.series === "one"),
    );
    const props = sceneProps({ chartType: "radar", innerRadius: 30 });
    const grid = buildSeriesGrid(source, props, 8);
    const data = grid.categories.map((category, ci) => ({
      category,
      ...Object.fromEntries(
        grid.series.map((s, si) => [
          "s" + si,
          Math.max(0, s.values.get(ci) ?? 0),
        ]),
      ),
    }));
    mount(
      <RadarChart
        {...size}
        data={data}
        cx={160}
        cy={120}
        outerRadius={102.5}
        innerRadius={30.75}
        startAngle={90}
        endAngle={-270}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <PolarAngleAxis dataKey="category" tick={false} axisLine={false} />
        <PolarRadiusAxis domain={[0, 30]} tick={false} axisLine={false} />
        {grid.series.map((_, si) => (
          <Radar
            key={si}
            dataKey={"s" + si}
            fill="black"
            stroke="black"
            isAnimationActive={false}
          />
        ))}
      </RadarChart>,
    );
    await check(".recharts-radar-polygon path", props, source);
  });
  it("Radial 반원·누적", async () => {
    const props = sceneProps({
      chartType: "radial",
      stackType: "stacked",
      innerRadius: 20,
      endAngle: 180,
    });
    const grid = buildSeriesGrid(rows, props, 8);
    const bands = stackRangesBySeries(grid, "stacked");
    const data = grid.categories.map((category, ci) => ({
      category,
      ...Object.fromEntries(
        grid.series.map((_, si) => [
          "s" + si,
          [bands[si].get(ci)!.from, bands[si].get(ci)!.to],
        ]),
      ),
    }));
    mount(
      <RadialBarChart
        {...size}
        data={data}
        cx={160}
        cy={120}
        innerRadius={20.5 + (3 - Math.round(3 / 2))}
        outerRadius={102.5 + (3 - Math.round(3 / 2))}
        startAngle={90}
        endAngle={-90}
        barGap={-24.33333}
        barCategoryGap={0}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <PolarAngleAxis
          type="number"
          domain={[0, 50]}
          tick={false}
          axisLine={false}
        />
        <PolarRadiusAxis
          type="category"
          dataKey="category"
          reversed
          tick={false}
          axisLine={false}
        />
        {grid.series.map((_, si) => (
          <RadialBar
            key={si}
            dataKey={"s" + si}
            barSize={24.33333}
            fill="black"
            isAnimationActive={false}
            background={si === 0 ? { fill: "gray" } : false}
          />
        ))}
      </RadialBarChart>,
    );

    await vi.waitFor(() =>
      expect(
        host.querySelectorAll("path.recharts-radial-bar-sector"),
      ).toHaveLength(6),
    );
    const marks = computeChartScene(props, rows, size).marks.filter(
      (m): m is PathMark => m.kind === "path" && m.fillSeries !== undefined,
    );
    const paths = Array.from(
      host.querySelectorAll<SVGPathElement>("path.recharts-radial-bar-sector"),
    );
    const deltas = paths.map((p, i) =>
      compareBoundaries(p, marks[(i % 3) * 2 + Math.floor(i / 3)]),
    );
    console.log(JSON.stringify({ chart: "radial", deltas }));

    expect(Math.max(...deltas)).toBeLessThanOrEqual(1);
  });
});
