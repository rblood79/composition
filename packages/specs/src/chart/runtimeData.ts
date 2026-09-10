import { buildSeriesGrid, stackRangesBySeries, valueExtent } from "./series";
import { niceTicks } from "./scales";
import { resolveChartPresentation } from "./presentation";
import type { ResolvedChartPresentation } from "./presentation";
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
  /**
   * ADR-210 — 정규화된 표시 설정·진단. `ok=false` 면 runtime 도 설정 오류 상태를
   * 보여 준다 (Canvas 의 `CHART_INVALID_SETTINGS_TEXT` 와 같은 뜻) — grid 는 그대로
   * 들어 있어 데이터는 보존된다.
   */
  presentation: ResolvedChartPresentation;
}

/**
 * 원본 행의 이름과 무관한 내부 series 키 (`series0`…). 원본 source 와 저장 props 를
 * 변경하지 않는다. 내부 키는 소비 시점에만 있고 원본 필드 `series0`/`a.b` 와 충돌하지
 * 않는다 — 행을 grid 에서 다시 만들기 때문이다 (원본 행을 Recharts 에 직접 주지 않는다).
 */
export function resolveChartData(
  rows: readonly ChartRow[],
  props: ChartProps,
  seriesCount: number,
): ChartDataModel {
  const presentation = resolveChartPresentation(props, seriesCount);
  const grid = buildSeriesGrid(rows, props, seriesCount, presentation);
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
    presentation,
    rows: grid.categories.map((category, ci) => ({
      category,
      categoryIndex: ci,
      ...Object.fromEntries(
        grid.series.map((s, i) => [keys[i], s.values.get(ci) ?? null]),
      ),
    })),
  };
}
