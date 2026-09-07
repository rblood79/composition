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
 * 누적 방식.
 * - `none` — 시리즈끼리 겹치거나 나란히 (dodged / 겹친 area)
 * - `stacked` — 원래 값을 그대로 쌓는다
 * - `expand` — 범주별 합을 100 으로 정규화해 쌓는다 (shadcn `stacked-expand` 대응)
 *
 * `expand` 의 단위는 **퍼센트(0~100)** 다. 0~1 로 두면 눈금이 "0.2" 로 나와
 * 사람이 읽는 축이 아니게 된다 — 정규화 단위를 여기서 한 번 정하면 축·마크·
 * 값 레이블이 전부 같은 단위를 쓴다.
 */
export type StackMode = "none" | "stacked" | "expand";

/** 한 범주 안에서 한 시리즈가 차지하는 누적 구간. */
export interface StackRange {
  from: number;
  to: number;
}

/** expand 정규화 배수 — 범주 합(절대값)을 100 으로 만든다. 합이 0 이면 0. */
function expandScale(grid: SeriesGrid, categoryIndex: number): number {
  let total = 0;
  for (const series of grid.series) {
    const v = series.values.get(categoryIndex);
    if (v !== undefined) total += Math.abs(v);
  }
  return total === 0 ? 0 : 100 / total;
}

/**
 * 값 축 범위. 누적은 범주별 누적 구간의 최소/최대가 축을 정한다 —
 * dodged 의 개별 최대값을 쓰면 쌓인 막대가 plot 밖으로 나간다.
 */
export function valueExtent(grid: SeriesGrid, mode: StackMode): ValueExtent {
  let min = 0;
  let max = 0;
  if (mode !== "none") {
    for (let ci = 0; ci < grid.categories.length; ci++) {
      for (const band of stackBands(grid, ci, mode)) {
        if (band.to > max) max = band.to;
        if (band.from < min) min = band.from;
      }
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

/** 누적 — 한 범주 안의 시리즈 순서대로 [시작, 끝] 구간을 만든다. */
export function stackBands(
  grid: SeriesGrid,
  categoryIndex: number,
  mode: StackMode = "stacked",
): Array<{ series: SeriesData } & StackRange> {
  const bands: Array<{ series: SeriesData } & StackRange> = [];
  const scale = mode === "expand" ? expandScale(grid, categoryIndex) : 1;
  let positive = 0;
  let negative = 0;
  for (const series of grid.series) {
    const raw = series.values.get(categoryIndex);
    if (raw === undefined) continue;
    const v = raw * scale;
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

/**
 * 시리즈 위치 → (범주 인덱스 → 누적 구간).
 *
 * area 누적이 쓴다: bar 는 범주 하나를 한 번에 그리면 되지만 area 는 **한 시리즈의
 * 띠를 범주 축을 따라 이어야** 해서 시리즈 기준으로 뒤집은 색인이 필요하다.
 */
export function stackRangesBySeries(
  grid: SeriesGrid,
  mode: StackMode,
): Array<Map<number, StackRange>> {
  const bySeries = grid.series.map(() => new Map<number, StackRange>());
  const indexOf = new Map<SeriesData, number>();
  grid.series.forEach((series, i) => indexOf.set(series, i));
  for (let ci = 0; ci < grid.categories.length; ci++) {
    for (const band of stackBands(grid, ci, mode)) {
      const si = indexOf.get(band.series);
      if (si === undefined) continue;
      bySeries[si].set(ci, { from: band.from, to: band.to });
    }
  }
  return bySeries;
}
