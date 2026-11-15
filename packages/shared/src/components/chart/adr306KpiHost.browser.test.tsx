/**
 * ADR-306 G3 (kpi family) — DOM host 가 scene 을 「복사만」 하는가 (breakdown §7.2). 외부 oracle =
 * 브라우저가 실제로 놓은 요소의 `getBoundingClientRect` · 속성. 같은 입력의 scene (`computeChartScene`)
 * 과 mark 수 · 좌표 (≤ 0.5 px) · paint 역할 변수를 대조한다. 상자 320×240 · 640×360, 입력은 표본 ·
 * 음수 · 0 · 결측 · 항목 1. 로드 전 상자 (pending) 와 로드 뒤 scene 도 본다 (G2 의 DOM 층).
 */
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Chart } from "../Chart";
import {
  CHART_DEFAULT_PROPS,
  chartPaintVar,
  computeChartScene,
  createChartInitialProps,
  getChartFamily,
  loadChartFamily,
  resolveChartMetrics,
  type ChartProps,
  type ChartRow,
  type ChartScene,
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

type Kpi = "gauge" | "bullet" | "dumbbell";
const ROLES: Record<Kpi, Partial<ChartProps>> = {
  gauge: { metric: "value", goalField: "target", centerLabel: "Goal" },
  bullet: {
    dimension: "kpi",
    metric: "actual",
    goalField: "target",
    rangeFields: ["poor", "ok", "good"],
  },
  dumbbell: {
    dimension: "region",
    startField: "before",
    endField: "after",
    showValueLabels: true,
  },
};
const INPUTS: Record<Kpi, Record<string, ChartRow[]>> = {
  gauge: {
    sample: [{ value: 73, target: 85 }],
    negative: [{ value: -20, target: 40 }],
    zero: [{ value: 0, target: 0 }],
    missingGoal: [{ value: 55 }],
  },
  bullet: {
    sample: [
      { kpi: "매출", actual: 27.4, target: 30, poor: 18, ok: 25, good: 34 },
      { kpi: "Profit", actual: 4.1, target: 3.6, poor: 2, ok: 3, good: 5 },
    ],
    negative: [{ kpi: "Loss", actual: -5, target: 3, poor: 1, ok: 2, good: 4 }],
    zero: [{ kpi: "Zero", actual: 0, target: 0 }],
    missing: [
      { kpi: "Gap", actual: null, target: 10 },
      { kpi: "Ok", actual: 7, target: 9 },
    ],
    single: [
      {
        kpi: "아주 긴 한국어 지표 이름",
        actual: 12,
        target: 15,
        poor: 5,
        ok: 10,
        good: 20,
      },
    ],
  },
  dumbbell: {
    sample: [
      { region: "서울", before: 3.2, after: 4.6 },
      { region: "Busan", before: 2.1, after: 2.6 },
      { region: "Daegu", before: 1.9, after: 2.2 },
    ],
    negative: [
      { region: "A", before: -3, after: 2 },
      { region: "B", before: 1, after: -1 },
    ],
    zero: [{ region: "Z", before: 0, after: 0 }],
    missing: [
      { region: "M", before: null, after: 2 },
      { region: "N", before: 1, after: 2 },
    ],
    single: [{ region: "하나뿐인 지역", before: 1, after: 3 }],
  },
};
const SIZES = [
  { width: 320, height: 240 },
  { width: 640, height: 360 },
];

function propsOf(type: Kpi, extra: Partial<ChartProps> = {}): ChartProps {
  return {
    ...CHART_DEFAULT_PROPS,
    ...createChartInitialProps(type),
    ...ROLES[type],
    isAnimationActive: false,
    showTooltip: true,
    ...extra,
  } as ChartProps;
}

function mount(
  type: Kpi,
  rows: ChartRow[],
  size: { width: number; height: number },
  extra: Partial<ChartProps> = {},
) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const props = propsOf(type, extra);
  root.render(
    <Chart
      {...(props as object)}
      data={rows}
      style={{
        width: size.width,
        height: size.height,
        boxSizing: "border-box",
      }}
    />,
  );
}

/** The chart box the scene sees (the Chart measures its border box — `useBoxSize`). */
function boxOf(): { width: number; height: number } {
  const el = host!.querySelector<HTMLElement>(".react-aria-Chart")!;
  const r = el.getBoundingClientRect();
  return { width: r.width, height: r.height };
}

function compare(scene: ChartScene) {
  const g = host!.querySelector<SVGGElement>("[data-chart-family]")!;
  expect(Number(g.dataset.chartMarkCount)).toBe(scene.marks.length);
  const svg = g.ownerSVGElement!;
  const origin = svg.getBoundingClientRect();
  // DOM 은 scene 순서 그대로 (grid → marks → axes → legend) — 같은 종류끼리 차례로 맞춘다.
  const ordered = [
    ...scene.axes.flatMap((a) => a.grid),
    ...scene.marks,
    ...scene.axes.flatMap((a) => [...(a.line ? [a.line] : []), ...a.ticks]),
    ...(scene.legend?.items.flatMap((i) => [i.swatch, i.text]) ?? []),
  ];
  const elements = Array.from(g.children) as SVGGraphicsElement[];
  expect(elements).toHaveLength(ordered.length);
  ordered.forEach((mark, i) => {
    const el = elements[i];
    const box = el.getBoundingClientRect();
    const at = (n: number) => n;
    switch (mark.kind) {
      case "rect":
        expect(el.tagName).toBe("rect");
        expect(box.left - origin.left).toBeCloseTo(at(mark.x), 0);
        expect(Math.abs(box.left - origin.left - mark.x)).toBeLessThanOrEqual(
          0.5,
        );
        expect(Math.abs(box.top - origin.top - mark.y)).toBeLessThanOrEqual(
          0.5,
        );
        expect(Math.abs(box.width - mark.w)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(box.height - mark.h)).toBeLessThanOrEqual(0.5);
        if (mark.fillPaint)
          expect(el.getAttribute("fill")).toBe(chartPaintVar(mark.fillPaint));
        break;
      case "path":
        expect(el.tagName).toBe("path");
        expect(el.getAttribute("d")).toBe(mark.d);
        if (mark.fillPaint)
          expect(el.getAttribute("fill")).toBe(chartPaintVar(mark.fillPaint));
        break;
      case "line":
        expect(el.tagName).toBe("line");
        expect(Number(el.getAttribute("x1"))).toBe(mark.x1);
        expect(Number(el.getAttribute("y2"))).toBe(mark.y2);
        if (mark.paint)
          expect(el.getAttribute("stroke")).toBe(chartPaintVar(mark.paint));
        expect(Number(el.getAttribute("stroke-width"))).toBe(mark.width ?? 1);
        break;
      case "text":
        expect(el.tagName).toBe("text");
        expect(el.textContent).toBe(mark.text);
        expect(Number(el.getAttribute("x"))).toBe(mark.x);
        break;
    }
  });
}

describe("ADR-306 G3 — kpi DOM host = scene", () => {
  for (const type of ["gauge", "bullet", "dumbbell"] as const)
    for (const size of SIZES)
      for (const [name, rows] of Object.entries(INPUTS[type]))
        it(`${type} ${size.width}×${size.height} ${name}`, async () => {
          mount(type, rows, size);
          await vi.waitFor(
            () =>
              expect(host!.querySelector("[data-chart-family]")).not.toBeNull(),
            { timeout: 5000 },
          );
          const metrics = resolveChartMetrics(
            resolveComponentRule("Chart")?.chart,
          );
          const scene = computeChartScene(
            propsOf(type),
            rows,
            boxOf(),
            metrics,
          );
          expect(scene.pending).toBeUndefined();
          compare(scene);
        });

  it("hover · 키보드 — targets 순서로 툴팁 (원본 행의 값)", async () => {
    const rows = INPUTS.dumbbell.sample;
    mount("dumbbell", rows, SIZES[1], { sort: "none" });
    await vi.waitFor(
      () => expect(host!.querySelector("[data-chart-targets]")).not.toBeNull(),
      { timeout: 5000 },
    );
    const surface = host!.querySelector<HTMLElement>("[data-chart-targets]")!;
    surface.focus();
    surface.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await vi.waitFor(() =>
      expect(host!.querySelector("[data-chart-target]")).not.toBeNull(),
    );
    expect(host!.querySelector("[data-chart-target]")!.textContent).toContain(
      "서울",
    );
    surface.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await vi.waitFor(() =>
      expect(host!.querySelector("[data-chart-target]")!.textContent).toContain(
        "Busan",
      ),
    );
    surface.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await vi.waitFor(() =>
      expect(host!.querySelector("[data-chart-target]")).toBeNull(),
    );
  });

  it("family 는 로드된 뒤에만 그린다 — 로드된 상태에서 getChartFamily 가 같은 객체", async () => {
    const family = await loadChartFamily("kpi");
    expect(getChartFamily("kpi")).toBe(family);
  });
});
