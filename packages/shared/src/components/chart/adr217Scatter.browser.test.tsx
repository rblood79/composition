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
  it("DOM 점 path d = scene 점 path d (시리즈당 1, 겹친 점 포함) · 불투명 · x 눈금 = scene · hover 툴팁 · 설정 오류 0", async () => {
    mount({ showTooltip: true });
    await vi.waitFor(
      () =>
        expect(
          host.querySelectorAll("[data-chart-scatter-series]").length,
        ).toBe(2),
      { timeout: 5000 },
    );
    const metrics = resolveChartMetrics(
      resolveComponentRule("Chart")?.chart,
      "md",
    );
    const scene = computeChartScene(sceneProps(), rows, SIZE, metrics);
    const sceneD = scene.marks
      .filter(
        (m): m is PathMark => m.kind === "path" && m.fillSeries !== undefined,
      )
      .map((m) => m.d);
    const domPaths = Array.from(
      host.querySelectorAll<SVGPathElement>("[data-chart-scatter-series]"),
    );
    // Recharts 는 좌표를 만들지 않는다 — DOM path 는 scene 문자열 그대로 (Skia 와 byte 동일).
    expect(domPaths.map((p) => p.getAttribute("d"))).toEqual(sceneD);
    expect(sceneD.join(" ").match(/M /g)).toHaveLength(6);
    for (const el of domPaths)
      expect(el.getAttribute("fill-opacity")).toBe("1");
    // hover — 첫 점 (x 1, y 10, 시리즈 a) 위에 pointer 를 두면 툴팁 (범주 라벨 + 시리즈 + 값), 벗어나면 사라진다.
    const [cx, cy] = centers(sceneD[0])[0];
    const hit = host.querySelector<HTMLElement>("[data-chart-scatter-hit]")!;
    const rect = hit.getBoundingClientRect();
    hit.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: rect.left + cx,
        clientY: rect.top + cy,
        bubbles: true,
      }),
    );
    await vi.waitFor(() =>
      expect(host.querySelector(".react-aria-Chart-tooltip")).not.toBeNull(),
    );
    expect(
      host.querySelector(".react-aria-Chart-tooltip")!.textContent,
    ).toContain("a");
    hit.dispatchEvent(
      new PointerEvent("pointermove", {
        clientX: rect.left + 2,
        clientY: rect.top + 2,
        bubbles: true,
      }),
    );
    await vi.waitFor(() =>
      expect(host.querySelector(".react-aria-Chart-tooltip")).toBeNull(),
    );
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
        expect(
          host
            .querySelector("[data-chart-scatter-series]")
            ?.getAttribute("d")
            ?.match(/M /g)?.length,
        ).toBe(3),
      { timeout: 5000 },
    );
    const ticks = Array.from(
      host.querySelectorAll("[data-chart-decoration] text"),
    ).map((t) => t.textContent);
    expect(ticks).toContain("Feb");
  });
});
