/**
 * ADR-217 P3 (G3) — DOM leg 기준선: `<Chart referenceLines>` 가 (a) `back` 을 backdrop
 * (`[data-chart-grid]`) 안에, (b) `front` 를 overlay svg (`[data-chart-reference-front]`, Recharts
 * svg 의 형제) 에 scene 과 같은 좌표 · dash · 토큰으로 그린다. (c) domain 이 넓어진 눈금 문자열
 * = scene. (d) 미설정이면 두 자리 모두 없다.
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
  type LineMark,
  type TextMark,
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
  { category: "A", value: 40 },
  { category: "B", value: 100 },
  { category: "C", value: 70 },
];
const REFS: ChartProps["referenceLines"] = [
  { value: 120, label: "Target", lineType: "dashed" },
  { value: 30, layer: "back", lineType: "dotted" },
];

function mount(extra: Partial<ChartProps> = {}) {
  if (!host) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  root.render(
    <Chart
      {...createChartInitialProps("bar")}
      size="md"
      data={rows}
      dimension="category"
      metric="value"
      showLegend={false}
      showTooltip={false}
      isAnimationActive={false}
      {...extra}
      style={{ width: SIZE.width, height: SIZE.height }}
    />,
  );
}
const wait = () =>
  vi.waitFor(
    () =>
      expect(
        host.querySelector(".recharts-bar-rectangle, [data-chart-diagnostics]"),
      ).toBeTruthy(),
    { timeout: 5000 },
  );
const sceneProps = (extra: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  ...createChartInitialProps("bar"),
  chartType: "bar",
  dimension: "category",
  metric: "value",
  showLegend: false,
  showTooltip: false,
  ...extra,
});
const num = (el: Element, name: string) => Number(el.getAttribute(name));

describe("ADR-217 P3 — DOM leg 기준선", () => {
  it("back 은 backdrop 안 · front 는 overlay svg · 좌표/dash/토큰/눈금 = scene", async () => {
    mount({ referenceLines: REFS });
    await wait();
    await vi.waitFor(() =>
      expect(
        host.querySelector("[data-chart-reference-front] line"),
      ).toBeTruthy(),
    );
    const metrics = resolveChartMetrics(
      resolveComponentRule("Chart")?.chart,
      "md",
    );
    const scene = computeChartScene(
      sceneProps({ referenceLines: REFS }),
      rows,
      SIZE,
      metrics,
    );
    const sceneLines = scene.marks.filter(
      (m): m is LineMark => m.kind === "line" && m.role === "reference",
    );
    const sceneLabel = scene.marks.find(
      (m): m is TextMark => m.kind === "text" && m.role === "reference",
    )!;
    // back (value 30, dotted) — backdrop 그룹 안, Recharts 막대보다 DOM 순서가 앞.
    const back = host.querySelector<SVGLineElement>(
      "[data-chart-grid] line[stroke*='--chart-reference']",
    )!;
    expect(back).not.toBeNull();
    const backScene = sceneLines.find((l) => l.dash?.[0] === 2)!;
    expect([
      num(back, "x1"),
      num(back, "y1"),
      num(back, "x2"),
      num(back, "y2"),
    ]).toEqual([backScene.x1, backScene.y1, backScene.x2, backScene.y2]);
    expect(back.getAttribute("stroke-dasharray")).toBe("2 3");
    const bar = host.querySelector(".recharts-bar-rectangle")!;
    expect(
      back.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // front (value 120, dashed) — overlay svg (Recharts svg 의 형제, pointer-events none).
    const overlay = host.querySelector<SVGSVGElement>(
      "[data-chart-reference-front]",
    )!;
    expect(overlay.parentElement).toBe(
      host.querySelector(".recharts-responsive-container, .recharts-wrapper")!
        .parentElement,
    );
    expect(getComputedStyle(overlay).pointerEvents).toBe("none");
    const front = overlay.querySelector("line")!;
    const frontScene = sceneLines.find((l) => l.dash?.[0] === 6)!;
    expect([
      num(front, "x1"),
      num(front, "y1"),
      num(front, "x2"),
      num(front, "y2"),
    ]).toEqual([frontScene.x1, frontScene.y1, frontScene.x2, frontScene.y2]);
    expect(front.getAttribute("stroke-dasharray")).toBe("6 4");
    expect(front.getAttribute("stroke")).toContain("--chart-reference");
    const label = overlay.querySelector("text")!;
    expect(label.textContent).toBe("Target");
    expect([num(label, "x"), num(label, "y")]).toEqual([
      sceneLabel.x,
      sceneLabel.y,
    ]);
    // 실제 색 — `--chart-reference` 가 Chart.css 에서 정의돼 currentColor 로 떨어지지 않는다.
    expect(getComputedStyle(front).stroke).not.toBe("none");
    expect(getComputedStyle(label).fill).toBe(getComputedStyle(front).stroke);
    // domain 120 까지 — 장식 tick 문자열 = scene.
    const ticks = Array.from(
      host.querySelectorAll("[data-chart-decoration] text"),
    ).map((t) => t.textContent);
    for (const t of scene.axes.flatMap((a) => a.ticks.map((x) => x.text)))
      expect(ticks).toContain(t);
    expect(ticks).toContain("120");
  });

  it("미설정 · 빈 배열이면 overlay 도 backdrop 기준선도 없다", async () => {
    mount({ referenceLines: [] });
    await wait();
    expect(host.querySelector("[data-chart-reference-front]")).toBeNull();
    expect(
      host.querySelector("[data-chart-grid] line[stroke*='--chart-reference']"),
    ).toBeNull();
  });

  it("pie 에 기준선을 주면 설정 오류 상태 (데이터 보존)", async () => {
    mount({ chartType: "pie", referenceLines: REFS });
    await vi.waitFor(() =>
      expect(
        host
          .querySelector("[data-chart-diagnostics]")
          ?.getAttribute("data-chart-diagnostics"),
      ).toContain("referenceLines.unsupportedChartType"),
    );
  });
});
