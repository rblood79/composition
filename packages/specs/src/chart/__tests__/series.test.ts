/**
 * ADR-194 후속 (shadcn 대조) — 누적 축.
 *
 * `stacked` 는 원래 값을 쌓고 `expand` 는 범주 합을 100 으로 정규화한다. 정규화가
 * 스케일 축에 있으면 축·마크·레이블이 서로 다른 단위를 보게 되므로 **누적 계산
 * 한 곳**(series.ts)에서만 한다 — 이 파일이 그 계약을 고정한다.
 */
import { describe, it, expect } from "vitest";
import {
  buildSeriesGrid,
  stackBands,
  stackRangesBySeries,
  valueExtent,
} from "../series";
import type { ChartRow } from "../types";

const ROWS: ChartRow[] = [
  { category: "Mon", value: 10, series: "A" },
  { category: "Tue", value: 30, series: "A" },
  { category: "Mon", value: 30, series: "B" },
  { category: "Tue", value: 10, series: "B" },
];

const grid = buildSeriesGrid(
  ROWS,
  { dimension: "category", metric: "value", color: "series" },
  8,
);

describe("stackBands", () => {
  it("stacked 는 시리즈 순서대로 값을 쌓는다", () => {
    expect(stackBands(grid, 0, "stacked").map((b) => [b.from, b.to])).toEqual([
      [0, 10],
      [10, 40],
    ]);
  });

  it("expand 는 범주 합을 100 으로 정규화한다 (범주마다 끝이 100)", () => {
    for (let ci = 0; ci < grid.categories.length; ci++) {
      const bands = stackBands(grid, ci, "expand");
      expect(bands[bands.length - 1].to).toBeCloseTo(100, 6);
    }
    expect(stackBands(grid, 0, "expand").map((b) => [b.from, b.to])).toEqual([
      [0, 25],
      [25, 100],
    ]);
  });

  it("음수는 0 아래로 따로 쌓는다 (양수 더미와 섞지 않는다)", () => {
    const mixed = buildSeriesGrid(
      [
        { category: "Mon", value: 10, series: "A" },
        { category: "Mon", value: -4, series: "B" },
      ],
      { dimension: "category", metric: "value", color: "series" },
      8,
    );
    expect(stackBands(mixed, 0, "stacked").map((b) => [b.from, b.to])).toEqual([
      [0, 10],
      [-4, 0],
    ]);
  });

  it("합이 0 인 범주는 expand 에서 0 구간이 된다 (0 나눗셈 없음)", () => {
    const zero = buildSeriesGrid(
      [{ category: "Mon", value: 0, series: "A" }],
      { dimension: "category", metric: "value", color: "series" },
      8,
    );
    const bands = stackBands(zero, 0, "expand");
    expect(bands.every((b) => Number.isFinite(b.from) && Number.isFinite(b.to)))
      .toBe(true);
  });
});

describe("stackRangesBySeries", () => {
  it("시리즈 위치 기준으로 뒤집어도 같은 구간을 준다", () => {
    const ranges = stackRangesBySeries(grid, "stacked");
    expect(ranges[0].get(0)).toEqual({ from: 0, to: 10 });
    expect(ranges[1].get(0)).toEqual({ from: 10, to: 40 });
    expect(ranges[1].get(1)).toEqual({ from: 30, to: 40 });
  });

  it("값이 없는 (범주, 시리즈) 는 키 자체가 없다 — area 가 여기서 끊는다", () => {
    const sparse = buildSeriesGrid(
      [
        { category: "Mon", value: 10, series: "A" },
        { category: "Tue", value: 5, series: "B" },
      ],
      { dimension: "category", metric: "value", color: "series" },
      8,
    );
    const ranges = stackRangesBySeries(sparse, "stacked");
    expect(ranges[0].has(1)).toBe(false);
    expect(ranges[1].has(0)).toBe(false);
  });
});

describe("valueExtent", () => {
  it("stacked 는 누적합까지, none 은 개별 최대까지", () => {
    expect(valueExtent(grid, "stacked")).toEqual({ min: 0, max: 40 });
    expect(valueExtent(grid, "none")).toEqual({ min: 0, max: 30 });
  });

  it("expand 는 항상 0~100 이다 (범주 합과 무관)", () => {
    expect(valueExtent(grid, "expand")).toEqual({ min: 0, max: 100 });
  });
});
