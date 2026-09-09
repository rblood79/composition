import { buildSeriesGrid, stackRangesBySeries, valueExtent } from "./series";
import { niceTicks } from "./scales";
import type { ChartProps, ChartRow } from "./types";
import type { SeriesGrid, StackMode, StackRange } from "./series";
import type { TickResult } from "./scales";

export interface ChartDataModel {
  grid: SeriesGrid;
  keys: string[];
  rows: Array<Record<string, number | string | null>>;
  stackMode: StackMode;
  bands: Array<Map<number, StackRange>>;
  ticks: TickResult;
}

/** 원본 행의 이름과 무관한 내부 series 키. 원본 source와 저장 props를 변경하지 않는다. */
export function resolveChartData(
  rows: readonly ChartRow[],
  props: ChartProps,
  seriesCount: number,
): ChartDataModel {
  const grid = buildSeriesGrid(rows, props, seriesCount);
  const stackMode =
    props.chartType !== "radar" &&
    grid.series.length > 1 &&
    props.stackType !== "dodged"
      ? props.stackType
      : "none";
  const extent = valueExtent(grid, stackMode);
  const keys = grid.series.map((_, i) => `series${i}`);
  return {
    grid,
    keys,
    stackMode,
    bands: stackRangesBySeries(grid, stackMode),
    ticks: niceTicks(extent.min, extent.max, 5),
    rows: grid.categories.map((category, ci) => ({
      category,
      categoryIndex: ci,
      ...Object.fromEntries(
        grid.series.map((s, i) => [keys[i], s.values.get(ci) ?? null]),
      ),
    })),
  };
}
