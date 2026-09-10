/**
 * ADR-210 P0 / G0 — pinned Recharts 3.10.1 wide(columns) spike.
 *
 * 질문 하나만 묻는다: **원본 wide 행 `{month, desktop, mobile}` 을 그대로 Recharts 에
 * 넣고 시리즈마다 `dataKey` 를 주면 (shadcn `chart-bar-multiple` 패턴), 그 기하가 기존
 * `computeChartScene` 이 동등한 long 행에서 내는 기하와 ≤1px 로 같은가.** 같으면 columns
 * 모드는 새 기하가 아니라 기존 grid 모델의 입력 확장이다 (ADR-210 Decision B 의 first nail).
 *
 * 제품 코드는 건드리지 않는다 — Canvas 쪽은 현행 group 경로(long 행 + `color`)로 계산하고,
 * Recharts 쪽만 wide 행을 직접 소비한다. 두 입력의 동등성은 T01 손계산과 같다.
 *
 * 함께 고정하는 사실 (§3 columns 집계 계약의 근거): 중복 범주 wide 행을 Recharts 에
 * **그대로** 주면 합산되지 않고 범주가 늘어난다 → columns 모드도 grid 집계를 거쳐야 한다.
 */
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
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  CHART_DEFAULT_PROPS,
  buildSeriesGrid,
  computeChartScene,
  niceTicks,
  valueExtent,
} from "@composition/specs";
import type {
  ChartProps,
  ChartRow,
  PathMark,
  RectMark,
} from "@composition/specs";

const size = { width: 320, height: 240 };
const margin = { top: 12, right: 12, bottom: 12, left: 12 };

/** 원본 wide 행 — 저장 변환 0. 값은 T01 손계산 (desktop 120/40/60, mobile 80/10/30). */
const wide: ChartRow[] = [
  { month: "Jan", desktop: 120, mobile: 80 },
  { month: "Feb", desktop: 40, mobile: 10 },
  { month: "Mar", desktop: 60, mobile: 30 },
];
const valueFields = ["desktop", "mobile"] as const;

/** 같은 뜻의 long 행 — 현행 Canvas 경로(group 모드)의 입력. 시리즈 출현 순서 = valueFields 순서. */
const long: ChartRow[] = valueFields.flatMap((field) =>
  wide.map((row) => ({ month: row.month, value: row[field], series: field })),
);

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
  return {
    ...CHART_DEFAULT_PROPS,
    dimension: "month",
    metric: "value",
    color: "series",
    showAxis: false,
    ...patch,
  };
}

function canvasMarks(props: ChartProps): Array<PathMark | RectMark> {
  return computeChartScene(props, long, size).marks.filter(
    (m): m is PathMark | RectMark => m.kind === "path" || m.kind === "rect",
  );
}

/** 값 축 domain — Canvas 와 같은 niceTicks (expand 는 Recharts stackOffset 이 0~1 이라 [0,1]). */
function domainFor(props: ChartProps): [number, number] {
  if (props.stackType === "expand") return [0, 1];
  const grid = buildSeriesGrid(long, props, 8);
  const mode = props.stackType === "dodged" ? "none" : props.stackType;
  const extent = valueExtent(grid, mode);
  return niceTicks(extent.min, extent.max, 5).domain as [number, number];
}

async function expectParity(
  selector: string,
  props: ChartProps,
  order: (rechartsIndex: number, total: number) => number = (i) => i,
): Promise<void> {
  const marks = canvasMarks(props);
  await vi.waitFor(() =>
    expect(host.querySelectorAll(selector).length).toBe(marks.length),
  );
  const actual = Array.from(host.querySelectorAll<SVGPathElement>(selector));
  const deltas = actual.map((path, i) =>
    compareBoundaries(path, marks[order(i, actual.length)]),
  );
  console.log(
    JSON.stringify({
      spike: "wide",
      chart: props.chartType,
      orientation: props.orientation,
      stack: props.stackType,
      marks: marks.length,
      deltas,
    }),
  );
  expect(Math.max(...deltas)).toBeLessThanOrEqual(1);
}

/** Recharts 는 시리즈 우선, Canvas bar 는 범주 우선 — (범주 수 n, 시리즈 수 k) 로 대응. */
const barOrder =
  (n: number, k: number) =>
  (i: number): number =>
    (i % n) * k + Math.floor(i / n);

function cartesianWide(props: ChartProps): ReactElement {
  const horizontal = props.orientation === "horizontal";
  const domain = domainFor(props);
  const stacked = props.stackType !== "dodged";
  const Parent =
    props.chartType === "bar"
      ? BarChart
      : props.chartType === "area"
        ? AreaChart
        : LineChart;
  // line/area 는 Canvas 가 범주 밴드 중앙(ci + 0.5)에 점을 찍는다 — 숫자 축으로 맞춘다.
  const data =
    props.chartType === "bar"
      ? wide
      : wide.map((row, ci) => ({ ...row, index: ci + 0.5 }));
  return (
    <Parent
      {...size}
      data={data}
      margin={margin}
      layout={horizontal ? "vertical" : "horizontal"}
      barCategoryGap="10%"
      barGap={0}
      stackOffset={props.stackType === "expand" ? "expand" : "none"}
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
          horizontal ? undefined : props.chartType === "bar" ? "month" : "index"
        }
        domain={horizontal ? [...domain] : [0, wide.length]}
        allowDataOverflow
      />
      <YAxis
        hide
        type={horizontal ? "category" : "number"}
        dataKey={horizontal ? "month" : undefined}
        domain={horizontal ? undefined : [...domain]}
        reversed={false}
        allowDataOverflow
      />
      {valueFields.map((field) =>
        props.chartType === "bar" ? (
          <Bar
            key={field}
            dataKey={field}
            stackId={stacked ? "a" : undefined}
            fill="black"
            isAnimationActive={false}
          />
        ) : props.chartType === "area" ? (
          <Area
            key={field}
            dataKey={field}
            stackId={stacked ? "a" : undefined}
            type="linear"
            fill="black"
            stroke="none"
            dot={false}
            isAnimationActive={false}
          />
        ) : (
          <Line
            key={field}
            dataKey={field}
            type="linear"
            stroke="black"
            dot={false}
            isAnimationActive={false}
          />
        ),
      )}
    </Parent>
  );
}

describe("ADR-210 G0 — pinned Recharts wide(columns) 4종 spike", () => {
  it("T01 동등성: wide 와 long 은 같은 grid 를 낸다 (손계산 120/40/60 · 80/10/30)", () => {
    const grid = buildSeriesGrid(long, sceneProps({}), 8);
    expect(grid.categories).toEqual(["Jan", "Feb", "Mar"]);
    expect(grid.series.map((s) => s.key)).toEqual([...valueFields]);
    expect([...grid.series[0].values.values()]).toEqual([120, 40, 60]);
    expect([...grid.series[1].values.values()]).toEqual([80, 10, 30]);
  });

  it("Bar dodged (wide dataKey × 2)", async () => {
    const props = sceneProps({ chartType: "bar" });
    mount(cartesianWide(props));
    await expectParity(
      ".recharts-bar-rectangle path",
      props,
      barOrder(wide.length, valueFields.length),
    );
  });

  it("Bar horizontal dodged", async () => {
    const props = sceneProps({ chartType: "bar", orientation: "horizontal" });
    mount(cartesianWide(props));
    await expectParity(
      ".recharts-bar-rectangle path",
      props,
      barOrder(wide.length, valueFields.length),
    );
  });

  it("Bar stacked — Recharts 네이티브 stackId vs Canvas stackBands", async () => {
    const props = sceneProps({ chartType: "bar", stackType: "stacked" });
    mount(cartesianWide(props));
    await expectParity(
      ".recharts-bar-rectangle path",
      props,
      barOrder(wide.length, valueFields.length),
    );
  });

  it("Bar expand — Recharts stackOffset=expand(0~1) vs Canvas 0~100", async () => {
    const props = sceneProps({ chartType: "bar", stackType: "expand" });
    mount(cartesianWide(props));
    await expectParity(
      ".recharts-bar-rectangle path",
      props,
      barOrder(wide.length, valueFields.length),
    );
  });

  it("Line linear (wide dataKey × 2)", async () => {
    const props = sceneProps({ chartType: "line", curve: "linear" });
    mount(cartesianWide(props));
    await expectParity(".recharts-line-curve", props);
  });

  it("Area linear (wide dataKey × 2, 겹침)", async () => {
    const props = sceneProps({ chartType: "area", curve: "linear" });
    mount(cartesianWide(props));
    await expectParity(".recharts-area-area", props);
  });

  it("Area expand — 네이티브 stackOffset vs Canvas 정규화", async () => {
    const props = sceneProps({
      chartType: "area",
      curve: "linear",
      stackType: "expand",
    });
    mount(cartesianWide(props));
    await expectParity(".recharts-area-area", props);
  });

  it("Radar (wide dataKey × 2)", async () => {
    const props = sceneProps({ chartType: "radar" });
    const domain = domainFor(props);
    // plot = 320×240 − padding 12 → 반지름 108 − fontSize 11 × 0.5 (showAxis=false)
    const outer = 102.5;
    mount(
      <RadarChart
        {...size}
        data={wide}
        cx={160}
        cy={120}
        outerRadius={outer}
        innerRadius={0}
        startAngle={90}
        endAngle={-270}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <PolarAngleAxis dataKey="month" tick={false} axisLine={false} />
        <PolarRadiusAxis domain={domain} tick={false} axisLine={false} />
        {valueFields.map((field) => (
          <Radar
            key={field}
            dataKey={field}
            fill="black"
            stroke="black"
            isAnimationActive={false}
          />
        ))}
      </RadarChart>,
    );
    await expectParity(".recharts-radar-polygon path", props);
  });

  it("중복 범주 wide 행을 그대로 주면 Recharts 는 합산하지 않는다 → columns 도 grid 집계 필수", async () => {
    const duplicated: ChartRow[] = [
      { month: "Jan", desktop: 100, mobile: 80 },
      { month: "Jan", desktop: 20, mobile: null },
      { month: "Feb", desktop: 40, mobile: 10 },
    ];
    mount(
      <BarChart {...size} data={duplicated} margin={margin}>
        <XAxis hide dataKey="month" type="category" />
        <YAxis hide type="number" />
        <Bar dataKey="desktop" fill="black" isAnimationActive={false} />
      </BarChart>,
    );
    await vi.waitFor(() =>
      expect(host.querySelectorAll(".recharts-bar-rectangle path").length).toBe(
        3,
      ),
    );
    // 같은 입력을 현행 grid 로 접으면 Jan = 100 + 20 = 120 (T02) — 범주 2개.
    const grid = buildSeriesGrid(
      duplicated.flatMap((row) => [
        { month: row.month, value: row.desktop, series: "desktop" },
        { month: row.month, value: row.mobile, series: "mobile" },
      ]),
      sceneProps({}),
      8,
    );
    expect(grid.categories).toEqual(["Jan", "Feb"]);
    expect(grid.series[0].values.get(0)).toBe(120);
    // null 은 결측 — 0 으로 접히지 않는다 (mobile Jan = 80 만).
    expect(grid.series[1].values.get(0)).toBe(80);
  });
});
