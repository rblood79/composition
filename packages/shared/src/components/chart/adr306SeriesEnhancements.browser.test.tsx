/**
 * ADR-306 G3 (Phase 5 — 기존 종류 보강, breakdown §2.1) — Recharts DOM 이 Canvas scene 과 같은 보강을
 * 그리는가. 두 consumer 는 같은 모델 (정렬 · 값 축) 과 같은 builder (`buildSeriesExtraMarks` — 띠 · 끝 이름표 ·
 * 산점도 크기 · 이름 · 추세선 · 사분면) 를 읽는다 — 외부 oracle 은 브라우저가 실제로 놓은 요소 (d · x · 글자).
 */
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chart } from "../Chart";
import {
  CHART_DEFAULT_PROPS,
  computeChartScene,
  resolveChartMetrics,
  type ChartProps,
  type ChartRow,
  type Mark,
  type PathMark,
  type TextMark,
} from "@composition/rendering";
import { resolveComponentRule } from "../../catalog/resolvers/resolveComponentRule";

let root: Root | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => {
  root?.unmount();
  host?.remove();
  root = undefined;
  host = undefined;
});

const SIZE = { width: 480, height: 300 };
const ROWS: ChartRow[] = [
  { category: "Mon", value: 12, series: "A", lo: 8, hi: 20 },
  { category: "Tue", value: 30, series: "A", lo: 22, hi: 40 },
  { category: "Wed", value: 18, series: "A", lo: 10, hi: 26 },
  { category: "Thu", value: 24, series: "A", lo: 16, hi: 33 },
  { category: "Mon", value: 20, series: "B", lo: 15, hi: 24 },
  { category: "Tue", value: 8, series: "B", lo: 4, hi: 12 },
  { category: "Wed", value: 25, series: "B", lo: 20, hi: 30 },
  { category: "Thu", value: 14, series: "B", lo: 9, hi: 19 },
];
const POINTS: ChartRow[] = [
  { x: 1, y: 2, size: 15, name: "alpha" },
  { x: 2, y: 4, size: 150, name: "beta" },
  { x: 3, y: 5, size: 60, name: "gamma" },
  { x: 4, y: 9, size: 30, name: "delta" },
];

function propsOf(patch: Partial<ChartProps>): ChartProps {
  return {
    ...CHART_DEFAULT_PROPS,
    color: "series",
    showAxis: true,
    isAnimationActive: false,
    ...patch,
  } as ChartProps;
}

async function mount(patch: Partial<ChartProps>, rows: ChartRow[]) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  root.render(
    <Chart
      {...(propsOf(patch) as object)}
      data={rows}
      style={{
        width: SIZE.width,
        height: SIZE.height,
        boxSizing: "border-box",
      }}
    />,
  );
  await vi.waitFor(
    () => expect(host!.querySelector(".recharts-surface")).not.toBeNull(),
    { timeout: 5000 },
  );
  const el = host!.querySelector<HTMLElement>(".react-aria-Chart")!;
  const r = el.getBoundingClientRect();
  return computeChartScene(
    propsOf(patch),
    rows,
    { width: r.width, height: r.height },
    resolveChartMetrics(resolveComponentRule("Chart")?.chart),
  );
}

const texts = (marks: readonly Mark[]) =>
  marks.filter((m): m is TextMark => m.kind === "text");
const domTexts = (selector: string) =>
  Array.from(host!.querySelectorAll<SVGTextElement>(`${selector} text`)).map(
    (t) => ({ text: t.textContent, x: Number(t.getAttribute("x")) }),
  );

describe("ADR-306 G3 — §2.1 보강 DOM = scene", () => {
  it("line 범위 띠 — 격자 층 path d 가 scene 의 띠와 같다", async () => {
    const scene = await mount(
      { chartType: "line", lowerFields: ["lo"], upperFields: ["hi"] },
      ROWS,
    );
    const bands = scene.marks.filter(
      (m): m is PathMark => m.kind === "path" && m.fillOpacity === 0.18,
    );
    expect(bands).toHaveLength(2);
    const dom = Array.from(
      host!.querySelectorAll<SVGPathElement>("[data-chart-grid] path"),
    ).map((p) => p.getAttribute("d"));
    for (const band of bands) expect(dom).toContain(band.d);
  });

  it("line 끝 이름표 — 장식 층 글자 · x 가 scene 과 같다", async () => {
    const scene = await mount({ chartType: "line", endLabels: true }, ROWS);
    const expected = texts(scene.marks)
      .filter((t) => t.role === "legend")
      .map((t) => ({ text: t.text, x: t.x }));
    expect(expected).toHaveLength(2);
    const dom = domTexts("[data-chart-decoration]");
    for (const label of expected) expect(dom).toContainEqual(label);
  });

  it("bar 정렬 — 범주 눈금 글자 순서가 scene 과 같다 (Wed · Tue · Thu · Mon)", async () => {
    const scene = await mount(
      { chartType: "bar", sort: "descending", showLegend: false },
      ROWS,
    );
    const xTicks = scene.axes
      .find((a) => a.axis === "x")!
      .ticks.map((t) => t.text);
    expect(xTicks).toEqual(["Wed", "Tue", "Thu", "Mon"]);
    const dom = domTexts("[data-chart-decoration]").map((t) => t.text);
    expect(dom.filter((t) => xTicks.includes(t!))).toEqual(xTicks);
  });

  it("line valueMax 100 — 값 축 끝 눈금 100 (DOM · scene)", async () => {
    const scene = await mount(
      { chartType: "line", valueMax: 100, showLegend: false },
      ROWS,
    );
    const yTicks = scene.axes
      .find((a) => a.axis === "y")!
      .ticks.map((t) => t.text);
    expect(yTicks[yTicks.length - 1]).toBe("100");
    const dom = domTexts("[data-chart-decoration]").map((t) => t.text);
    expect(dom).toContain("100");
  });

  it("scatter — 크기 점 d · 점 이름 · 추세선 · 사분면이 scene 과 같다", async () => {
    const patch: Partial<ChartProps> = {
      chartType: "scatter",
      dimension: "x",
      metric: "y",
      color: undefined,
      sizeField: "size",
      labelField: "name",
      fit: "linear",
      quadrants: ["NW", "NE", "SW", "SE"],
      showLegend: false,
    };
    const scene = await mount(patch, POINTS);
    const dot = scene.marks.find(
      (m): m is PathMark => m.kind === "path" && m.fillOpacity === 0.75,
    )!;
    const domDot = host!.querySelector<SVGPathElement>(
      "[data-chart-scatter] path[data-chart-scatter-series]",
    )!;
    expect(domDot.getAttribute("d")).toBe(dot.d);
    expect(domDot.getAttribute("fill-opacity")).toBe("0.75");
    const names = texts(scene.marks)
      .filter((t) => ["alpha", "beta", "gamma", "delta"].includes(t.text))
      .map((t) => ({ text: t.text, x: t.x }));
    expect(names).toHaveLength(4);
    const dom = domTexts("[data-chart-scatter]");
    for (const n of names) expect(dom).toContainEqual(n);
    const fit = scene.marks.find(
      (m) => m.kind === "line" && m.role === "reference" && !m.dash,
    );
    const domLines = Array.from(
      host!.querySelectorAll<SVGLineElement>("[data-chart-scatter] line"),
    ).map((l) => Number(l.getAttribute("x1")));
    expect(fit?.kind === "line" && domLines.includes(fit.x1)).toBe(true);
    const quadrantNames = domTexts("[data-chart-grid]").map((t) => t.text);
    for (const q of ["NW", "NE", "SW", "SE"])
      expect(
        texts(scene.marks).some((t) => t.text === q) ===
          quadrantNames.includes(q),
      ).toBe(true);
  });

  it("donut 가운데 이름 (합계 끔) — DOM 글자 위치 = scene", async () => {
    const rows = ROWS.filter((r) => r.series === "A");
    const scene = await mount(
      {
        chartType: "pie",
        innerRadius: 60,
        centerLabel: "Visits",
        color: undefined,
        showLegend: false,
      },
      rows,
    );
    const caption = texts(scene.marks).find((t) => t.text === "Visits")!;
    expect(caption).toBeTruthy();
    const dom = Array.from(host!.querySelectorAll<SVGTextElement>("text")).find(
      (t) => t.textContent === "Visits",
    )!;
    expect(Number(dom.getAttribute("x"))).toBeCloseTo(caption.x, 1);
    expect(Number(dom.getAttribute("y"))).toBeCloseTo(caption.y, 1);
  });

  it("connectNulls — 값 없는 범주를 잇는다 (Recharts 선 path 의 M 하나)", async () => {
    const gap: ChartRow[] = [
      { category: "Mon", value: 12 },
      { category: "Tue", value: null },
      { category: "Wed", value: 18 },
      { category: "Thu", value: 24 },
    ];
    const count = () =>
      (
        host!
          .querySelector<SVGPathElement>(".recharts-line-curve")!
          .getAttribute("d")!
          .match(/M/g) ?? []
      ).length;
    await mount({ chartType: "line", color: undefined }, gap);
    expect(count()).toBe(2);
    root!.unmount();
    host!.remove();
    await mount(
      { chartType: "line", color: undefined, connectNulls: true },
      gap,
    );
    expect(count()).toBe(1);
  });

  it("connectNulls — 누적 line (시리즈 2) 도 scene 과 같은 끊김 수", async () => {
    const gap: ChartRow[] = [
      { category: "Mon", value: 12, series: "A" },
      { category: "Tue", value: null, series: "A" },
      { category: "Wed", value: 18, series: "A" },
      { category: "Thu", value: 24, series: "A" },
      { category: "Mon", value: 5, series: "B" },
      { category: "Tue", value: 7, series: "B" },
      { category: "Wed", value: 9, series: "B" },
      { category: "Thu", value: 11, series: "B" },
    ];
    const scene = await mount(
      { chartType: "line", stackType: "stacked", connectNulls: true },
      gap,
    );
    const sceneRuns = scene.marks
      .filter((m): m is PathMark => m.kind === "path" && m.strokeSeries === 0)
      .map((m) => (m.d.match(/M/g) ?? []).length);
    const domRuns = (
      host!
        .querySelector<SVGPathElement>(".recharts-line-curve")!
        .getAttribute("d")!
        .match(/M/g) ?? []
    ).length;
    expect(sceneRuns).toEqual([domRuns]);
  });
});
