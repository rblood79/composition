/**
 * shadcn charts 대조 후속 #7 — 레이블 내용 축 (`LabelList dataKey`).
 *
 * shadcn 은 `chart-pie-label-list` (조각 안 범주명) · `chart-radial-label` (링 안
 * 범주명) · `chart-bar-negative` (막대 위 월 이름) 세 곳에서 **값이 아니라 범주명**을
 * 적는다. 켜는 스위치는 기존 `showValueLabels` 를 그대로 두고, `labelKey` 가 무엇을
 * 적을지만 가른다 — 스위치를 하나 더 만들면 "값도 이름도 안 나오는" 조합이 생긴다.
 */
import { describe, expect, it } from "vitest";
import { CHART_DEFAULT_PROPS, computeChartScene } from "../computeChartScene";
import type { ChartProps, ChartRow, TextMark } from "../types";

const ROWS: ChartRow[] = [
  { category: "Mon", value: 12 },
  { category: "Tue", value: 30 },
  { category: "Wed", value: 18 },
];
const SIZE = { width: 360, height: 280 };

function valueLabels(patch: Partial<ChartProps>): TextMark[] {
  const scene = computeChartScene(
    { ...CHART_DEFAULT_PROPS, showValueLabels: true, ...patch },
    ROWS,
    SIZE,
  );
  return scene.marks.filter(
    (m): m is TextMark => m.kind === "text" && m.role === "value",
  );
}

const TYPES: Array<[string, Partial<ChartProps>]> = [
  ["bar", { chartType: "bar" }],
  ["line", { chartType: "line" }],
  ["area", { chartType: "area" }],
  ["pie", { chartType: "pie" }],
  ["radar", { chartType: "radar" }],
  ["radial", { chartType: "radial" }],
];

describe("labelKey — 값 대신 범주명", () => {
  it.each(TYPES)("%s: 기본은 값을 적는다", (_name, patch) => {
    const texts = valueLabels(patch).map((m) => m.text);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts).toEqual(expect.arrayContaining(["30"]));
  });

  it.each(TYPES)("%s: labelKey=category 면 범주명을 적는다", (_name, patch) => {
    const texts = valueLabels({ ...patch, labelKey: "category" }).map(
      (m) => m.text,
    );
    expect(texts).toEqual(expect.arrayContaining(["Mon", "Tue", "Wed"]));
    expect(texts).not.toContain("30");
  });

  it.each(TYPES)("%s: 레이블 **자리**는 그대로다 (내용만 바뀐다)", (_name, patch) => {
    const value = valueLabels(patch);
    const category = valueLabels({ ...patch, labelKey: "category" });
    expect(category.map((m) => [m.anchor, m.baseline])).toEqual(
      value.map((m) => [m.anchor, m.baseline]),
    );
  });

  it("showValueLabels=false 면 labelKey 와 무관하게 아무것도 안 적는다", () => {
    expect(
      valueLabels({ showValueLabels: false, labelKey: "category" }),
    ).toHaveLength(0);
  });

  it("마크 좌표(d/x/y)는 labelKey 로 바뀌지 않는다", () => {
    const of = (labelKey: ChartProps["labelKey"]) =>
      computeChartScene(
        { ...CHART_DEFAULT_PROPS, chartType: "pie", showValueLabels: true, labelKey },
        ROWS,
        SIZE,
      ).marks.filter((m) => m.kind === "path");
    expect(of("category")).toEqual(of("value"));
  });
});
