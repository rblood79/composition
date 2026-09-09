import { describe, expect, it } from "vitest";
import {
  CHART_DESCRIPTORS,
  createChartInitialProps,
  getChartDescriptor,
  getChartPresetId,
  resolveChartAnimation,
} from "../authoring";
import { CHART_DEFAULT_PROPS } from "../computeChartScene";
import { resolveChartData } from "../runtimeData";

describe("ADR-209 공통 저작/데이터 계약", () => {
  it("Chart 직접 생성의 기존 기본값과 palette 신규 기본값을 구분한다", () => {
    const legacy = createChartInitialProps();
    expect(legacy).toMatchObject({
      chartType: "bar",
      curve: "linear",
      showGrid: false,
      showLegend: true,
      showTooltip: false,
    });
    expect(resolveChartAnimation(legacy).isAnimationActive).toBe(false);
    expect(createChartInitialProps("area")).toMatchObject({
      chartType: "area",
      curve: "monotone",
      showGrid: true,
      showTooltip: true,
      animationDuration: 600,
      isAnimationActive: true,
    });
    expect(createChartInitialProps("pie").data).toHaveLength(4);
    expect(createChartInitialProps("radar").data).toHaveLength(8);
    expect(new Set(CHART_DESCRIPTORS.map((d) => d.paletteId)).size).toBe(6);
  });
  it("프리셋은 이전 소유 키를 reset하되 데이터와 실행 옵션을 소유하지 않는다", () => {
    const line = getChartDescriptor("line");
    const dots = line.presets.find((p) => p.id === "dots")!.patch;
    const base = line.presets.find((p) => p.id === "default")!.patch;
    expect(dots.showDots).toBe(true);
    expect(base.showDots).toBe(false);
    expect(getChartPresetId("line", dots)).toBe("dots");
    expect(getChartPresetId("line", { ...dots, curve: "step" })).toBe("custom");
    for (const d of CHART_DESCRIPTORS)
      for (const p of d.presets) {
        expect(Object.keys(p.patch)).not.toEqual(
          expect.arrayContaining([
            "data",
            "dimension",
            "metric",
            "isAnimationActive",
          ]),
        );
        expect(
          "data" in p.patch ||
            "dimension" in p.patch ||
            "metric" in p.patch ||
            "isAnimationActive" in p.patch,
        ).toBe(false);
      }
  });
  it("원본과 충돌하는 이름도 내부 key와 분리하고, 중복·0·결측을 보존한다", () => {
    const rows = [
      { x: "A", y: "2", s: "category" },
      { x: "A", y: 3, s: "category" },
      { x: "B", y: 0, s: "category" },
      { x: "C", y: null, s: "category" },
      { x: "A", y: -4, s: "series0" },
      { x: "B", y: "bad", s: "series0" },
    ];
    const before = JSON.stringify(rows);
    const model = resolveChartData(
      rows,
      { ...CHART_DEFAULT_PROPS, dimension: "x", metric: "y", color: "s" },
      8,
    );
    expect(model.keys).toEqual(["series0", "series1"]);
    expect(model.grid.series.map((s) => s.key)).toEqual([
      "category",
      "series0",
    ]);
    expect(model.rows).toEqual([
      { category: "A", categoryIndex: 0, series0: 5, series1: -4 },
      { category: "B", categoryIndex: 1, series0: 0, series1: null },
      { category: "C", categoryIndex: 2, series0: null, series1: null },
    ]);
    expect(JSON.stringify(rows)).toBe(before);
  });
  it("expand는 절댓값 합으로 한번만 0~100 단위로 정규화한다", () => {
    const model = resolveChartData(
      [
        { category: "A", value: 3, s: "one" },
        { category: "A", value: -1, s: "two" },
      ],
      { ...CHART_DEFAULT_PROPS, color: "s", stackType: "expand" },
      8,
    );
    expect(model.bands[0].get(0)).toEqual({ from: 0, to: 75 });
    expect(model.bands[1].get(0)).toEqual({ from: -25, to: 0 });
    expect(model.rows[0]).toMatchObject({ series0: 3, series1: -1 });
  });
  it("animation의 비유한/음수 timing을 직렬화 가능한 실행 기본값으로 해소한다", () => {
    expect(
      resolveChartAnimation({
        isAnimationActive: true,
        animationBegin: -1,
        animationDuration: Infinity,
      }),
    ).toEqual({
      isAnimationActive: true,
      animationBegin: 0,
      animationDuration: 600,
      animationEasing: "ease-out",
    });
  });
});
