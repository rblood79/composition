/**
 * ADR-194 — rows → 범주 × 시리즈 격자.
 *
 * 입력이 노코드 사용자의 임의 테이블이라 방어가 계약의 일부다: 값이 비수치인
 * 행은 **버리지 않고 0 이 아니라 "없음"** 으로 둔다 (0 으로 접으면 없는 막대가
 * 바닥에 붙어 그려져 데이터에 없는 사실이 화면에 생긴다).
 */
import { toFiniteNumber } from "./scales";
import { resolveFieldRef } from "../data/fieldIdIndex";
import { resolveChartPresentation, seriesIdentity } from "./presentation";
import type {
  ResolvedChartPresentation,
  ResolvedSeriesConfig,
} from "./presentation";
import { parseIsoStrict } from "./budget";
import { parseTime, resolveTimeLocale } from "./timeFormat";
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
  /**
   * ADR-306 Phase 5 — 범주 인덱스 → 보조 값 (breakdown §2.1). line · area 범위 띠의 아래 · 위 경계
   * (`lowerFields` · `upperFields`), scatter 점 크기 (`sizeField`) · 이름 (`labelField`). 창 · 솎기 ·
   * 정렬이 `values` 와 같이 옮긴다 (`remapExtras`) — 집계 bucket 은 버린다 (띠 · 크기의 집계 뜻이 없다).
   */
  extras?: SeriesExtras;
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
  /**
   * ADR-216 시간 스케일 — 범주 index → epoch ms (UTC), 라벨과 **분리** 보존 (HC8). 범주는
   * epoch 오름차순이다. 창 · 극값은 이 값을 그대로 옮기고, 집계는 bucket 의 첫 epoch (`t0`).
   */
  positions?: readonly number[];
  /** 집계 bucket 의 `[t0, t1]` (bucket 안 첫·끝 범주의 epoch) — 집계에서만. */
  positionRanges?: ReadonlyArray<readonly [number, number]>;
  /** 시간 파싱에 실패해 제외한 행 수 (input 격자에만) — 진단 `dimension.parse.failed` 의 값. */
  parseFailures?: number;
  /**
   * ADR-306 Phase 6 — 강조 밖 범주 (`highlight` 범주 단위 — pie · 시리즈 1 bar · radial). 범주색 · 시리즈색
   * 자리가 neutral (`CHART_OTHERS_COLOR_INDEX`) 로 칠한다 (`categoryColorIndex`).
   */
  dimmed?: ReadonlySet<number>;
}

function readField(row: ChartRow, key: string | undefined): unknown {
  if (!key) return undefined;
  // ADR-152 Phase 1b: `#<fieldId>` 참조는 색인으로 행 key 를 얻는다 (rename-safe). key
  //   참조 (v1) 는 그대로. 미등록 id 는 undefined (빈 범주 / 값 0 과 같은 규약).
  const resolved = resolveFieldRef(key);
  if (resolved === null) return undefined;
  return (row as Record<string, unknown>)[resolved];
}

function toLabel(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export interface SeriesExtras {
  lower?: Map<number, number>;
  upper?: Map<number, number>;
  size?: Map<number, number>;
  label?: Map<number, string>;
}

/** 보조 값을 새 범주 인덱스로 옮긴다 (`map` 이 undefined 면 버린다). */
export function remapExtras(
  extras: SeriesExtras | undefined,
  map: (ci: number) => number | undefined,
): SeriesExtras | undefined {
  if (!extras) return undefined;
  const out: SeriesExtras = {};
  for (const key of ["lower", "upper", "size", "label"] as const) {
    const src = extras[key] as Map<number, number | string> | undefined;
    if (!src) continue;
    const dst = new Map<number, number | string>();
    for (const [ci, v] of src) {
      const next = map(ci);
      if (next !== undefined) dst.set(next, v);
    }
    (out as Record<string, unknown>)[key] = dst;
  }
  return out;
}

export type SeriesGridProps = Pick<
  ChartProps,
  "dimension" | "metric" | "color"
> &
  Partial<
    Pick<
      ChartProps,
      | "dataMode"
      | "valueFields"
      | "seriesConfig"
      | "chartType"
      | "colorBy"
      | "dimensionScale"
      | "dimensionFormat"
      | "dimensionLabelFormat"
      | "valueLocale"
      | "lowerFields"
      | "upperFields"
      | "sizeField"
      | "labelField"
    >
  >;

/** ADR-306 Phase 6 — 시리즈마다 유한 값의 합 (강조의 max · min 비교 값). */
export function seriesTotals(grid: Pick<SeriesGrid, "series">): number[] {
  return grid.series.map((s) => {
    let t = 0;
    for (const v of s.values.values()) if (Number.isFinite(v)) t += v;
    return t;
  });
}

/**
 * ADR-216 — 시간 스케일의 범주 파서. `dimensionFormat` 이 있으면 지시자 (`parseTime`), 없으면
 * 엄격 ISO (`parseIsoStrict`). 둘 다 UTC · 달력 넘침 거부 (HC7). 실패는 null → 행 제외.
 */
export function resolveDimensionParser(
  presentation: Pick<ResolvedChartPresentation, "dimension" | "numberFormat">,
): ((label: string) => number | null) | null {
  // ADR-217 — 산점도 linear x: 숫자 문자열 (`toFiniteNumber`). 실패 행은 time 과 같은 정책.
  if (presentation.dimension.scale === "linear")
    return (label) => toFiniteNumber(label);
  if (presentation.dimension.scale !== "time") return null;
  return timeLabelParser({
    dimensionFormat: presentation.dimension.format,
    valueLocale: presentation.numberFormat.locale,
  });
}

/**
 * 시간 축 범주 이름 → epoch — 격자와 같은 파서 (`dimensionFormat` 지시자 + 값 locale, 없으면 엄격 ISO).
 * 주석 x · 예측 시작 · 띠 시작처럼 격자 밖에서 날짜를 읽는 곳도 이것을 쓴다.
 */
export function timeLabelParser(
  props: Pick<ChartProps, "dimensionFormat" | "valueLocale">,
): (label: string) => number | null {
  const format = props.dimensionFormat;
  if (!format) return parseIsoStrict;
  const locale = resolveTimeLocale(props.valueLocale);
  return (label) => parseTime(format, label, locale);
}

/**
 * ADR-312 Decision 9 — 날짜 범주 **값** → epoch ms (UTC). 시간 축 · calendar · candlestick 이 같이 읽는 해석 하나
 * (F12 — calendar · candlestick 의 자체 해석을 없앴다). 글자는 `timeLabelParser` (`dimensionFormat` 지시자 + 값
 * locale, 없으면 엄격 ISO), 숫자는 epoch ms 로 볼 만큼 클 때만 (|v| > 1e10 — 네 자리 연도 · 순번은 날짜가 아니다).
 */
export function chartTimeParser(
  props: Pick<ChartProps, "dimensionFormat" | "valueLocale">,
): (value: unknown) => number | null {
  const parse = timeLabelParser(props);
  return (value) =>
    typeof value === "number"
      ? Number.isFinite(value) && Math.abs(value) > 1e10
        ? value
        : null
      : typeof value === "string"
        ? parse(value.trim())
        : null;
}

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
  // ADR-216 — 시간 스케일: 범주 key 는 epoch (같은 시각의 다른 표기는 한 범주 — 합산), 라벨은
  //   첫 출현 문자열. 파싱 실패 행은 범주 push **전에** 걸러 categories 에 들어가지 않는다 (x 결측 —
  //   y 결측 gap sentinel 과 다른 정책, breakdown §2.1).
  const parseDimension = resolveDimensionParser(presentation);
  const positions: number[] = [];
  const epochIndex = new Map<number, number>();
  let parseFailures = 0;
  // ADR-217 — 산점도는 **행 = 점**: 같은 x 를 합치지 않는다 (같은 x 두 행 = 점 두 개, HC9).
  const pointPerRow = props.chartType === "scatter";

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
  //   ADR-312 — 이름 (`key`) 은 풀린 필드 key, identity 는 저장된 참조 그대로 (`#id` — 필드 이름을 바꿔도 시리즈
  //   표의 항목이 남는다). 연결 때 값 열이 `#id` 로 저장되면 범례에 id 글자가 그려졌다 (Phase 5 live).
  const columnIndex = new Map<SeriesData, number>();
  if (columns) {
    presentation.valueFields.forEach((field, i) => {
      columnIndex.set(
        addSeries(
          resolveFieldRef(field) ?? field,
          seriesIdentity("field", field),
        ),
        i,
      );
    });
  }

  const accumulate = (series: SeriesData, ci: number, raw: unknown): void => {
    const value = toFiniteNumber(raw);
    if (value === null) return;
    series.values.set(ci, (series.values.get(ci) ?? 0) + value);
    hasValues = true;
  };
  // ADR-306 Phase 5 — 보조 값 (breakdown §2.1). 띠 경계는 line · area 만 (columns 는 값 필드와 같은
  //   순서, group 은 첫 필드 하나를 모든 시리즈에), 크기 · 이름은 scatter 만 (행 = 점 — 합산 없음).
  const lineLike = props.chartType === "line" || props.chartType === "area";
  const lowerRefs = lineLike ? (props.lowerFields ?? []) : [];
  const upperRefs = lineLike ? (props.upperFields ?? []) : [];
  const banded = lowerRefs.length > 0 && upperRefs.length > 0;
  const sizeRef = pointPerRow ? props.sizeField : undefined;
  const labelRef = pointPerRow ? props.labelField : undefined;
  const fieldOf = (refs: readonly string[], series: SeriesData) =>
    columns ? refs[columnIndex.get(series) ?? -1] : refs[0];
  const addExtra = (
    series: SeriesData,
    key: "lower" | "upper" | "size",
    ci: number,
    raw: unknown,
  ): void => {
    const value = toFiniteNumber(raw);
    if (value === null) return;
    const extras = (series.extras ??= {});
    const map = (extras[key] ??= new Map());
    map.set(ci, (map.get(ci) ?? 0) + value);
  };
  const extrasOf = (series: SeriesData, ci: number, row: ChartRow): void => {
    if (banded) {
      const lo = fieldOf(lowerRefs, series);
      const hi = fieldOf(upperRefs, series);
      if (lo && hi) {
        addExtra(series, "lower", ci, readField(row, lo));
        addExtra(series, "upper", ci, readField(row, hi));
      }
    }
    if (sizeRef) addExtra(series, "size", ci, readField(row, sizeRef));
    if (labelRef) {
      const text = toLabel(readField(row, labelRef));
      if (text) ((series.extras ??= {}).label ??= new Map()).set(ci, text);
    }
  };
  const withExtras = banded || !!sizeRef || !!labelRef;

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const label = toLabel(readField(row, props.dimension));
    let ci: number | undefined;
    if (parseDimension) {
      const t = parseDimension(label);
      if (t === null) {
        parseFailures++;
        continue;
      }
      ci = pointPerRow ? undefined : epochIndex.get(t);
      if (ci === undefined) {
        ci = categories.length;
        categories.push(label);
        positions.push(t);
        if (!pointPerRow) epochIndex.set(t, ci);
      }
    } else {
      ci = categoryIndex.get(label);
      if (ci === undefined) {
        ci = categories.length;
        categories.push(label);
        categoryIndex.set(label, ci);
      }
    }

    if (columns) {
      for (const series of orderedSeries) {
        accumulate(series, ci, readField(row, series.key));
        if (withExtras) extrasOf(series, ci, row);
      }
      continue;
    }

    const seriesKey = props.color ? toLabel(readField(row, props.color)) : "";
    const series =
      seriesByKey.get(seriesKey) ??
      addSeries(seriesKey, seriesIdentity("group", seriesKey));
    accumulate(series, ci, readField(row, props.metric));
    if (withExtras) extrasOf(series, ci, row);
  }

  if (!parseDimension) {
    return {
      categories,
      series: applySeriesConfig(orderedSeries, presentation.seriesConfig),
      hasValues,
    };
  }
  const sorted = sortByPosition(categories, positions, orderedSeries);
  return {
    categories: sorted.categories,
    positions: sorted.positions,
    series: applySeriesConfig(sorted.series, presentation.seriesConfig),
    hasValues,
    parseFailures,
  };
}

/**
 * ADR-216 — 시간 스케일은 **epoch 오름차순** 이 범주 순서다 (첫 출현 순이 아니다): 창 index ·
 * 집계 bucket 이 "인접 index = 인접 시각" 을 전제한다. 시리즈 값 Map 의 index 도 같이 옮긴다.
 */
function sortByPosition(
  categories: readonly string[],
  positions: readonly number[],
  series: readonly SeriesData[],
): Pick<SeriesGrid, "categories" | "positions" | "series"> {
  const order = positions
    .map((_, i) => i)
    .sort((a, b) => positions[a] - positions[b]);
  let sorted = true;
  for (let i = 0; i < order.length; i++) {
    if (order[i] !== i) {
      sorted = false;
      break;
    }
  }
  if (sorted)
    return {
      categories: [...categories],
      positions: [...positions],
      series: [...series],
    };
  const remap = new Map<number, number>();
  order.forEach((oldIndex, newIndex) => remap.set(oldIndex, newIndex));
  return {
    categories: order.map((i) => categories[i]),
    positions: order.map((i) => positions[i]),
    series: series.map((sd) => {
      const values = new Map<number, number>();
      for (const [ci, v] of sd.values) values.set(remap.get(ci)!, v);
      const extras = remapExtras(sd.extras, (ci) => remap.get(ci));
      return { ...sd, values, ...(extras ? { extras } : {}) };
    }),
  };
}

/**
 * `seriesConfig` 적용 — 설정된 시리즈를 배열 순서대로 앞에, 미설정 시리즈를 출현
 * (group) / valueFields (columns) 순서대로 뒤에 둔다. 팔레트 인덱스는 **정렬 전**
 * 출현 순서로 이미 배정돼 있어 config 만 재정렬해도 색은 그대로다 (breakdown §2);
 * 검증된 토큰만 그 인덱스를 덮는다. 보이지 않는 시리즈의 설정은 건드리지 않는다
 * (휴면 보존 — 저장 배열은 여기서 읽기만 한다). ADR-312 Phase 4 — family 의 색 항목도 같은 규칙 (`chartSeriesItems`).
 */
export function applySeriesConfig<
  T extends { id: string; label?: string; seriesIndex: number },
>(series: T[], seriesConfig: readonly ResolvedSeriesConfig[]): T[] {
  if (seriesConfig.length === 0) return series;
  const byId = new Map(series.map((s) => [s.id, s]));
  const ordered: T[] = [];
  const placed = new Set<T>();
  for (const config of seriesConfig) {
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

/**
 * ADR-306 Phase 6 — 행의 범주 이름 (`buildSeriesGrid` 와 같은 읽기). 범위 선택의 확대가 고른 범주의 행만
 * 남길 때 쓴다.
 */
export function rowCategoryLabel(
  row: ChartRow,
  props: Pick<ChartProps, "dimension">,
): string {
  return toLabel(readField(row, props.dimension));
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
export function valueExtent(
  grid: SeriesGrid,
  mode: StackMode,
  /** ADR-217 — domain 에 포함할 추가 값 (기준선). scene 이 domain 을 정한다 (HC3). */
  include: readonly number[] = [],
  /**
   * ADR-306 Phase 5 — false 면 0 을 넣지 않는다 (line · area · scatter 의 `includeZero: false` — 누적은
   * 늘 0 에서 쌓으므로 무시). 기본 true = 지금까지의 축.
   */
  fromZero = true,
): ValueExtent {
  const zero = fromZero || mode !== "none";
  let min = zero ? 0 : Number.POSITIVE_INFINITY;
  let max = zero ? 0 : Number.NEGATIVE_INFINITY;
  for (const v of include) {
    if (v > max) max = v;
    if (v < min) min = v;
  }
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
    // ADR-306 Phase 5 — 범위 띠 경계도 축 안에 (띠가 plot 밖으로 나가지 않게).
    for (const band of [series.extras?.lower, series.extras?.upper])
      if (band)
        for (const v of band.values()) {
          if (v > max) max = v;
          if (v < min) min = v;
        }
  }
  return Number.isFinite(min) && Number.isFinite(max)
    ? { min, max }
    : { min: 0, max: 0 };
}

/** ADR-217 — 기준선 값 목록 (domain 확장 입력). 미설정이면 빈 배열 (현행 extent 와 같다). */
export function referenceValues(
  presentation: Pick<ResolvedChartPresentation, "referenceLines">,
): readonly number[] {
  return presentation.referenceLines.length === 0
    ? EMPTY_VALUES
    : presentation.referenceLines.map((line) => line.value);
}
const EMPTY_VALUES: readonly number[] = [];

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

/**
 * ADR-306 Phase 5 — 범주를 값 합으로 정렬 (bar · pie 의 `sort`, breakdown §2.1). 합은 시리즈 값의 합
 * (pie 는 크기 — 절대값). 같은 합은 원래 순서. 시리즈 값 · 보조 값의 인덱스도 같이 옮긴다.
 */
export function sortCategories(
  grid: SeriesGrid,
  sort: "ascending" | "descending",
  magnitude: boolean,
): SeriesGrid {
  const n = grid.categories.length;
  const totals = new Array<number>(n).fill(0);
  for (const series of grid.series)
    for (const [ci, v] of series.values)
      totals[ci] += magnitude ? Math.abs(v) : v;
  const order = [...Array(n).keys()].sort((a, b) =>
    sort === "descending"
      ? totals[b] - totals[a] || a - b
      : totals[a] - totals[b] || a - b,
  );
  if (order.every((ci, i) => ci === i)) return grid;
  const at = new Map(order.map((ci, i) => [ci, i]));
  return {
    ...grid,
    categories: order.map((ci) => grid.categories[ci]),
    series: grid.series.map((sd) => {
      const values = new Map<number, number>();
      for (const [ci, v] of sd.values) values.set(at.get(ci)!, v);
      const extras = remapExtras(sd.extras, (ci) => at.get(ci));
      return { ...sd, values, ...(extras ? { extras } : {}) };
    }),
  };
}
