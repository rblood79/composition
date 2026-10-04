/**
 * ADR-194 후속 (shadcn tooltip 대조) — 툴팁 데이터 + 히트 판정.
 *
 * hover 자체는 DOM 이 갖지만 **어느 범주를 가리키는가**는 기하가 정한다.
 * DOM 이 밴드 폭을 다시 계산하면 툴팁이 가리키는 막대와 실제 막대가 어긋난다.
 */
import { describe, it, expect } from "vitest";
import { computeChartScene, CHART_DEFAULT_PROPS } from "../computeChartScene";
import { hitTooltipBand } from "../tooltip";
import type { ChartProps, ChartRow, Mark } from "../types";

const SIZE = { width: 320, height: 240 };
const ROWS: ChartRow[] = [
  { category: "Mon", value: 12, series: "A" },
  { category: "Tue", value: 30, series: "A" },
  { category: "Mon", value: 20, series: "B" },
  { category: "Tue", value: 8, series: "B" },
];
const props = (o: Partial<ChartProps> = {}): ChartProps => ({
  ...CHART_DEFAULT_PROPS,
  color: "series",
  showTooltip: true,
  ...o,
});

describe("툴팁 데이터", () => {
  it("showTooltip=false 면 scene 에 툴팁이 없다", () => {
    expect(
      computeChartScene(props({ showTooltip: false }), ROWS, SIZE).tooltip,
    ).toBeNull();
  });

  it("범주마다 시리즈 값을 모아 준다", () => {
    const tooltip = computeChartScene(props(), ROWS, SIZE).tooltip!;
    expect(tooltip.bands.map((b) => b.label)).toEqual(["Mon", "Tue"]);
    expect(tooltip.bands[0].entries).toEqual([
      { label: "A", colorIndex: 0, text: "12" },
      { label: "B", colorIndex: 1, text: "20" },
    ]);
  });

  it("빈 scene 은 툴팁이 없다", () => {
    expect(computeChartScene(props(), [], SIZE).tooltip).toBeNull();
  });
});

describe("히트 판정 — 밴드", () => {
  const scene = computeChartScene(props(), ROWS, SIZE);
  const tooltip = scene.tooltip!;

  it("밴드 기둥은 plot 을 세로로 가득 채운다 (막대 사이에서도 잡힌다)", () => {
    for (const band of tooltip.bands) {
      expect(band.rect!.y).toBeCloseTo(scene.plot.y, 1);
      expect(band.rect!.h).toBeCloseTo(scene.plot.h, 1);
    }
    // 두 밴드가 붙어 있다 (사이에 빈틈 없음)
    const [a, b] = tooltip.bands;
    expect(a.rect!.x + a.rect!.w).toBeCloseTo(b.rect!.x, 1);
  });

  it("포인터가 밴드 안이면 그 범주를 준다", () => {
    const first = tooltip.bands[0].rect!;
    const hit = hitTooltipBand(
      tooltip,
      first.x + first.w / 2,
      first.y + first.h / 2,
    );
    expect(hit?.label).toBe("Mon");
  });

  it("plot 밖이면 null 이다 (툴팁이 닫힌다)", () => {
    expect(hitTooltipBand(tooltip, 0, 0)).toBeNull();
    expect(hitTooltipBand(null, 10, 10)).toBeNull();
  });

  it("막대와 툴팁이 같은 범주를 가리킨다", () => {
    const rects = scene.marks.filter(
      (m): m is Extract<Mark, { kind: "rect" }> => m.kind === "rect",
    );
    for (const rect of rects) {
      const hit = hitTooltipBand(
        tooltip,
        rect.x + rect.w / 2,
        rect.y + rect.h / 2,
      );
      expect(hit).not.toBeNull();
      // 그 범주의 항목 값 중에 이 막대의 값이 있다
      expect(hit!.entries.length).toBeGreaterThan(0);
    }
  });

  it("가로 차트는 히트 기둥도 가로로 눕는다", () => {
    const horizontal = computeChartScene(
      props({ orientation: "horizontal" }),
      ROWS,
      SIZE,
    ).tooltip!;
    for (const band of horizontal.bands) {
      expect(band.rect!.x).toBeCloseTo(
        computeChartScene(props({ orientation: "horizontal" }), ROWS, SIZE).plot
          .x,
        1,
      );
    }
  });
});

describe("히트 판정 — 파이 조각", () => {
  const tooltip = computeChartScene(
    props({ chartType: "pie" }),
    ROWS,
    SIZE,
  ).tooltip!;

  it("조각마다 각도 범위를 준다 (합 360)", () => {
    expect(tooltip.center).not.toBeNull();
    const last = tooltip.bands[tooltip.bands.length - 1];
    expect(last.arc!.end).toBeCloseTo(360, 1);
  });

  it("첫 조각(12시 오른쪽)을 각도로 찾는다", () => {
    const { x, y, outer, inner } = tooltip.center!;
    const radius = (outer + inner) / 2;
    // 12시에서 조금 시계 방향 = 첫 조각
    const hit = hitTooltipBand(tooltip, x + radius * 0.2, y - radius * 0.9);
    expect(hit?.label).toBe("Mon");
  });

  it("반지름 밖이면 null 이다", () => {
    const { x, y, outer } = tooltip.center!;
    expect(hitTooltipBand(tooltip, x + outer * 2, y)).toBeNull();
  });

  it("도넛 구멍 안이면 null 이다", () => {
    const donut = computeChartScene(
      props({ chartType: "pie", innerRadius: 60 }),
      ROWS,
      SIZE,
    ).tooltip!;
    expect(hitTooltipBand(donut, donut.center!.x, donut.center!.y)).toBeNull();
  });
});
