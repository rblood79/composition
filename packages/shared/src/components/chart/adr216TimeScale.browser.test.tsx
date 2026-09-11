/**
 * ADR-216 P3 (G3) — DOM leg 시간 스케일 parity: 같은 크기의 scene 과 Recharts 렌더가 같은 x 를 낸다.
 *
 * 계약: (a) Recharts line path 의 꼭짓점 x = scene path 의 x (±0.5px) — Recharts 가 `position`
 * (epoch) 을 scene 과 같은 nice domain 위에 놓는다. (b) 축 장식 (`[data-chart-decoration] text`)
 * 의 2단 라벨 문자열·좌표 = scene `axes[0].ticks` byte 동일. (c) 미설정 (category) 문서는 그대로.
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
const DAYS = [1, 2, 3, 4, 5, 7, 8, 9, 10];
const rows = DAYS.map((d) => ({
  date: `2026-01-${String(d).padStart(2, "0")}`,
  value: [1, 5, 2, 9, 3, 4, 8, 1, 6][DAYS.indexOf(d)],
}));

function mount(extra: Partial<ChartProps> = {}) {
  if (!host) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  root.render(
    <Chart
      {...createChartInitialProps("line")}
      size="md"
      data={rows}
      dimension="date"
      metric="value"
      showLegend={false}
      showTooltip={false}
      isAnimationActive={false}
      curve="linear"
      dimensionScale="time"
      {...extra}
      style={{ width: SIZE.width, height: SIZE.height }}
    />,
  );
}

const wait = () =>
  vi.waitFor(
    () =>
      expect(
        host.querySelector(".recharts-line-curve, [data-chart-diagnostics]"),
      ).toBeTruthy(),
    { timeout: 5000 },
  );

/** `M x y L x y …` (Recharts `legacyLinear` 도 같은 어법) → x 목록. */
function pathXs(d: string): number[] {
  return d
    .split(/[ML]\s*/)
    .filter(Boolean)
    .map((seg) => Number(seg.trim().split(/[\s,]+/)[0]));
}

const sceneProps = (extra: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...createChartInitialProps("line"),
  chartType: "line",
  dimension: "date",
  metric: "value",
  showLegend: false,
  showTooltip: false,
  curve: "linear",
  dimensionScale: "time",
  ...extra,
});

describe("ADR-216 P3 — DOM leg 시간 스케일 parity", () => {
  it("line 꼭짓점 x = scene x (±0.5px) · 2단 라벨 문자열/좌표 = scene axes[0].ticks", async () => {
    mount();
    await wait();
    const metrics = resolveChartMetrics(
      resolveComponentRule("Chart")?.chart,
      "md",
    );
    const scene = computeChartScene(sceneProps(), rows, SIZE, metrics);
    const scenePath = scene.marks.find(
      (m): m is PathMark => m.kind === "path" && m.strokeSeries !== undefined,
    )!;
    const expected = pathXs(scenePath.d);
    const curve = host.querySelector<SVGPathElement>(".recharts-line-curve")!;
    expect(curve).not.toBeNull();
    const actual = pathXs(curve.getAttribute("d")!);
    expect(actual).toHaveLength(expected.length);
    actual.forEach((x, i) =>
      expect(Math.abs(x - expected[i])).toBeLessThan(0.5),
    );
    // 결측 (Jan 6) 의 빈 자리 — Jan 5 → Jan 7 간격이 두 배.
    expect(actual[5] - actual[4]).toBeCloseTo((actual[1] - actual[0]) * 2, 0);

    const texts = Array.from(
      host.querySelectorAll<SVGTextElement>("[data-chart-decoration] text"),
    );
    const sceneTicks = scene.axes.flatMap((a) => a.ticks);
    // 장식 순서 = axes 순 (x 축 → y 축) 의 ticks — 문자열·x·y 동일.
    const domTicks = texts.slice(0, sceneTicks.length).map((t) => ({
      text: t.textContent,
      x: Number(t.getAttribute("x")),
      y: Number(t.getAttribute("y")),
    }));
    expect(domTicks).toEqual(
      sceneTicks.map((t) => ({ text: t.text, x: t.x, y: t.y })),
    );
    expect(domTicks.map((t) => t.text).slice(0, 3)).toEqual(["1", "Jan", "2"]);
  });

  it("dimensionLabelFormat → 1단 라벨 (scene 동일) · category 미설정은 슬롯 등간격 그대로", async () => {
    mount({ dimensionLabelFormat: "%m/%d" });
    await wait();
    const metrics = resolveChartMetrics(
      resolveComponentRule("Chart")?.chart,
      "md",
    );
    const scene = computeChartScene(
      sceneProps({ dimensionLabelFormat: "%m/%d" }),
      rows,
      SIZE,
      metrics,
    );
    const texts = Array.from(
      host.querySelectorAll<SVGTextElement>("[data-chart-decoration] text"),
    ).map((t) => t.textContent);
    expect(texts.slice(0, scene.axes[0].ticks.length)).toEqual(
      scene.axes[0].ticks.map((t) => t.text),
    );
    expect(texts[0]).toBe("01/01");

    mount({ dimensionScale: undefined, dimensionLabelFormat: undefined });
    // 같은 host 재렌더 — 옛 (시간 간격) path 가 남아 있을 수 있어 등간격이 될 때까지 기다린다.
    await vi.waitFor(() => {
      const curve = host.querySelector<SVGPathElement>(".recharts-line-curve")!;
      const xs = pathXs(curve.getAttribute("d")!);
      // 등간격: 모든 인접 간격이 같다 (결측 자리 없음).
      const gaps = xs.slice(1).map((x, i) => x - xs[i]);
      gaps.forEach((g) => expect(Math.abs(g - gaps[0])).toBeLessThan(0.5));
    });
  });

  it("bar + time → 설정 오류 안내 (Canvas 와 같은 문구)", async () => {
    mount({ chartType: "bar" } as Partial<ChartProps>);
    await wait();
    const status = host.querySelector("[data-chart-diagnostics]");
    expect(status?.getAttribute("data-chart-diagnostics")).toContain(
      "dimensionScale.unsupportedChartType",
    );
  });
});
