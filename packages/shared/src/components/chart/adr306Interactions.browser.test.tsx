/**
 * ADR-306 G3 (Phase 6 — 공통 상호작용) — Recharts DOM 이 Canvas scene 과 같은 주석 · 손익 색 · 예측 파선을
 * 그리는가. 두 consumer 는 같은 builder (`buildSeriesDecor`) 를 같은 격자 · 스케일로 부른다 — 외부 oracle 은
 * 브라우저가 실제로 놓은 요소 (rect 상자 · path d · 자르기 svg 상자 · 글자 x).
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

const GAP: ChartRow[] = ROWS.map((r) =>
  r.category === "Tue" && r.series === "A" ? { ...r, value: -5 } : r,
);
const num = (el: Element, a: string) => Number(el.getAttribute(a));

describe("ADR-306 G3 — Phase 6 주석 · 손익 색 DOM = scene", () => {
  it("주석 — 아래 면 상자 · 위 글자 x 가 scene 과 같다", async () => {
    const scene = await mount(
      {
        chartType: "line",
        showLegend: false,
        annotations: [
          { type: "band", y: 30, yEnd: 40, label: "Goal" },
          { type: "band", x: "Tue", xEnd: "Wed" },
          { type: "event", x: "Thu", label: "Launch" },
          { type: "trend" },
        ],
      },
      ROWS,
    );
    const sceneRects = scene.marks
      .filter((m) => m.kind === "rect" && m.fillPaint !== undefined)
      .map((m) => m.kind === "rect" && [m.x, m.y, m.w, m.h].join());
    expect(sceneRects).toHaveLength(2);
    const domRects = Array.from(
      host!.querySelectorAll<SVGRectElement>("[data-chart-grid] rect"),
    ).map((r) =>
      [num(r, "x"), num(r, "y"), num(r, "width"), num(r, "height")].join(),
    );
    for (const r of sceneRects) expect(domRects).toContain(r);
    const names = texts(scene.marks)
      .filter((t) => ["Goal", "Launch", "Trend"].includes(t.text))
      .map((t) => ({ text: t.text, x: t.x }));
    expect(names).toHaveLength(3);
    const dom = domTexts("[data-chart-annotations]");
    for (const n of names) expect(dom).toContainEqual(n);
  });

  it("손익 색 · 예측 — 나눠 칠한 path d · 자르기 상자가 scene 과 같고 Recharts 선은 숨는다", async () => {
    const scene = await mount(
      {
        chartType: "line",
        showLegend: false,
        signColors: true,
        annotations: [{ type: "forecast", x: "Wed" }],
      },
      GAP,
    );
    const styled = scene.marks.filter(
      (m): m is PathMark => m.kind === "path" && m.clip !== undefined,
    );
    // A: 앞 · 뒤 × 위 · 아래 = 4, B: 앞 · 뒤 = 2.
    expect(styled).toHaveLength(6);
    const dom = Array.from(
      host!.querySelectorAll<SVGSVGElement>("[data-chart-series-style] > svg"),
    ).map((svg) => ({
      box: [
        num(svg, "x"),
        num(svg, "y"),
        num(svg, "width"),
        num(svg, "height"),
      ].join(),
      d: svg.querySelector("path")!.getAttribute("d"),
      dash: svg.querySelector("path")!.getAttribute("stroke-dasharray"),
    }));
    expect(dom).toEqual(
      styled.map((m) => ({
        box: [m.clip!.x, m.clip!.y, m.clip!.w, m.clip!.h].join(),
        d: m.d,
        dash: m.dash ? m.dash.join(" ") : null,
      })),
    );
    for (const curve of host!.querySelectorAll(".recharts-line-curve"))
      expect(curve.getAttribute("stroke")).toBe("none");
  });
});

describe("ADR-306 G3 — Phase 6 강조 DOM = scene", () => {
  it("line highlight B — A 선은 neutral (others 토큰), B 는 팔레트 · scene 과 같은 색 index", async () => {
    const scene = await mount(
      { chartType: "line", showLegend: false, highlight: ["B"] },
      ROWS,
    );
    const strokes = scene.marks
      .filter(
        (m): m is PathMark => m.kind === "path" && m.strokeSeries !== undefined,
      )
      .map((m) => m.strokeSeries);
    expect(strokes).toEqual([-1, 1]);
    const dom = Array.from(
      host!.querySelectorAll<SVGPathElement>(".recharts-line-curve"),
    ).map((p) => p.getAttribute("stroke"));
    expect(dom).toEqual([
      "var(--chart-others, currentColor)",
      "var(--chart-series-2, currentColor)",
    ]);
  });

  it("pie highlight Tue — Tue 조각만 팔레트, 나머지 others (scene fillSeries 와 같다)", async () => {
    const rows = ROWS.filter((r) => r.series === "A");
    const scene = await mount(
      {
        chartType: "pie",
        color: undefined,
        showLegend: false,
        highlight: ["Tue"],
      },
      rows,
    );
    const fills = scene.marks
      .filter(
        (m): m is PathMark => m.kind === "path" && m.fillSeries !== undefined,
      )
      .map((m) => m.fillSeries);
    expect(fills).toEqual([-1, 1, -1, -1]);
    const dom = Array.from(
      host!.querySelectorAll<SVGPathElement>(".recharts-pie-sector path"),
    ).map((p) => p.getAttribute("fill"));
    expect(dom).toEqual([
      "var(--chart-others, currentColor)",
      "var(--chart-series-2, currentColor)",
      "var(--chart-others, currentColor)",
      "var(--chart-others, currentColor)",
    ]);
  });
});

/** recharts 표면 위 scene 좌표 (x, y) 에 포인터 이벤트를 보낸다. */
function pointer(type: string, x: number, y: number) {
  const surface = host!.querySelector<SVGSVGElement>("svg.recharts-surface")!;
  const box = surface.getBoundingClientRect();
  const target =
    surface.querySelector(
      ".recharts-line-curve, .recharts-bar-rectangle path, path",
    ) ?? surface;
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerType: "mouse",
      pointerId: 1,
      button: 0,
      clientX: box.left + x,
      clientY: box.top + y,
    }),
  );
}

describe("ADR-306 Phase 6 — 범위 선택 · 확대 · 동기화 (Preview 실행 상태)", () => {
  it("select — Mon ~ Thu 를 끌면 띠 · 등락 (A: 12 → 24 = +100%) · 최고 · 최저", async () => {
    const scene = await mount(
      { chartType: "line", showLegend: false, brush: "select" },
      ROWS,
    );
    const xs = scene.axes.find((a) => a.axis === "x")!.ticks.map((t) => t.x);
    const y = scene.plot.y + scene.plot.h / 2;
    pointer("pointerdown", xs[0], y);
    pointer("pointermove", xs[3], y);
    pointer("pointerup", xs[3], y);
    await vi.waitFor(() =>
      expect(
        host!.querySelector("[data-chart-interaction] rect"),
      ).not.toBeNull(),
    );
    const words = Array.from(
      host!.querySelectorAll("[data-chart-interaction] text"),
    ).map((t) => t.textContent);
    expect(words).toContain("+100% · Mon~Thu");
    expect(words).toContain("High 30");
    expect(words).toContain("Low 12");
  });

  it("zoom — Tue ~ Wed 를 끌면 그 두 범주만 · 「Show all」 로 돌아온다", async () => {
    const scene = await mount(
      { chartType: "bar", showLegend: false, brush: "zoom" },
      ROWS,
    );
    const xs = scene.axes.find((a) => a.axis === "x")!.ticks.map((t) => t.x);
    const y = scene.plot.y + scene.plot.h / 2;
    pointer("pointerdown", xs[1], y);
    pointer("pointermove", xs[2], y);
    pointer("pointerup", xs[2], y);
    await vi.waitFor(() =>
      expect(host!.querySelector("[data-chart-zoom-reset]")).not.toBeNull(),
    );
    const ticks = () =>
      domTexts("[data-chart-decoration]")
        .map((t) => t.text)
        .filter((t) => ["Mon", "Tue", "Wed", "Thu"].includes(t!));
    expect(ticks()).toEqual(["Tue", "Wed"]);
    host!.querySelector<HTMLButtonElement>("[data-chart-zoom-reset]")!.click();
    await vi.waitFor(() =>
      expect(host!.querySelector("[data-chart-zoom-reset]")).toBeNull(),
    );
    expect(ticks()).toEqual(["Mon", "Tue", "Wed", "Thu"]);
  });

  it("sync — 같은 syncId 의 다른 차트가 가리킨 범주에 안내선 · 값", async () => {
    const scene = await mount(
      { chartType: "line", showLegend: false, syncId: "g1" },
      ROWS,
    );
    const { sendChartSync } = await import("./chartInteraction");
    sendChartSync("g1", "Wed", {});
    await vi.waitFor(() =>
      expect(
        host!.querySelector("[data-chart-interaction] line"),
      ).not.toBeNull(),
    );
    const line = host!.querySelector("[data-chart-interaction] line")!;
    const wed = scene.axes
      .find((a) => a.axis === "x")!
      .ticks.find((t) => t.text === "Wed")!;
    expect(Number(line.getAttribute("x1"))).toBeCloseTo(wed.x, 1);
    expect(
      host!.querySelector("[data-chart-interaction] text")!.textContent,
    ).toBe("Wed · 18");
    sendChartSync("g1", null, {});
    await vi.waitFor(() =>
      expect(host!.querySelector("[data-chart-interaction] line")).toBeNull(),
    );
  });
});

describe("ADR-306 Phase 6 — candlestick (family host) · 보내기", () => {
  it("Recharts 차트를 가리키면 같은 syncId 로 범주 이름을 보낸다", async () => {
    const scene = await mount(
      { chartType: "line", showLegend: false, syncId: "g2" },
      ROWS,
    );
    const { joinChartSync } = await import("./chartInteraction");
    const got: (string | null)[] = [];
    const leave = joinChartSync("g2", (label) => got.push(label));
    const wrapper = host!.querySelector<HTMLElement>(".recharts-wrapper")!;
    const box = wrapper.getBoundingClientRect();
    const thu = scene.axes
      .find((a) => a.axis === "x")!
      .ticks.find((t) => t.text === "Thu")!;
    for (const type of ["mouseenter", "mousemove"])
      wrapper.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          clientX: box.left + thu.x,
          clientY: box.top + scene.plot.y + scene.plot.h / 2,
        }),
      );
    await vi.waitFor(() => expect(got).toContain("Thu"));
    // 판독 MEDIUM-1 — 그림 밖 (왼쪽 축 글자 자리) 으로 나가면 첫 범주 (Mon) 가 아니라 null.
    wrapper.dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        clientX: box.left + 2,
        clientY: box.top + scene.plot.y + scene.plot.h / 2,
      }),
    );
    await vi.waitFor(() => expect(got[got.length - 1]).toBeNull());
    expect(got).not.toContain("Mon");
    leave();
  });

  it("candlestick — highlight last 는 종가 파선 · 범위 선택 띠 (family host)", async () => {
    const { loadChartFamily, getChartDescriptor } =
      await import("@composition/rendering");
    const matrix = await loadChartFamily("matrix");
    const rows = matrix.sample("candlestick").slice(0, 20) as ChartRow[];
    const scene = await mount(
      {
        ...getChartDescriptor("candlestick").defaults,
        chartType: "candlestick",
        ...matrix.sampleProps("candlestick"),
        color: undefined,
        highlight: ["last"],
        brush: "select",
      },
      rows,
    );
    const mark = scene.marks.find(
      (m) =>
        m.kind === "line" && m.role === "reference" && m.dash?.join() === "3,3",
    );
    expect(mark).toBeTruthy();
    const targets = scene.targets!;
    await vi.waitFor(
      () => expect(host!.querySelector("[data-chart-targets]")).not.toBeNull(),
      { timeout: 5000 },
    );
    const surface = host!.querySelector<HTMLElement>("[data-chart-targets]")!;
    const box = surface.getBoundingClientRect();
    const fire = (type: string, x: number) =>
      host!.querySelector("svg.recharts-surface")!.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerType: "mouse",
          pointerId: 2,
          button: 0,
          clientX: box.left + x,
          clientY: box.top + targets[0].rect!.y + 20,
        }),
      );
    fire("pointerdown", targets[2].x);
    fire("pointermove", targets[8].x);
    fire("pointerup", targets[8].x);
    await vi.waitFor(() =>
      expect(
        host!.querySelector("[data-chart-interaction] rect"),
      ).not.toBeNull(),
    );
  });
});
