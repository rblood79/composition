/**
 * ADR-217 P5 (G3) — DOM leg 산점도: (a) Recharts `Scatter` 점 중심 `cx/cy` = scene 점 path 의 원 중심
 * (±0.5px, 겹친 점 2개 포함) (b) x 축 눈금 문자열 = scene (c) 겹친 점의 중심 픽셀이 단일 path
 * (Skia 규약) 로 그린 SVG 와 같다 — 불투명이라 합성 단위 무관 (round 1 m3) (d) 설정 오류 없음.
 */
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chart } from "../Chart";
import {
  CHART_DEFAULT_PROPS,
  computeChartScene,
  createChartInitialProps,
  resolveChartMetrics,
  type ChartProps,
  type PathMark,
} from "@composition/specs";
import { resolveComponentRule } from "../../catalog/resolvers/resolveComponentRule";

let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  root?.unmount();
  host?.remove();
  host = undefined!;
});
const SIZE = { width: 400, height: 300 };
const rows = [
  { x: 1, y: 10, series: "a" },
  { x: 1, y: 30, series: "a" },
  { x: 2, y: 20, series: "a" },
  { x: 4, y: 40, series: "a" },
  { x: 4, y: 40, series: "a" },
  { x: 3, y: 15, series: "b" },
];

function mount(extra: Partial<ChartProps> & { data?: unknown } = {}) {
  if (!host) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  root.render(
    <Chart
      {...createChartInitialProps("scatter")}
      size="md"
      data={rows}
      dimension="x"
      metric="y"
      color="series"
      showLegend={false}
      showTooltip={false}
      isAnimationActive={false}
      {...(extra as Partial<ChartProps>)}
      style={{ width: SIZE.width, height: SIZE.height }}
    />,
  );
}
const sceneProps = (extra: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...createChartInitialProps("scatter"),
  chartType: "scatter",
  dimension: "x",
  metric: "y",
  color: "series",
  showLegend: false,
  showTooltip: false,
  ...extra,
});
/** `M left y A r r 0 1 1 right y …` subpath 마다 원 중심 = ((left + right) / 2, y). */
function centers(d: string): Array<[number, number]> {
  return d
    .split("M ")
    .filter(Boolean)
    .map((seg) => {
      const t = seg.trim().split(/\s+/);
      const left = Number(t[0]);
      const y = Number(t[1]);
      const right = Number(t[8]);
      return [(left + right) / 2, y];
    });
}
async function centerPixel(svg: string): Promise<number[]> {
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("svg load"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 60;
  canvas.height = 60;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 60, 60);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  return Array.from(ctx.getImageData(30, 30, 1, 1).data);
}

describe("ADR-217 P5 — DOM leg 산점도", () => {
  it("Scatter 점 cx/cy = scene 점 중심 (±0.5, 겹친 점 포함) · x 눈금 = scene · 설정 오류 0", async () => {
    mount();
    await vi.waitFor(
      () =>
        expect(host.querySelectorAll("[data-chart-scatter-dot]").length).toBe(
          6,
        ),
      { timeout: 5000 },
    );
    const metrics = resolveChartMetrics(
      resolveComponentRule("Chart")?.chart,
      "md",
    );
    const scene = computeChartScene(sceneProps(), rows, SIZE, metrics);
    const want = scene.marks
      .filter(
        (m): m is PathMark => m.kind === "path" && m.fillSeries !== undefined,
      )
      .flatMap((m) => centers(m.d))
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const got = Array.from(
      host.querySelectorAll<SVGElement>("[data-chart-scatter-dot]"),
    )
      .map(
        (el) =>
          [
            Number(el.getAttribute("data-cx")),
            Number(el.getAttribute("data-cy")),
          ] as [number, number],
      )
      .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(got).toHaveLength(want.length);
    got.forEach(([x, y], i) => {
      expect(Math.abs(x - want[i][0])).toBeLessThan(0.5);
      expect(Math.abs(y - want[i][1])).toBeLessThan(0.5);
    });
    // 불투명 — 점 요소의 fill-opacity 1.
    for (const el of host.querySelectorAll<SVGElement>(
      "[data-chart-scatter-dot]",
    ))
      expect(el.getAttribute("fill-opacity")).toBe("1");
    const ticks = Array.from(
      host.querySelectorAll("[data-chart-decoration] text"),
    ).map((t) => t.textContent);
    for (const t of scene.axes.flatMap((a) => a.ticks.map((x) => x.text)))
      expect(ticks).toContain(t);
    expect(host.querySelector("[data-chart-diagnostics]")).toBeNull();
  });

  it("합성 프로브 — 겹친 점 2개: 단일 path (Skia 규약) 와 점별 요소 (DOM) 의 중심 픽셀이 불투명에서 같다", async () => {
    const circle = (cx: number) =>
      `M ${cx - 6} 30 A 6 6 0 1 1 ${cx + 6} 30 A 6 6 0 1 1 ${cx - 6} 30 Z`;
    const single = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><path d="${circle(30)} ${circle(30)}" fill="rgb(0,0,0)" fill-opacity="1"/></svg>`;
    const separate = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><circle cx="30" cy="30" r="6" fill="rgb(0,0,0)" fill-opacity="1"/><circle cx="30" cy="30" r="6" fill="rgb(0,0,0)" fill-opacity="1"/></svg>`;
    expect(await centerPixel(single)).toEqual(await centerPixel(separate));
    // 대조군 — 0.85 면 갈린다 (round 1 m3 재현): 단일 path 는 union, 점별은 1-(1-α)².
    const single85 = single.replace(/fill-opacity="1"/g, 'fill-opacity="0.85"');
    const separate85 = separate.replace(
      /fill-opacity="1"/g,
      'fill-opacity="0.85"',
    );
    expect(await centerPixel(single85)).not.toEqual(
      await centerPixel(separate85),
    );
  });

  it("time x — ISO 날짜 산점도가 2단 라벨 축으로 렌더된다", async () => {
    mount({
      dimensionScale: "time",
      data: [
        { x: "2026-01-01", y: 1, series: "a" },
        { x: "2026-01-03", y: 2, series: "a" },
        { x: "2026-02-10", y: 3, series: "a" },
      ],
    });
    await vi.waitFor(
      () =>
        expect(host.querySelectorAll("[data-chart-scatter-dot]").length).toBe(
          3,
        ),
      { timeout: 5000 },
    );
    const ticks = Array.from(
      host.querySelectorAll("[data-chart-decoration] text"),
    ).map((t) => t.textContent);
    expect(ticks).toContain("Feb");
  });
});
