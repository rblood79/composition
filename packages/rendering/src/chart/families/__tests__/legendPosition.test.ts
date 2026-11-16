/**
 * 2026-11-16 /fix — family 범례가 자리 (`legendPosition`) 를 따른다. 전에는 dumbbell · marimekko · stream ·
 * skyline · heatmap 이 위에 고정해 그렸고 segmented 의 목록은 막대 아래 고정이라, 패널의 Legend Position 이
 * 아무것도 바꾸지 않았다.
 *
 * 판정: 범례 글자 (scene `legend` 항목 · `role: "legend"` 글자) 의 무게중심이 자리 쪽으로 간다 — left 는
 * right 보다 왼쪽, top 은 bottom 보다 위. 그림 (범례 밖 마크) 은 범례와 겹치지 않는 쪽에 남는다.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  approxTextWidth,
  chartFrame,
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  chartTypesReading,
  computeChartScene,
  createChartInitialProps,
  getChartDescriptor,
  LEGEND_CHART_GAP,
  loadChartFamily,
  type ChartFamily,
  type ChartLegendPosition,
  type ChartProps,
  type ChartScene,
  type FamilyChartType,
} from "../../index";

const SIZE = { width: 640, height: 420 };
const families = new Map<string, ChartFamily>();
beforeAll(async () => {
  for (const id of ["kpi", "category", "matrix"] as const)
    families.set(id, await loadChartFamily(id));
});

/** 범례를 그리는 family 종류 — 고정 목록 (descriptor 에서 읽으면 옵션이 빠질 때 검사도 같이 사라진다). */
const LEGEND_TYPES: FamilyChartType[] = [
  "dumbbell",
  "segmented",
  "marimekko",
  "stream",
  "skyline",
  "heatmap",
];

function sceneAt(
  type: FamilyChartType,
  position: ChartLegendPosition,
): ChartScene {
  const family = families.get(getChartDescriptor(type).family!)!;
  const props = {
    ...CHART_DEFAULT_PROPS,
    ...getChartDescriptor(type).defaults,
    ...family.sampleProps(type),
    chartType: type,
    showLegend: true,
    legendPosition: position,
  } as ChartProps;
  return computeChartScene(
    props,
    family.sample(type),
    SIZE,
    CHART_DEFAULT_METRICS,
  );
}

function legendCenter(scene: ChartScene): { x: number; y: number } {
  const points = [
    ...(scene.legend?.items.map((item) => item.text) ?? []),
    ...scene.marks.filter(
      (mark) => mark.kind === "text" && mark.role === "legend",
    ),
  ].map((mark) => mark as { x: number; y: number });
  expect(points.length).toBeGreaterThan(0);
  return {
    x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
    y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
  };
}

describe("family legend follows legendPosition", () => {
  it("the panel shows Legend Position for exactly these kinds", () => {
    expect(
      chartTypesReading("legendPosition")
        .filter((type) => getChartDescriptor(type).family !== null)
        .sort(),
    ).toEqual([...LEGEND_TYPES].sort());
  });

  for (const type of LEGEND_TYPES)
    it(`${type} — left is left of right, top is above bottom`, () => {
      const left = legendCenter(sceneAt(type, "left"));
      const right = legendCenter(sceneAt(type, "right"));
      const top = legendCenter(sceneAt(type, "top"));
      const bottom = legendCenter(sceneAt(type, "bottom"));
      expect(left.x).toBeLessThan(right.x - 20);
      expect(top.y).toBeLessThan(bottom.y - 20);
    });

  // 범례를 떼어 낸 종류 (segmented · heatmap 제외 — 목록 · 색 단계는 마크다) 는 scene 의 plot 이 범례 밖이다.
  for (const type of ["dumbbell", "marimekko", "stream", "skyline"] as const)
    it(`${type} — the plot leaves the legend's side`, () => {
      for (const position of ["left", "right", "top", "bottom"] as const) {
        const scene = sceneAt(type, position);
        const items = scene.legend?.items ?? [];
        expect(items.length, position).toBeGreaterThan(0);
        for (const { swatch } of items) {
          const { plot } = scene;
          if (position === "left") expect(swatch.x).toBeLessThan(plot.x);
          if (position === "right")
            expect(swatch.x).toBeGreaterThanOrEqual(plot.x + plot.w);
          if (position === "top") expect(swatch.y).toBeLessThan(plot.y);
          if (position === "bottom")
            expect(swatch.y).toBeGreaterThanOrEqual(plot.y + plot.h);
        }
      }
    });
});

/**
 * 2026-11-16 /fix — 범례와 차트 사이 간격. 범례 상자의 여백이 늘 상자 끝 (아래 · 오른쪽) 에 붙어, bottom 은 축
 * 글자에 4px 까지 붙고 right 는 그림 오른쪽 끝에 0px 로 붙었다 (사용자 보고 「bottom 일 때 chart 와 여백이 없다」).
 * 네 방향 모두 차트 내용 (축 글자 · 그림) 기준 16px (`LEGEND_CHART_GAP` — 사용자 결정 「위, 아래 8px」 → 16px ·
 * 좌우도 16px). 시리즈 (bar · line · pie · radar · radial) 와 family 가 같은 `buildLegend` 를 지나고, heatmap 색 단계 ·
 * segmented 목록도 같은 간격이다. 글자 폭은 배치가 쓰는 추정 (`approxTextWidth`) 으로 잰다.
 */
describe("legend keeps 16px from the chart on every side", () => {
  type Box = { t: number; b: number; l: number; r: number };
  const fontSize = CHART_DEFAULT_METRICS.fontSize;
  const half = fontSize / 2;
  const extent = (mark: Record<string, unknown>): Box | null => {
    const m = mark as Record<string, number> & {
      kind: string;
      baseline?: string;
      anchor?: string;
      text?: string;
      bbox?: { x: number; y: number; w: number; h: number };
    };
    if (m.kind === "text") {
      const w = approxTextWidth(String(m.text ?? ""), fontSize);
      const [l, r] =
        m.anchor === "start"
          ? [m.x, m.x + w]
          : m.anchor === "end"
            ? [m.x - w, m.x]
            : [m.x - w / 2, m.x + w / 2];
      const [t, b] =
        m.baseline === "top"
          ? [m.y, m.y + half * 2]
          : m.baseline === "bottom"
            ? [m.y - half * 2, m.y]
            : [m.y - half, m.y + half];
      return { t, b, l, r };
    }
    if (m.kind === "line")
      return {
        t: Math.min(m.y1, m.y2),
        b: Math.max(m.y1, m.y2),
        l: Math.min(m.x1, m.x2),
        r: Math.max(m.x1, m.x2),
      };
    if (m.bbox)
      return {
        t: m.bbox.y,
        b: m.bbox.y + m.bbox.h,
        l: m.bbox.x,
        r: m.bbox.x + m.bbox.w,
      };
    if (m.kind === "rect") return { t: m.y, b: m.y + m.h, l: m.x, r: m.x + m.w };
    if (m.kind === "circle")
      return { t: m.cy - m.r, b: m.cy + m.r, l: m.cx - m.r, r: m.cx + m.r };
    return null;
  };
  const span = (marks: readonly Record<string, unknown>[]): Box => {
    const boxes = marks.map(extent).filter((b): b is Box => b !== null);
    return {
      t: Math.min(...boxes.map((b) => b.t)),
      b: Math.max(...boxes.map((b) => b.b)),
      l: Math.min(...boxes.map((b) => b.l)),
      r: Math.max(...boxes.map((b) => b.r)),
    };
  };
  /** 범례 · 차트 내용을 가른다 — 범례는 scene `legend` 항목, heatmap 은 색 단계 띠, segmented 는 목록. */
  const split = (type: string, scene: ChartScene) => {
    const all = [
      ...scene.axes.flatMap((axis) => [
        ...axis.ticks,
        ...(axis.line ? [axis.line] : []),
        ...axis.grid,
      ]),
      ...scene.marks,
    ] as unknown as Record<string, unknown>[];
    if (type === "heatmap") {
      const legend = (m: Record<string, unknown>) =>
        m.role === "legend" ||
        (m.kind === "rect" &&
          String(m.fillPaint ?? "").startsWith("step-") &&
          m.h === 9);
      return {
        legend: all.filter(legend),
        chart: all.filter((m) => !legend(m)),
      };
    }
    if (type === "segmented")
      return {
        legend: all.filter((m) => m.kind !== "path"),
        chart: all.filter((m) => m.kind === "path"),
      };
    return {
      legend: (scene.legend?.items ?? []).flatMap((item) => [
        item.swatch,
        item.text,
      ]) as unknown as Record<string, unknown>[],
      chart: all,
    };
  };
  const SERIES = ["bar", "line", "pie", "radar", "radial"] as const;
  const POLAR: ReadonlySet<string> = new Set(["pie", "radar", "radial"]);
  type Series = (typeof SERIES)[number];
  const isSeries = (type: string): type is Series =>
    (SERIES as readonly string[]).includes(type);
  const seriesScene = (type: Series, position: ChartLegendPosition) => {
    const initial = createChartInitialProps(type) as unknown as Record<
      string,
      unknown
    >;
    return computeChartScene(
      {
        ...CHART_DEFAULT_PROPS,
        ...initial,
        chartType: type,
        showLegend: true,
        legendPosition: position,
      } as ChartProps,
      initial.data as never,
      SIZE,
      CHART_DEFAULT_METRICS,
    );
  };
  for (const type of [...SERIES, ...LEGEND_TYPES])
    for (const position of ["top", "bottom", "left", "right"] as const)
      it(`${type} — ${position} legend is 16px from the chart`, () => {
        const scene = isSeries(type)
          ? seriesScene(type, position)
          : sceneAt(type, position);
        const { legend, chart } = split(type, scene);
        expect(legend.length).toBeGreaterThan(0);
        const l = span(legend);
        const c = span(chart);
        const gap =
          position === "top"
            ? c.t - l.b
            : position === "bottom"
              ? l.t - c.b
              : position === "left"
                ? c.l - l.r
                : l.l - c.r;
        // 원형 차트의 왼쪽 · 오른쪽 범례는 상자 가장자리에 있고 차트는 가로 가운데라 간격이 16 이상이다 (사용자 결정
        //   「범례로 차트가 좌우로 이동되면 안 된다」 · 「범례는 부모 상자의 left · right」).
        if (POLAR.has(type) && (position === "left" || position === "right"))
          expect(gap).toBeGreaterThanOrEqual(LEGEND_CHART_GAP - 0.5);
        else expect(gap).toBeCloseTo(LEGEND_CHART_GAP, 0);
        // 왼쪽 · 오른쪽 범례는 차트 부모 상자의 그 쪽 끝에 붙는다.
        const frame = chartFrame(SIZE, CHART_DEFAULT_METRICS).outer;
        if (position === "left") expect(l.l).toBeCloseTo(frame.x, 0);
        if (position === "right")
          expect(l.r).toBeCloseTo(frame.x + frame.w, 0);
      });

  // 사용자 결정 (2026-11-16) — 범례로 차트가 좌우로 이동되면 안 된다: 원형 차트의 가로 중심은 범례가 없을 때와 같은
  //   상자 가운데다 (범례가 차트 옆으로 붙는다).
  for (const type of ["pie", "radar", "radial"] as const)
    it(`${type} — a left or right legend keeps the chart horizontally centred`, () => {
      const centre = (position: ChartLegendPosition | null) => {
        const scene =
          position === null
            ? computeChartScene(
                {
                  ...CHART_DEFAULT_PROPS,
                  ...(createChartInitialProps(type) as unknown as Record<string, unknown>),
                  chartType: type,
                  showLegend: false,
                } as ChartProps,
                (createChartInitialProps(type) as unknown as { data: never }).data,
                SIZE,
                CHART_DEFAULT_METRICS,
              )
            : seriesScene(type, position);
        return scene.plot.x + scene.plot.w / 2;
      };
      expect(centre("left")).toBeCloseTo(centre(null), 1);
      expect(centre("right")).toBeCloseTo(centre(null), 1);
    });
});
