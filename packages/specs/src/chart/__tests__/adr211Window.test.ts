/**
 * ADR-211 P3 (G3) — 창 트랙 예약 · 비활성 트랙 마크 · 창 뷰 상태 clamp.
 *
 * 계약 (breakdown §2.2 · §2.5): 창 모드에서 `n > fitEff` 면 두 leg 가 플롯 아래에 같은
 * 높이 (`windowTrackHeight 24`) 를 예약한다 — 예약 여부는 입력만으로 정해지고 (`n > fitEff`),
 * 플롯이 줄어 fit 이 다시 줄어도 (수평 bar) 판정은 뒤집히지 않는다. Canvas 는 그 자리에
 * 비활성 트랙 (fillRole 마크 2개) 을 그리고, DOM 은 Slider 를 얹는다 (live 하니스).
 */
import { describe, expect, it } from "vitest";
import {
  CHART_BUDGET_DEFAULTS,
  CHART_DEFAULT_METRICS,
  CHART_DEFAULT_PROPS,
  CHART_WINDOW_THUMB,
  CHART_WINDOW_TRACK_BAR,
  computeChartScene,
  resolveChartData,
  resolveChartLayout,
  resolveChartModel,
  resolveChartPresentation,
  buildSeriesGrid,
} from "../index";
import type { ChartProps, ChartRow } from "../index";

const metrics = CHART_DEFAULT_METRICS;
const TRACK = CHART_BUDGET_DEFAULTS.windowTrackHeight;

function categoryRows(n: number): ChartRow[] {
  return Array.from({ length: n }, (_, i) => ({
    category: `c${i}`,
    value: (i * 7) % 13,
  }));
}
const bar = (patch: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  chartType: "bar",
  dimension: "category",
  metric: "value",
  showLegend: false,
  ...patch,
});

describe("ADR-211 P3 — 창 트랙 예약", () => {
  it("범주가 넘치면 트랙 높이만큼 플롯이 줄고 트랙은 플롯 폭·바로 아래 (축 여백 위) 에 놓인다", () => {
    const size = { width: 400, height: 300 };
    const rows = categoryRows(200);
    const plain = resolveChartModel(rows, bar(), { size, metrics });
    expect(plain.budget.mode).toBe("window");
    expect(plain.budget.n).toBeGreaterThan(plain.budget.fitEff);
    const track = plain.layout.windowTrack;
    expect(track).not.toBeNull();
    expect(track!.h).toBe(TRACK);
    expect(track!.x).toBe(plain.layout.plot.x);
    expect(track!.w).toBe(plain.layout.plot.w);
    // 트랙 없이 푼 layout 과 비교 — 플롯 높이 차이가 정확히 트랙 높이다 (수직 bar: fit 불변).
    const presentation = resolveChartPresentation(bar(), metrics.seriesCount);
    const grid = buildSeriesGrid(
      rows,
      bar(),
      metrics.seriesCount,
      presentation,
    );
    const noTrack = resolveChartLayout(
      bar(),
      grid,
      size,
      metrics,
      presentation,
    );
    expect(noTrack.windowTrack).toBeNull();
    expect(plain.layout.plot.h).toBeCloseTo(noTrack.plot.h - TRACK, 6);
    expect(plain.layout.plot.y).toBe(noTrack.plot.y);
    // 트랙은 축 여백 (fontSize × 1.6) 아래 — 플롯 바닥 + 축 여백 = 트랙 y.
    expect(track!.y).toBeCloseTo(
      plain.layout.plot.y + plain.layout.plot.h + metrics.fontSize * 1.6,
      1,
    );
  });

  it("넘치지 않으면 (n ≤ fitEff) 예약도 트랙 마크도 없다", () => {
    const size = { width: 400, height: 300 };
    const model = resolveChartModel(categoryRows(10), bar(), { size, metrics });
    expect(model.budget.overflow).toBe(false);
    expect(model.layout.windowTrack).toBeNull();
    const scene = computeChartScene(bar(), categoryRows(10), size, metrics);
    expect(scene.windowTrack).toBeUndefined();
    expect(scene.marks.some((m) => m.kind === "path" && m.fillRole)).toBe(
      false,
    );
  });

  it("수평 bar 는 플롯 높이가 예산 축이라 fit 이 floor(24 / minSlot) = 3 줄고 창 판정은 유지된다", () => {
    const size = { width: 400, height: 300 };
    const rows = categoryRows(200);
    const props = bar({ orientation: "horizontal" });
    const presentation = resolveChartPresentation(props, metrics.seriesCount);
    const grid = buildSeriesGrid(
      rows,
      props,
      metrics.seriesCount,
      presentation,
    );
    const noTrack = resolveChartLayout(
      props,
      grid,
      size,
      metrics,
      presentation,
    );
    const model = resolveChartModel(rows, props, { size, metrics });
    const fitWithout = Math.floor(
      noTrack.plot.h / CHART_BUDGET_DEFAULTS.minSlot,
    );
    expect(model.budget.fit).toBe(
      fitWithout - TRACK / CHART_BUDGET_DEFAULTS.minSlot,
    );
    expect(model.budget.mode).toBe("window");
    expect(model.layout.windowTrack).not.toBeNull();
    expect(model.visible.categories).toHaveLength(model.budget.fitEff);
  });

  it("집계·others 모드는 트랙을 예약하지 않는다 (창만 컨트롤이 있다)", () => {
    const size = { width: 400, height: 300 };
    const ordinal = Array.from({ length: 200 }, (_, i) => ({
      category: new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10),
      value: i % 9,
    }));
    const agg = resolveChartModel(ordinal, bar(), { size, metrics });
    expect(agg.budget.applied).toBe("aggregate");
    expect(agg.layout.windowTrack).toBeNull();
    const pie = resolveChartModel(
      categoryRows(200),
      bar({ chartType: "pie" }),
      { size: { width: 120, height: 120 }, metrics },
    );
    expect(pie.budget.applied).toBe("others");
    expect(pie.layout.windowTrack).toBeNull();
  });
});

describe("ADR-211 P3 — Canvas 비활성 트랙 마크", () => {
  it("scene 끝에 트랙 막대 (grid 채움) + 창 0 thumb (axis 채움) 가 실리고 scene.windowTrack 이 자리다", () => {
    const size = { width: 400, height: 300 };
    const props = bar();
    const scene = computeChartScene(props, categoryRows(200), size, metrics);
    const model = resolveChartModel(categoryRows(200), props, {
      size,
      metrics,
    });
    expect(scene.windowTrack).toEqual(model.layout.windowTrack);
    const tail = scene.marks.slice(-2);
    expect(tail.map((m) => (m.kind === "path" ? m.fillRole : null))).toEqual([
      "grid",
      "axis",
    ]);
    const [barMark, thumb] = tail as Array<
      Extract<(typeof tail)[number], { kind: "path" }>
    >;
    const track = scene.windowTrack!;
    expect(barMark.bbox.w).toBe(track.w);
    expect(barMark.bbox.h).toBe(CHART_WINDOW_TRACK_BAR);
    expect(barMark.bbox.y + barMark.bbox.h / 2).toBeCloseTo(
      track.y + track.h / 2,
    );
    expect(thumb.bbox.w).toBe(CHART_WINDOW_THUMB);
    // thumb 중심 = 트랙 왼쪽 끝 (창 0 = Slider 0%).
    expect(thumb.bbox.x + thumb.bbox.w / 2).toBeCloseTo(track.x);
    // 데이터 마크 (rect) 수는 트랙과 무관하게 fitEff 다.
    expect(scene.marks.filter((m) => m.kind === "rect")).toHaveLength(
      model.budget.fitEff,
    );
  });
});

describe("ADR-211 P3 — DOM leg 창 뷰 상태", () => {
  it("windowStart 는 [0, n − fitEff] 로 clamp 되고 마지막 창은 길이가 같다; layout·ticks 는 창과 무관", () => {
    const size = { width: 400, height: 300 };
    const rows = categoryRows(200);
    const first = resolveChartData(rows, bar(), metrics.seriesCount, {
      size,
      metrics,
      windowStart: 0,
    });
    const fitEff = first.budget.fitEff;
    const max = first.budget.n - fitEff;
    const last = resolveChartData(rows, bar(), metrics.seriesCount, {
      size,
      metrics,
      windowStart: 10_000,
    });
    expect(last.budget.window).toEqual({ start: max, end: first.budget.n });
    expect(last.grid.categories).toHaveLength(fitEff);
    expect(last.grid.categories[0]).toBe(`c${max}`);
    expect(last.grid.categories.at(-1)).toBe("c199");
    // 축 범위·플롯·트랙 자리는 창 위치와 무관 (domain = transformed 전체).
    expect(last.ticks).toEqual(first.ticks);
    expect(last.layout.plot).toEqual(first.layout.plot);
    expect(last.layout.windowTrack).toEqual(first.layout.windowTrack);
    // 창 안 라벨은 visible index 로 (창 offset 반영) — `labelKey: "category"`.
    const labelled = resolveChartData(
      rows,
      bar({ labelKey: "category" }),
      metrics.seriesCount,
      { size, metrics, windowStart: 10_000 },
    );
    expect(labelled.layout.labelText(0, 0)).toBe(`c${max}`);
    const negative = resolveChartData(rows, bar(), metrics.seriesCount, {
      size,
      metrics,
      windowStart: -5,
    });
    expect(negative.budget.window?.start).toBe(0);
  });
});
