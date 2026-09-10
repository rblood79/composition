/**
 * ADR-194 — rows → 범주 × 시리즈 격자.
 *
 * 입력이 노코드 사용자의 임의 테이블이라 방어가 계약의 일부다: 값이 비수치인
 * 행은 **버리지 않고 0 이 아니라 "없음"** 으로 둔다 (0 으로 접으면 없는 막대가
 * 바닥에 붙어 그려져 데이터에 없는 사실이 화면에 생긴다).
 */
import { toFiniteNumber } from "./scales";
import { resolveChartPresentation, seriesIdentity } from "./presentation";
import type { ResolvedChartPresentation } from "./presentation";
import type { ChartProps, ChartRow } from "./types";

export interface SeriesData {
  /**
   * 원본 키 — group 은 `color` 필드의 문자열화 값, columns 는 필드 키. 표시명이
   * 아니다 (표시명은 `label`). 기존 consumer 의 `key || "series"` 기본 이름 규칙은
   * 그대로다.
   */
  key: string;
  /** identity (`seriesIdentity`) — `seriesConfig.key` 와 대조하는 값. 영속 저장하지 않는다. */
  id: string;
  /** 설정된 표시명. 속성 부재 = 기본 이름 (`key`), 빈 문자열 = 명시적 빈 이름. */
  label?: string;
  /** 팔레트 인덱스 (seriesCount 로 modulo 됨, 또는 검증된 토큰 인덱스) */
  seriesIndex: number;
  /** 범주 인덱스 → 값. 없는 조합은 키 자체가 없다. */
  values: Map<number, number>;
}

export interface SeriesGrid {
  categories: string[];
  series: SeriesData[];
  /** 값이 하나라도 있는가 — false 면 empty scene */
  hasValues: boolean;
  /**
   * ADR-211 others — synthetic "기타" 범주의 index (묶였을 때만). 범주색 자리는
   * `categoryColorIndex` 로 이 범주를 `--chart-others` 토큰으로 보낸다.
   */
  othersIndex?: number;
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

export type SeriesGridProps = Pick<
  ChartProps,
  "dimension" | "metric" | "color"
> &
  Partial<
    Pick<
      ChartProps,
      "dataMode" | "valueFields" | "seriesConfig" | "chartType" | "colorBy"
    >
  >;

/**
 * 행을 (범주 × 시리즈) 격자로 접는다. 같은 (범주, 시리즈) 가 여러 행이면 **합산**
 * (dataTable 이 이미 집계돼 있지 않은 흔한 형태 — 집계 없이 마지막 행만 남기면
 * 사용자가 준 값의 일부가 조용히 사라진다).
 *
 * ADR-210: `dataMode:"columns"` 면 `valueFields` 의 필드마다 시리즈 하나다 — 같은
 * 행에서 필드 수만큼 값을 읽는다 (O(rows × fields), long 배열 복제 없음). 원본 wide
 * 행을 그대로 Recharts 에 주면 중복 범주가 합산되지 않으므로 (P0 spike) columns 도
 * 이 격자를 거친다. `seriesConfig` 는 **격자를 만든 뒤** 순서·이름·색만 바꾼다.
 */
export function buildSeriesGrid(
  rows: readonly ChartRow[],
  props: SeriesGridProps,
  seriesCount: number,
  presentation: ResolvedChartPresentation = resolveChartPresentation(
    props,
    seriesCount,
  ),
): SeriesGrid {
  const categories: string[] = [];
  const categoryIndex = new Map<string, number>();
  const seriesByKey = new Map<string, SeriesData>();
  const orderedSeries: SeriesData[] = [];
  const palette = Math.max(1, seriesCount);
  let hasValues = false;

  const columns = presentation.dataMode === "columns";
  const addSeries = (key: string, id: string): SeriesData => {
    const series: SeriesData = {
      key,
      id,
      seriesIndex: orderedSeries.length % palette,
      values: new Map(),
    };
    seriesByKey.set(key, series);
    orderedSeries.push(series);
    return series;
  };
  // columns — 시리즈는 필드 선택 순서로 **미리** 만든다 (값이 없는 필드도 시리즈다:
  //   행 출현에 따라 순서가 흔들리면 팔레트 색이 데이터에 좌우된다).
  if (columns) {
    for (const field of presentation.valueFields) {
      addSeries(field, seriesIdentity("field", field));
    }
  }

  const accumulate = (series: SeriesData, ci: number, raw: unknown): void => {
    const value = toFiniteNumber(raw);
    if (value === null) return;
    series.values.set(ci, (series.values.get(ci) ?? 0) + value);
    hasValues = true;
  };

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const label = toLabel(readField(row, props.dimension));
    let ci = categoryIndex.get(label);
    if (ci === undefined) {
      ci = categories.length;
      categories.push(label);
      categoryIndex.set(label, ci);
    }

    if (columns) {
      for (const series of orderedSeries) {
        accumulate(series, ci, readField(row, series.key));
      }
      continue;
    }

    const seriesKey = props.color ? toLabel(readField(row, props.color)) : "";
    const series =
      seriesByKey.get(seriesKey) ??
      addSeries(seriesKey, seriesIdentity("group", seriesKey));
    accumulate(series, ci, readField(row, props.metric));
  }

  return {
    categories,
    series: applySeriesConfig(orderedSeries, presentation),
    hasValues,
  };
}

/**
 * `seriesConfig` 적용 — 설정된 시리즈를 배열 순서대로 앞에, 미설정 시리즈를 출현
 * (group) / valueFields (columns) 순서대로 뒤에 둔다. 팔레트 인덱스는 **정렬 전**
 * 출현 순서로 이미 배정돼 있어 config 만 재정렬해도 색은 그대로다 (breakdown §2);
 * 검증된 토큰만 그 인덱스를 덮는다. 보이지 않는 시리즈의 설정은 건드리지 않는다
 * (휴면 보존 — 저장 배열은 여기서 읽기만 한다).
 */
function applySeriesConfig(
  series: SeriesData[],
  presentation: ResolvedChartPresentation,
): SeriesData[] {
  if (presentation.seriesConfig.length === 0) return series;
  const byId = new Map(series.map((s) => [s.id, s]));
  const ordered: SeriesData[] = [];
  const placed = new Set<SeriesData>();
  for (const config of presentation.seriesConfig) {
    const target = byId.get(config.key);
    if (!target || placed.has(target)) continue;
    if (config.label !== undefined) target.label = config.label;
    if (config.paletteIndex !== undefined)
      target.seriesIndex = config.paletteIndex;
    ordered.push(target);
    placed.add(target);
  }
  for (const s of series) if (!placed.has(s)) ordered.push(s);
  return ordered;
}

/** 시리즈 표시명 — 설정 label (빈 문자열 포함) > 원본 키 > 기본 이름. */
export function seriesLabel(series: SeriesData, fallback: string): string {
  return series.label ?? (series.key || fallback);
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
