import {
  buildSeriesGrid,
  type ChartProps,
  type ChartRow,
  type ChartSeriesConfig,
} from "@composition/rendering";

import type { ResolvedField } from "@composition/shared";

import "./ChartAuthoringControls.css";

/**
 * 범주가 색을 가르는 모드 (pie · 단일 시리즈 radial · bar colorBy=category) 에서는 시리즈
 * 설정이 적용되지 않는다 — Series 섹션 자체를 열지 않는다 (저장 config 는 휴면 보존).
 * `PropertiesPanel` 이 `sectionExtras.series` 를 넣을지 여기로 판정한다.
 */
export function chartSeriesConfigApplies(
  fields: ResolvedField[],
  rows: readonly ChartRow[],
  paletteLength: number,
): boolean {
  const props = Object.fromEntries(
    fields.map((field) => [field.key, field.currentValue]),
  ) as Record<string, unknown>;
  const chartType = String(props.chartType ?? "bar");
  if (chartType === "pie") return false;
  if (chartType === "bar" && props.colorBy === "category") return false;
  if (chartType === "radial") {
    const grid = buildSeriesGrid(
      rows,
      props as unknown as ChartProps,
      Math.max(1, paletteLength),
    );
    return grid.series.length > 1;
  }
  return true;
}

export function swap<T>(items: T[], a: number, b: number): T[] {
  if (a < 0 || b < 0 || a >= items.length || b >= items.length) return items;
  const next = [...items];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** 표시 순서가 자연 순서와 마지막으로 갈리는 자리 (그 앞은 key 만 있어도 저장). 같으면 0. */
export function lastOrderChange(
  entries: readonly ChartSeriesConfig[],
  defaultOrder: readonly string[],
): number {
  let last = 0;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].key !== defaultOrder[i]) last = i + 1;
  }
  return last;
}
