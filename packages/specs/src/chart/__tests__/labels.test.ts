/**
 * ADR-194 후속 (shadcn 대조) — 값 레이블 · 범주별 색 · 범례 축.
 *
 * 세 가지는 같은 질문의 세 면이다: **무엇이 색과 이름을 가르는가.** 시리즈로
 * 고정해 두면 파이 범례가 화면에 없는 시리즈를 나열하고, bar mixed 는 색을
 * 못 바꾼다.
 */
import { describe, it, expect } from "vitest";
import { computeChartScene, CHART_DEFAULT_PROPS } from "../computeChartScene";
import type { ChartProps, ChartRow, Mark, TextMark } from "../types";

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
  ...o,
});

const texts = (o: Partial<ChartProps>): TextMark[] =>
  computeChartScene(props(o), ROWS, SIZE).marks.filter(
    (m): m is Extract<Mark, { kind: "text" }> => m.kind === "text",
  );

const values = (o: Partial<ChartProps>): TextMark[] =>
  texts(o).filter((t) => t.role === "value");

describe("값 레이블", () => {
  it("끄면 값 텍스트가 없다", () => {
    expect(values({ showValueLabels: false })).toHaveLength(0);
  });

  it("bar dodged 는 막대마다 원래 값을 붙인다", () => {
    const labels = values({ showValueLabels: true });
    expect(labels.map((t) => t.text).sort()).toEqual(["12", "20", "30", "8"]);
    for (const label of labels) expect(label.baseline).toBe("bottom");
  });

  it("expand 로 정규화해도 레이블은 원래 값이다", () => {
    const labels = values({ showValueLabels: true, stackType: "expand" });
    expect(labels.map((t) => t.text).sort()).toEqual(["12", "20", "30", "8"]);
  });

  it("누적 막대 레이블은 칸 안쪽 중앙에 온다", () => {
    const scene = computeChartScene(
      props({ showValueLabels: true, stackType: "stacked" }),
      ROWS,
      SIZE,
    );
    const rects = scene.marks.filter(
      (m): m is Extract<Mark, { kind: "rect" }> => m.kind === "rect",
    );
    const labels = scene.marks.filter(
      (m): m is TextMark => m.kind === "text" && m.role === "value",
    );
    for (const label of labels) {
      expect(label.baseline).toBe("middle");
      const inside = rects.some(
        (r) =>
          label.x >= r.x &&
          label.x <= r.x + r.w &&
          label.y >= r.y &&
          label.y <= r.y + r.h,
      );
      expect(inside).toBe(true);
    }
  });

  it("칸이 글자보다 작으면 레이블을 만들지 않는다", () => {
    const tiny: ChartRow[] = [
      { category: "Mon", value: 1000, series: "A" },
      { category: "Mon", value: 1, series: "B" },
    ];
    const labels = computeChartScene(
      props({ showValueLabels: true, stackType: "stacked" }),
      tiny,
      SIZE,
    ).marks.filter((m): m is TextMark => m.kind === "text" && m.role === "value");
    expect(labels.map((t) => t.text)).toEqual(["1,000"]);
  });

  it("가로 막대는 막대 끝 오른쪽에 붙는다", () => {
    const labels = values({ showValueLabels: true, orientation: "horizontal" });
    for (const label of labels) {
      expect(label.anchor).toBe("start");
      expect(label.baseline).toBe("middle");
    }
  });

  it("line 은 점 위에, pie 는 조각 안에 붙는다", () => {
    for (const label of values({ chartType: "line", showValueLabels: true })) {
      expect(label.anchor).toBe("middle");
      expect(label.baseline).toBe("bottom");
    }
    const pie = values({ chartType: "pie", showValueLabels: true });
    expect(pie).toHaveLength(2); // 첫 시리즈의 범주 2개
    for (const label of pie) expect(label.baseline).toBe("middle");
  });
});

describe("colorBy — 범주별 색 (shadcn mixed)", () => {
  it("bar 는 범주 인덱스로 색을 가른다", () => {
    const rects = (colorBy: ChartProps["colorBy"]) =>
      computeChartScene(props({ colorBy }), ROWS, SIZE).marks.filter(
        (m): m is Extract<Mark, { kind: "rect" }> => m.kind === "rect",
      );
    const bySeries = rects("series").map((r) => r.seriesIndex);
    const byCategory = rects("category").map((r) => r.seriesIndex);
    expect(bySeries).not.toEqual(byCategory);
    // 같은 범주의 막대는 같은 색, 다른 범주는 다른 색
    expect(byCategory[0]).toBe(byCategory[1]);
    expect(byCategory[0]).not.toBe(byCategory[2]);
  });

  it("line 은 colorBy 를 무시한다 (선은 시리즈가 가른다)", () => {
    const paths = (colorBy: ChartProps["colorBy"]) =>
      computeChartScene(props({ chartType: "line", colorBy }), ROWS, SIZE)
        .marks.filter((m): m is Extract<Mark, { kind: "path" }> =>
          m.kind === "path",
        )
        .map((m) => m.strokeSeries);
    expect(paths("category")).toEqual(paths("series"));
  });
});

describe("범례 항목은 색을 가르는 축을 따라간다", () => {
  const labelsOf = (o: Partial<ChartProps>) =>
    computeChartScene(
      props({ showLegend: true, ...o }),
      ROWS,
      SIZE,
    ).legend?.items.map((i) => i.label);

  it("기본은 시리즈", () => {
    expect(labelsOf({})).toEqual(["A", "B"]);
  });

  it("pie 는 범주 (조각과 같은 이름·같은 색)", () => {
    const scene = computeChartScene(
      props({ chartType: "pie", showLegend: true }),
      ROWS,
      SIZE,
    );
    expect(scene.legend?.items.map((i) => i.label)).toEqual(["Mon", "Tue"]);
    const sliceColors = scene.marks
      .filter((m): m is Extract<Mark, { kind: "path" }> => m.kind === "path")
      .map((m) => m.fillSeries);
    expect(scene.legend?.items.map((i) => i.seriesIndex)).toEqual(sliceColors);
  });

  it("bar mixed 는 범주", () => {
    expect(labelsOf({ colorBy: "category" })).toEqual(["Mon", "Tue"]);
  });

  it("line 은 colorBy 와 무관하게 시리즈", () => {
    expect(labelsOf({ chartType: "line", colorBy: "category" })).toEqual([
      "A",
      "B",
    ]);
  });
});
