/**
 * ADR-194 — rows → 범주 × 시리즈 격자.
 *
 * 입력이 노코드 사용자의 임의 테이블이라 방어가 계약의 일부다: 값이 비수치인
 * 행은 **버리지 않고 0 이 아니라 "없음"** 으로 둔다 (0 으로 접으면 없는 막대가
 * 바닥에 붙어 그려져 데이터에 없는 사실이 화면에 생긴다).
 */
import { toFiniteNumber } from "./scales";
import type { ChartProps, ChartRow } from "./types";

export interface SeriesData {
  key: string;
  /** 팔레트 인덱스 (seriesCount 로 modulo 됨) */
  seriesIndex: number;
  /** 범주 인덱스 → 값. 없는 조합은 키 자체가 없다. */
  values: Map<number, number>;
}

export interface SeriesGrid {
  categories: string[];
  series: SeriesData[];
  /** 값이 하나라도 있는가 — false 면 empty scene */
  hasValues: boolean;
}

function readField(row: ChartRow, key: string): unknown {
  if (!key) return undefined;
  return (row as Record<string, unknown>)[key];
}

function toLabel(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

/**
 * 행을 (범주 × 시리즈) 격자로 접는다. 같은 (범주, 시리즈) 가 여러 행이면 **합산**
 * (dataTable 이 이미 집계돼 있지 않은 흔한 형태 — 집계 없이 마지막 행만 남기면
 * 사용자가 준 값의 일부가 조용히 사라진다).
 */
export function buildSeriesGrid(
  rows: readonly ChartRow[],
  props: Pick<ChartProps, "dimension" | "metric" | "color">,
  seriesCount: number,
): SeriesGrid {
  const categories: string[] = [];
  const categoryIndex = new Map<string, number>();
  const seriesByKey = new Map<string, SeriesData>();
  const orderedSeries: SeriesData[] = [];
  const palette = Math.max(1, seriesCount);
  let hasValues = false;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const label = toLabel(readField(row, props.dimension));
    let ci = categoryIndex.get(label);
    if (ci === undefined) {
      ci = categories.length;
      categories.push(label);
      categoryIndex.set(label, ci);
    }

    const seriesKey = props.color ? toLabel(readField(row, props.color)) : "";
    let series = seriesByKey.get(seriesKey);
    if (!series) {
      series = {
        key: seriesKey,
        seriesIndex: orderedSeries.length % palette,
        values: new Map(),
      };
      seriesByKey.set(seriesKey, series);
      orderedSeries.push(series);
    }

    const value = toFiniteNumber(readField(row, props.metric));
    if (value === null) continue;
    series.values.set(ci, (series.values.get(ci) ?? 0) + value);
    hasValues = true;
  }

  return { categories, series: orderedSeries, hasValues };
}

export interface ValueExtent {
  min: number;
  max: number;
}

/**
 * 값 축 범위. stacked 는 범주별 누적합(양수/음수 각각) 이 축을 정한다 —
 * dodged 의 개별 최대값을 쓰면 쌓인 막대가 plot 밖으로 나간다.
 */
export function valueExtent(
  grid: SeriesGrid,
  stacked: boolean,
): ValueExtent {
  let min = 0;
  let max = 0;
  if (stacked) {
    for (let ci = 0; ci < grid.categories.length; ci++) {
      let positive = 0;
      let negative = 0;
      for (const series of grid.series) {
        const v = series.values.get(ci);
        if (v === undefined) continue;
        if (v >= 0) positive += v;
        else negative += v;
      }
      if (positive > max) max = positive;
      if (negative < min) min = negative;
    }
    return { min, max };
  }
  for (const series of grid.series) {
    for (const v of series.values.values()) {
      if (v > max) max = v;
      if (v < min) min = v;
    }
  }
  return { min, max };
}

/** stacked 누적 — 한 범주 안의 시리즈 순서대로 [시작, 끝] 구간을 만든다. */
export function stackBands(
  grid: SeriesGrid,
  categoryIndex: number,
): Array<{ series: SeriesData; from: number; to: number }> {
  const bands: Array<{ series: SeriesData; from: number; to: number }> = [];
  let positive = 0;
  let negative = 0;
  for (const series of grid.series) {
    const v = series.values.get(categoryIndex);
    if (v === undefined) continue;
    if (v >= 0) {
      bands.push({ series, from: positive, to: positive + v });
      positive += v;
    } else {
      bands.push({ series, from: negative + v, to: negative });
      negative += v;
    }
  }
  return bands;
}
