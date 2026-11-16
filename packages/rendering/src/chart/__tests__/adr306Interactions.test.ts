/**
 * ADR-306 Phase 6 G4 — 공통 상호작용의 손계산 (외부 oracle = 식에서 손으로 계산한 값, ztd-charts 0.5.0
 * `core/highlight.ts` · `core/annotations.tsx` · `charts/line.tsx` 의 규칙).
 *
 * 표본 (line, 480 × 300, 시리즈 A · B, 범주 4): 값 축 · 범주 축 좌표는 scene 의 축 눈금 · plot 에서 읽어
 * 손계산과 비교한다 (값 → 좌표 = plot 안 선형 보간).
 */
import { describe, expect, it } from "vitest";
import {
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  computeChartScene,
} from "../index";
import { resolveHighlight } from "../highlight";
import type {
  ChartProps,
  ChartRow,
  ChartScene,
  LineMark,
  Mark,
  PathMark,
  RectMark,
  TextMark,
} from "../types";

const ROWS: ChartRow[] = [
  { category: "Mon", value: 12, series: "A" },
  { category: "Tue", value: -5, series: "A" },
  { category: "Wed", value: 18, series: "A" },
  { category: "Thu", value: 24, series: "A" },
  { category: "Mon", value: 20, series: "B" },
  { category: "Tue", value: 8, series: "B" },
  { category: "Wed", value: 25, series: "B" },
  { category: "Thu", value: 14, series: "B" },
];
const SIZE = { width: 480, height: 300 };
const props = (patch: Partial<ChartProps>): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  chartType: "line",
  color: "series",
  ...patch,
});
const scene = (patch: Partial<ChartProps>, rows = ROWS) =>
  computeChartScene(props(patch), rows, SIZE, CHART_DEFAULT_METRICS);
const rects = (m: readonly Mark[]) =>
  m.filter((x): x is RectMark => x.kind === "rect");
const lines = (m: readonly Mark[]) =>
  m.filter((x): x is LineMark => x.kind === "line");
const paths = (m: readonly Mark[]) =>
  m.filter((x): x is PathMark => x.kind === "path");
const texts = (m: readonly Mark[]) =>
  m.filter((x): x is TextMark => x.kind === "text");

/** scene 의 값 축 domain · plot 으로 값 → y (세로 차트). */
function yOf(s: ChartScene, v: number): number {
  const ticks = s.axes.find((a) => a.axis === "y")!.ticks;
  const lo = Number(ticks[0].text);
  const hi = Number(ticks[ticks.length - 1].text);
  return s.plot.y + s.plot.h - ((v - lo) / (hi - lo)) * s.plot.h;
}
/** 범주 i 의 중앙 x (band paddingInner 0.2 — step = w / n, 중앙 = x + step·i + step/2). */
function xOf(s: ChartScene, i: number, n = 4): number {
  const step = s.plot.w / n;
  return s.plot.x + step * i + step / 2;
}

describe("ADR-306 Phase 6 — highlight (ztd resolveHighlight)", () => {
  const labels = ["a", "b", "c", "d"];
  const values = [3, 9, NaN, 1];
  it("모드 · 이름 · 여럿 · 기본 · none", () => {
    expect([...resolveHighlight(undefined, labels, values, "max")]).toEqual([
      1,
    ]);
    expect([...resolveHighlight(["min"], labels, values, "max")]).toEqual([3]);
    expect([...resolveHighlight(["last", "a"], labels, values, "max")]).toEqual(
      [3, 0],
    );
    expect([...resolveHighlight(["none"], labels, values, "max")]).toEqual([]);
    expect([...resolveHighlight(["zzz"], labels, values, "max")]).toEqual([]);
    expect([...resolveHighlight([], labels, values, "first")]).toEqual([0]);
    expect([...resolveHighlight("c", labels, values, "max")]).toEqual([2]);
  });
});

describe("ADR-306 Phase 6 — 주석 (손계산)", () => {
  it("값 구간 band 30 ~ 40 — 축이 40 까지 넓어지고 accent 0.1 면 + 양 끝 파선", () => {
    const s = scene({ annotations: [{ type: "band", y: 30, yEnd: 40 }] });
    const ticks = s.axes.find((a) => a.axis === "y")!.ticks.map((t) => t.text);
    expect(ticks[ticks.length - 1]).toBe("40");
    const band = rects(s.marks).find((r) => r.fillPaint === "accent")!;
    expect(band.fillOpacity).toBe(0.1);
    expect(band.y).toBeCloseTo(yOf(s, 40), 1);
    expect(band.y + band.h).toBeCloseTo(yOf(s, 30), 1);
    expect(band.x).toBeCloseTo(s.plot.x, 1);
    expect(band.w).toBeCloseTo(s.plot.w, 1);
    const edges = lines(s.marks).filter(
      (l) => l.paint === "accent" && l.dash?.join() === "3,3",
    );
    expect(edges.map((l) => l.y1)).toEqual([band.y, band.y + band.h]);
  });

  it("범주 구간 band Tue ~ Wed — 칸 가장자리까지 (중앙 ± step/2) neutral 0.12", () => {
    const s = scene({ annotations: [{ type: "band", x: "Tue", xEnd: "Wed" }] });
    const shade = rects(s.marks).find((r) => r.fillPaint === "neutral")!;
    const step = s.plot.w / 4;
    expect(shade.x).toBeCloseTo(xOf(s, 1) - step / 2, 1);
    expect(shade.x + shade.w).toBeCloseTo(xOf(s, 2) + step / 2, 1);
    expect(shade.fillOpacity).toBe(0.12);
  });

  it("event Tue — 세로 파선 (2 3) · 바닥 점 · 이름 「Launch」", () => {
    const s = scene({
      annotations: [{ type: "event", x: "Tue", label: "Launch" }],
    });
    const v = lines(s.marks).find((l) => l.dash?.join() === "2,3")!;
    expect(v.x1).toBeCloseTo(xOf(s, 1), 1);
    expect(v.x2).toBe(v.x1);
    expect(v.y2).toBeCloseTo(s.plot.y + s.plot.h, 1);
    expect(texts(s.marks).some((t) => t.text === "Launch")).toBe(true);
    // 이름이 없으면 그리지 않는다 (ztd 와 같음).
    const bare = scene({ annotations: [{ type: "event", x: "Tue" }] });
    expect(lines(bare.marks).some((l) => l.dash?.join() === "2,3")).toBe(false);
  });

  it("forecast Wed — Wed 부터 음영 · 경계 파선 · 선이 Wed 뒤로 파선 (5 4, 자르기 상자 앞 · 뒤)", () => {
    const s = scene({ annotations: [{ type: "forecast", x: "Wed" }] });
    const xf = xOf(s, 2);
    const shade = rects(s.marks).find((r) => r.fillPaint === "neutral")!;
    expect(shade.x).toBeCloseTo(xf, 1);
    expect(shade.x + shade.w).toBeCloseTo(s.plot.x + s.plot.w, 1);
    expect(texts(s.marks).some((t) => t.text === "Forecast")).toBe(true);
    const series = paths(s.marks).filter((p) => p.strokeSeries !== undefined);
    // 시리즈 2 × (앞 실선 + 뒤 파선).
    expect(series).toHaveLength(4);
    const pre = series.filter((p) => !p.dash);
    const post = series.filter((p) => p.dash?.join() === "5,4");
    expect(pre).toHaveLength(2);
    expect(post).toHaveLength(2);
    for (const p of pre) expect(p.clip!.x + p.clip!.w).toBeCloseTo(xf, 1);
    for (const p of post) expect(p.clip!.x).toBeCloseTo(xf, 1);
    // 같은 시리즈의 앞 · 뒤는 같은 path (자르기만 다르다 — ztd clipPath).
    expect(pre[0].d).toBe(post[0].d);
  });

  it("trend — 강조 시리즈 (첫 시리즈 A) 의 최소제곱 직선 (화면 좌표)", () => {
    const s = scene({ annotations: [{ type: "trend" }] });
    const fit = lines(s.marks).find((l) => l.dash?.join() === "6,4")!;
    // A = [12, -5, 18, 24] at i = 0..3 → 최소제곱: 기울기 = Σ(x−x̄)(y−ȳ)/Σ(x−x̄)² (x = 0..3).
    const ys = [12, -5, 18, 24];
    const my = ys.reduce((a, b) => a + b) / 4;
    const slope =
      ys.reduce((a, y, i) => a + (i - 1.5) * (y - my), 0) /
      [0, 1, 2, 3].reduce((a, i) => a + (i - 1.5) ** 2, 0);
    expect(fit.x1).toBeCloseTo(xOf(s, 0), 1);
    expect(fit.x2).toBeCloseTo(xOf(s, 3), 1);
    expect(fit.y1).toBeCloseTo(yOf(s, my - 1.5 * slope), 0);
    expect(fit.y2).toBeCloseTo(yOf(s, my + 1.5 * slope), 0);
    // highlight 로 B 를 고르면 B 의 직선.
    const sb = scene({ annotations: [{ type: "trend" }], highlight: ["B"] });
    const fb = lines(sb.marks).find((l) => l.dash?.join() === "6,4")!;
    expect(fb.y1).not.toBeCloseTo(fit.y1, 0);
  });

  it("weekends — 시간 축 14 일 (2026-01-05 월 ~ 01-18 일) 에 토 · 일 음영 2 칸", () => {
    const rows: ChartRow[] = Array.from({ length: 14 }, (_, i) => ({
      category: `2026-01-${String(5 + i).padStart(2, "0")}`,
      value: 10 + i,
    }));
    const s = scene(
      {
        color: undefined,
        dimensionScale: "time",
        annotations: [{ type: "weekends" }],
      },
      rows,
    );
    expect(
      rects(s.marks).filter((r) => r.fillPaint === "neutral"),
    ).toHaveLength(2);
    // 범주 축 (category) 이면 그리지 않는다 (ztd 도 날짜 x 에서만).
    const c = scene({ annotations: [{ type: "weekends" }] });
    expect(
      rects(c.marks).filter((r) => r.fillPaint === "neutral"),
    ).toHaveLength(0);
  });

  it("bar forecast — 칸 왼쪽 끝부터 (ztd edge)", () => {
    const s = scene({
      chartType: "bar",
      annotations: [{ type: "forecast", x: "Wed" }],
    });
    const shade = rects(s.marks).find((r) => r.fillPaint === "neutral")!;
    expect(shade.x).toBeCloseTo(xOf(s, 2) - s.plot.w / 8, 1);
  });

  it("주석이 없으면 scene 이 그대로 (byte 같음)", () => {
    expect(JSON.stringify(scene({ annotations: [] }))).toBe(
      JSON.stringify(scene({})),
    );
  });
});

describe("ADR-306 Phase 6 — 손익 색 · 띠 시작 · 띠 밖 점", () => {
  it("signColors — 첫 시리즈를 기준값 0 위 · 아래로 (아래 = neutral) · 기준선 · B 는 그대로", () => {
    const s = scene({ signColors: true });
    const y0 = yOf(s, 0);
    const base = lines(s.marks).find(
      (l) => l.role === "axis" && l.y1 === l.y2 && Math.abs(l.y1 - y0) < 0.1,
    );
    expect(base).toBeTruthy();
    const a = paths(s.marks).filter(
      (p) => p.strokeSeries === 0 || p.strokePaint === "neutral",
    );
    expect(a).toHaveLength(2);
    const up = a.find((p) => p.strokeSeries === 0)!;
    const down = a.find((p) => p.strokePaint === "neutral")!;
    expect(up.clip!.y + up.clip!.h).toBeCloseTo(y0, 1);
    expect(down.clip!.y).toBeCloseTo(y0, 1);
    expect(up.d).toBe(down.d);
    expect(paths(s.marks).filter((p) => p.strokeSeries === 1)).toHaveLength(1);
    // 기준값이 값 범위에 들어간다 (값이 모두 양수여도) — baseline 50 → 축 끝 ≥ 50.
    const s50 = scene({ signColors: true, baseline: 50 });
    const t = s50.axes.find((x) => x.axis === "y")!.ticks;
    expect(Number(t[t.length - 1].text)).toBeGreaterThanOrEqual(50);
    // 누적이면 나누지 않는다 (ztd 와 같음).
    const st = scene({ signColors: true, stackType: "stacked" });
    expect(paths(st.marks).some((p) => p.clip)).toBe(false);
  });

  it("bandFrom forecast — 띠가 예측 시작 범주부터 · 예측 주석이 없으면 띠 없음", () => {
    const rows = ROWS.map((r) => ({
      ...r,
      lo: (r.value as number) - 4,
      hi: (r.value as number) + 4,
    }));
    const band = (patch: Partial<ChartProps>) =>
      paths(
        scene({ lowerFields: ["lo"], upperFields: ["hi"], ...patch }, rows)
          .marks,
      ).filter((p) => p.fillOpacity === 0.18);
    const all = band({});
    expect(all).toHaveLength(2);
    const from = band({
      bandFrom: "forecast",
      annotations: [{ type: "forecast", x: "Wed" }],
    });
    expect(from).toHaveLength(2);
    // 같은 scene (띠 값이 축을 넓혀 plot 이 갈린다) 에서 Wed 중앙을 읽는다.
    const s = scene(
      {
        lowerFields: ["lo"],
        upperFields: ["hi"],
        bandFrom: "forecast",
        annotations: [{ type: "forecast", x: "Wed" }],
      },
      rows,
    );
    expect(
      from[0].d.startsWith(`M ${Math.round(xOf(s, 2) * 100) / 100} `),
    ).toBe(true);
    expect(band({ bandFrom: "forecast" })).toHaveLength(0);
  });

  it("outside — 띠 밖 점 (A 의 Tue −5 가 띠 [0, 10] 밖) 하나", () => {
    const rows = ROWS.map((r) => ({
      ...r,
      lo:
        r.category === "Tue" && r.series === "A" ? 0 : (r.value as number) - 1,
      hi:
        r.category === "Tue" && r.series === "A" ? 10 : (r.value as number) + 1,
    }));
    const s = scene(
      { lowerFields: ["lo"], upperFields: ["hi"], outside: true },
      rows,
    );
    const dots = paths(s.marks).filter(
      (p) => p.fillOpacity === 1 && p.fillSeries === 0,
    );
    expect(dots).toHaveLength(1);
    expect(dots[0].bbox.x + dots[0].bbox.w / 2).toBeCloseTo(xOf(s, 1), 1);
    expect(dots[0].bbox.y + dots[0].bbox.h / 2).toBeCloseTo(yOf(s, -5), 1);
  });
});

describe("ADR-306 Phase 6 G3 — Canvas (Skia shape) = scene", () => {
  it("나눠 칠한 선의 자르기 상자 · 파선 · neutral 선, 주석 선 불투명도가 shape 로 넘어간다", async () => {
    const { SKIA_PRIMITIVES } = await import("../../renderers/skiaPrimitives");
    const patch: Partial<ChartProps> = {
      signColors: true,
      annotations: [
        { type: "forecast", x: "Wed" },
        { type: "band", y: 30, yEnd: 40 },
      ],
    };
    const shapes = SKIA_PRIMITIVES.chart_scene!({
      props: {
        ...props(patch),
        data: ROWS,
        _containerWidth: 480,
        _containerHeight: 300,
        _chartRule: {
          series: ["{color.a}", "{color.b}"],
          axis: "{color.axis}",
          grid: "{color.grid}",
          reference: "{color.ref}",
          metrics: { padding: 12, fontSize: 11 },
          paint: { neutral: "{color.neutral-test}", accent: "{color.acc}" },
        },
      },
      size: { height: 300 } as never,
      visual: undefined,
      paint: {
        backgroundColor: "{color.layer-1}",
        color: "{color.n}",
      } as never,
      style: undefined,
    }) as Array<Record<string, unknown>>;
    const clipped = shapes.filter((s) => s.type === "path" && s.clip);
    expect(clipped).toHaveLength(6);
    expect(
      clipped.filter((s) => (s.strokeDasharray as number[])?.join() === "5,4"),
    ).toHaveLength(3);
    expect(
      clipped.filter((s) => s.stroke === "{color.neutral-test}"),
    ).toHaveLength(2);
    const edge = shapes.find(
      (s) =>
        s.type === "line" &&
        (s.strokeDasharray as number[])?.join() === "3,3" &&
        s.stroke === "{color.acc}",
    );
    expect(edge?.strokeAlpha).toBe(0.45);
  });
});

describe("ADR-306 Phase 6 — family 강조 (highlight)", () => {
  const draw = async (
    type: Parameters<typeof import("../authoring").getChartDescriptor>[0],
    patch: Partial<ChartProps>,
  ) => {
    const { getChartDescriptor } = await import("../authoring");
    const { loadChartFamily } = await import("../families/registry");
    const family = await loadChartFamily(getChartDescriptor(type).family!);
    const p = {
      ...CHART_DEFAULT_PROPS,
      ...getChartDescriptor(type).defaults,
      chartType: type,
      ...family.sampleProps(type as never),
      ...patch,
    } as ChartProps;
    return {
      scene: computeChartScene(
        p,
        family.sample(type as never) as ChartRow[],
        SIZE,
        CHART_DEFAULT_METRICS,
      ),
      rows: family.sample(type as never) as ChartRow[],
    };
  };
  const accentCount = (m: readonly Mark[]) =>
    m.filter(
      (x) =>
        (x.kind === "rect" && x.fillPaint === "accent") ||
        (x.kind === "path" && x.fillPaint === "accent"),
    ).length;

  it("비면 그림 그대로 (byte 같음) — 34 종의 기본 강조를 바꾸지 않는다", async () => {
    for (const type of [
      "lollipop",
      "treemap",
      "bullet",
      "candlestick",
    ] as const) {
      const a = await draw(type, {});
      const b = await draw(type, { highlight: [] });
      expect(JSON.stringify(b.scene), type).toBe(JSON.stringify(a.scene));
    }
  });

  it("lollipop min — 가장 작은 값의 점 · 이름이 강조로 옮긴다", async () => {
    const max = await draw("lollipop", {});
    const min = await draw("lollipop", { highlight: ["min"] });
    const heads = (s: ChartScene) =>
      paths(s.marks).filter((p) => p.fillPaint === "accent");
    expect(heads(max.scene)).toHaveLength(1);
    expect(heads(min.scene)).toHaveLength(1);
    // 표본은 큰 값부터 — max 는 맨 위 (y 작음), min 은 맨 아래.
    expect(heads(min.scene)[0].bbox.y).toBeGreaterThan(
      heads(max.scene)[0].bbox.y,
    );
  });

  it("bullet — 지정하면 그 행만 accent, 나머지 neutral (기본은 전부 accent)", async () => {
    const all = await draw("bullet", {});
    const one = await draw("bullet", { highlight: ["min"] });
    const bars = (s: ChartScene) =>
      rects(s.marks).filter((r) => r.fillPaint === "accent").length;
    expect(bars(all.scene)).toBeGreaterThan(1);
    expect(bars(one.scene)).toBe(1);
  });

  it("candlestick last — 마지막 봉 종가에 파선 + 가격 글자 (기본은 없음)", async () => {
    const none = await draw("candlestick", {});
    const last = await draw("candlestick", { highlight: ["last"] });
    const dashed = (s: ChartScene) =>
      lines(s.marks).filter((l) => l.role === "reference" && l.dash);
    expect(dashed(none.scene)).toHaveLength(0);
    expect(dashed(last.scene)).toHaveLength(1);
  });

  it("treemap 이름 — 고른 잎이 accent (가장 큰 잎이 아니어도)", async () => {
    const base = await draw("treemap", {});
    // 가장 작은 잎 (기본 강조 = 가장 큰 잎과 다르다).
    const smallest = [...base.rows]
      .filter((r) => typeof r.product === "string")
      .sort((a, b) => Number(a.share) - Number(b.share))[0];
    const name = String(smallest.product);
    const picked = await draw("treemap", { highlight: [name] });
    expect(accentCount(picked.scene.marks)).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(picked.scene)).not.toBe(JSON.stringify(base.scene));
  });

  it("sparkline min — 표시 점이 가장 작은 값으로 (ztd mark)", async () => {
    const last = await draw("sparkline", {});
    const min = await draw("sparkline", { highlight: ["min"] });
    const dot = (s: ChartScene) =>
      paths(s.marks).find((p) => p.fillPaint === "accent" && p.bbox.w === 6.4)!;
    expect(dot(min.scene).bbox.x).not.toBe(dot(last.scene).bbox.x);
    const none = await draw("sparkline", { highlight: ["none"] });
    expect(
      paths(none.scene.marks).some(
        (p) => p.fillPaint === "accent" && p.bbox.w === 6.4,
      ),
    ).toBe(false);
  });
});

describe("ADR-306 Phase 6 판독 수리", () => {
  it("MEDIUM-2 — 시리즈 색 index 가 겹쳐도 손익 색은 강조 시리즈에 (seriesConfig colorToken)", () => {
    // A 의 색을 B 의 기본 자리 (palette 1) 로 — 둘 다 seriesIndex 1.
    const s = scene({
      signColors: true,
      seriesConfig: [
        { key: JSON.stringify(["group", "A"]), colorToken: "--chart-series-2" },
      ],
    });
    const clipped = paths(s.marks).filter((p) => p.clip);
    expect(clipped).toHaveLength(2);
    expect(clipped.some((p) => p.strokePaint === "neutral")).toBe(true);
  });
});

describe("ADR-306 Phase 6 판독 수리 — 가로 방향", () => {
  it("MEDIUM-3 — horizontal bar 의 주석 이름표가 그림 상자 안 (글자 폭까지)", () => {
    const s = scene({
      chartType: "bar",
      orientation: "horizontal",
      annotations: [
        { type: "forecast", x: "Wed" },
        { type: "event", x: "Tue", label: "Launch event" },
        { type: "band", x: "Mon", xEnd: "Tue", label: "Promo period" },
        { type: "band", y: 5, yEnd: 10, label: "Goal" },
      ],
    });
    const fontSize = 11;
    for (const t of texts(s.marks).filter((m) => m.role === "reference")) {
      const w = t.text.length * fontSize * 0.55;
      const left =
        t.anchor === "end"
          ? t.x - w
          : t.anchor === "middle"
            ? t.x - w / 2
            : t.x;
      expect(left, t.text).toBeGreaterThanOrEqual(s.plot.x - 0.5);
      expect(left + w, t.text).toBeLessThanOrEqual(s.plot.x + s.plot.w + 0.5);
    }
  });
});
