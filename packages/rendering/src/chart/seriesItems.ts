/**
 * ADR-312 Phase 4 — 시리즈 표시 표 공통 (breakdown §2.5 · 본문 Decision 6 · F9).
 *
 * 색이 이름 붙은 항목을 가르는 모든 종류가 `seriesConfig` 를 같은 identity (`["group", 값]` · `["field", key]` —
 * ADR-210) 와 같은 규칙 (`applySeriesConfig` — 표에 있는 항목은 표의 순서 · 이름 · 색, 나머지는 출현 순서) 으로
 * 읽는다. 항목 목록은 종류마다 하나 (`CHART_SERIES_KIND`) 이고, family 의 그리기와 패널의 Series 섹션이 같은
 * 함수 (`chartSeriesItems`) 를 읽는다.
 */
import { resolveFieldRef } from "../data/fieldIdIndex";
import {
  resolveSeriesConfig,
  seriesIdentity,
  type ChartSeriesSource,
} from "./presentation";
import { chartActiveForm, resolveChartRoleDefaults } from "./roles";
import { applySeriesConfig, buildSeriesGrid } from "./series";
import {
  SERIES_CHART_TYPES,
  type ChartDiagnostic,
  type ChartPaintRole,
  type ChartProps,
  type ChartRow,
  type ChartType,
} from "./types";

/**
 * 색 항목의 원천.
 * - `grid` — 시리즈 격자 (`buildSeriesGrid` — group 은 `color` 값, columns 는 값 열).
 * - `color` — `color` 열의 값 (marimekko 의 열 안 계열 · histogram 의 묶음 · slope 의 항목).
 * - `category` — 범주 (`dimension`) 값 하나하나가 색 조각 (segmented · waffle).
 * - `startEnd` — 앞 · 뒤 값 열 (dumbbell).
 * - `valueFields` — 값 열 목록 (parallel 의 축).
 */
export type ChartSeriesKind =
  "grid" | "color" | "category" | "startEnd" | "valueFields";

const GRID_FAMILY: readonly ChartType[] = ["stream", "bump", "skyline"];

export const CHART_SERIES_KIND: Partial<Record<ChartType, ChartSeriesKind>> = {
  ...Object.fromEntries(
    [...SERIES_CHART_TYPES, ...GRID_FAMILY].map((type) => [type, "grid"]),
  ),
  marimekko: "color",
  histogram: "color",
  slope: "color",
  segmented: "category",
  waffle: "category",
  dumbbell: "startEnd",
  parallel: "valueFields",
};

/** 그 종류가 `seriesConfig` 를 읽는가 (패널 Series 섹션을 여는 조건). */
export function chartSeriesKind(type: unknown): ChartSeriesKind | undefined {
  return CHART_SERIES_KIND[type as ChartType];
}

export interface ChartSeriesItem {
  /** identity (`seriesIdentity`) — `seriesConfig.key` 와 대조하는 값 */
  id: string;
  /** 원본 값 (그룹 값 · 필드 key) — 기본 표시 이름 */
  key: string;
  /** 설정된 표시 이름 (부재 = `key`, 빈 글자 = 명시적 빈 이름) */
  label?: string;
  /** 팔레트 자리 — 출현 순서 (팔레트 길이로 나눈 나머지), 설정된 색이면 그 토큰 자리 */
  seriesIndex: number;
  /** 표에서 색을 정했다 — 역할 칠 (accent · neutral) 로 그리는 종류는 이때만 팔레트 색으로 바꾼다 */
  colored?: true;
}

const distinct = (rows: readonly ChartRow[], key: string | null): string[] => {
  if (key === null) return [];
  const seen = new Set<string>();
  for (const row of rows) {
    const value = row[key];
    seen.add(value === null || value === undefined ? "" : String(value));
  }
  return [...seen];
};

const refKey = (ref: unknown): string | null =>
  typeof ref === "string" && ref !== "" ? resolveFieldRef(ref) : null;

/**
 * 그 종류의 색 항목 — 표 (`seriesConfig`) 를 적용한 순서 · 이름 · 색. `natural` 이면 표를 빼고 (패널이 「key 만
 * 있는 항목을 저장할지」 를 가르는 자연 순서). 표의 형식 진단은 `diagnostics` 에 더한다 (시리즈 경로와 같은 코드).
 */
export function chartSeriesItems(
  inputProps: ChartProps,
  rows: readonly ChartRow[],
  paletteLength: number,
  options: { natural?: boolean; diagnostics?: ChartDiagnostic[] } = {},
): ChartSeriesItem[] {
  const kind = chartSeriesKind(inputProps.chartType);
  if (!kind) return [];
  const props = resolveChartRoleDefaults(inputProps, rows);
  const palette = Math.max(1, paletteLength);
  if (kind === "grid")
    return buildSeriesGrid(
      rows,
      {
        ...props,
        // bump 의 순위 형태는 값 대신 순위 열을 읽는다 (`seriesTable` 과 같다).
        ...(chartActiveForm(props).id === "ranked"
          ? { metric: props.rankField }
          : {}),
        ...(options.natural ? { seriesConfig: undefined } : {}),
      },
      palette,
    ).series.map(({ id, key, label, seriesIndex }) => ({
      id,
      key,
      ...(label !== undefined ? { label } : {}),
      seriesIndex,
    }));
  const config = options.natural
    ? []
    : resolveSeriesConfig(props.seriesConfig, palette, options.diagnostics);
  // `field` 항목의 identity 는 저장된 참조 그대로 (`#id` — 시리즈 격자의 columns 와 같다), 이름은 풀린 key.
  let source: ChartSeriesSource = "group";
  let refs: { ref: string; key: string }[];
  const fieldRefs = (values: unknown[]) =>
    values.flatMap((ref) => {
      const key = refKey(ref);
      return key === null ? [] : [{ ref: ref as string, key }];
    });
  switch (kind) {
    case "color":
      refs = distinct(rows, refKey(props.color)).map((key) => ({
        ref: key,
        key,
      }));
      break;
    case "category":
      refs = distinct(rows, refKey(props.dimension)).map((key) => ({
        ref: key,
        key,
      }));
      break;
    case "startEnd":
      source = "field";
      refs = fieldRefs([props.startField, props.endField]);
      break;
    case "valueFields":
      source = "field";
      refs = fieldRefs(
        Array.isArray(props.valueFields) ? props.valueFields : [],
      );
      break;
  }
  const items: ChartSeriesItem[] = refs.map(({ ref, key }, i) => ({
    id: seriesIdentity(source, ref),
    key,
    seriesIndex: i % palette,
  }));
  const colored = new Set(
    config.filter((c) => c.paletteIndex !== undefined).map((c) => c.key),
  );
  return applySeriesConfig(items, config).map((item) =>
    colored.has(item.id) ? { ...item, colored: true as const } : item,
  );
}

/** 항목 표시 이름 (설정 이름, 없으면 원본 값). */
export function chartSeriesName(item: ChartSeriesItem): string {
  return item.label ?? item.key;
}

/** key → 항목 (family 가 자기 모델의 원본 값으로 찾는다). */
export function chartSeriesByKey(
  items: readonly ChartSeriesItem[],
): Map<string, ChartSeriesItem> {
  return new Map(items.map((item) => [item.key, item]));
}

/**
 * 역할 칠로 그리는 종류 (dumbbell · histogram · slope) 의 채움 — 표에서 색을 정한 항목은 그 팔레트 색, 아니면
 * 그 종류의 역할 칠 그대로.
 */
export function chartSeriesFill(
  item: ChartSeriesItem | undefined,
  paint: ChartPaintRole,
): { fillPaint: ChartPaintRole } | { fillSeries: number; fillOpacity: 1 } {
  return item?.colored
    ? { fillSeries: item.seriesIndex, fillOpacity: 1 }
    : { fillPaint: paint };
}

/** 같은 규칙의 선 (path 마크의 `strokeSeries` · `strokePaint`). */
export function chartSeriesStroke(
  item: ChartSeriesItem | undefined,
  paint: ChartPaintRole,
): { strokePaint: ChartPaintRole } | { strokeSeries: number } {
  return item?.colored
    ? { strokeSeries: item.seriesIndex }
    : { strokePaint: paint };
}

/** 툴팁 · 범례 견본 (역할 칠 또는 팔레트 자리). */
export function chartSeriesSwatch(
  item: ChartSeriesItem | undefined,
  paint: ChartPaintRole,
): { paint: ChartPaintRole } | { series: number } {
  return item?.colored ? { series: item.seriesIndex } : { paint };
}
