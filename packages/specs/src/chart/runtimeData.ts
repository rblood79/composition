import { buildSeriesGrid, stackRangesBySeries, valueExtent } from "./series";
import { niceTicks } from "./scales";
import { resolveChartPresentation } from "./presentation";
import { resolveChartModel } from "./model";
import type { ChartModelView } from "./model";
import { CHART_TICK_COUNT } from "./layout";
import type { ChartLayout } from "./layout";
import type { DisplayBudget } from "./budget";
import type { ResolvedChartPresentation } from "./presentation";
import type { ChartDiagnostic, ChartProps, ChartRow } from "./types";
import type { SeriesGrid, StackMode, StackRange } from "./series";
import type { TickResult } from "./scales";

export interface ChartDataModel {
  /** 그리는 격자 — `view` 를 주면 **visible** (창 적용), 없으면 input. */
  grid: SeriesGrid;
  keys: string[];
  rows: Array<Record<string, number | string | null>>;
  stackMode: StackMode;
  bands: Array<Map<number, StackRange>>;
  /** 값 축 눈금 — domain 은 transformed 전체 (창을 옮겨도 축이 흔들리지 않는다). */
  ticks: TickResult;
  /**
   * ADR-210 — 정규화된 표시 설정·진단. `ok=false` 면 runtime 도 설정 오류 상태를
   * 보여 준다 (Canvas 의 `CHART_INVALID_SETTINGS_TEXT` 와 같은 뜻) — grid 는 그대로
   * 들어 있어 데이터는 보존된다.
   */
  presentation: ResolvedChartPresentation;
  // ── ADR-211 — `view` 를 준 호출에만 있다 (크기 없이는 `fit` 이 없다).
  /** 원본 격자 (범례·시리즈 목록의 원천) */
  input?: SeriesGrid;
  /** Canvas 와 같은 입력으로 푼 layout — DOM leg 는 이것을 쓴다 (다시 풀지 않는다) */
  layout?: ChartLayout;
  budget?: DisplayBudget;
  /** 행 상한 적용 전 원본 행 수 */
  sourceRowCount: number;
  /** 표시 설정 진단 + 행 상한 + 예산 진단 */
  diagnostics: readonly ChartDiagnostic[];
}

/** `view` 를 준 호출의 모델 — layout · budget · input 이 항상 있다. */
export type ChartViewDataModel = ChartDataModel &
  Required<Pick<ChartDataModel, "input" | "layout" | "budget">>;

/**
 * 원본 행의 이름과 무관한 내부 series 키 (`series0`…). 원본 source 와 저장 props 를
 * 변경하지 않는다. 내부 키는 소비 시점에만 있고 원본 필드 `series0`/`a.b` 와 충돌하지
 * 않는다 — 행을 grid 에서 다시 만들기 때문이다 (원본 행을 Recharts 에 직접 주지 않는다).
 *
 * ADR-211: `view` (크기·metrics·창 시작) 를 주면 Canvas 와 같은 `resolveChartModel` 을
 * 거쳐 **visible** 격자를 돌려준다 — 행 상한 `R` · 슬롯 예산 `fit` · 창이 두 leg 에서
 * 같은 함수로 결정된다. `view` 가 없으면 input 층만 (크기 없는 모델 테스트 전용).
 */
export function resolveChartData(
  rows: readonly ChartRow[],
  props: ChartProps,
  seriesCount: number,
  view: ChartModelView,
): ChartViewDataModel;
export function resolveChartData(
  rows: readonly ChartRow[],
  props: ChartProps,
  seriesCount: number,
  view?: ChartModelView,
): ChartDataModel;
export function resolveChartData(
  rows: readonly ChartRow[],
  props: ChartProps,
  seriesCount: number,
  view?: ChartModelView,
): ChartDataModel {
  if (view) {
    const model = resolveChartModel(rows, props, view);
    // domain 은 모델의 `ticks` (transformed 전체) — Canvas scene 과 같은 값 (breakdown §2.5).
    //   radar 는 `stackType` 을 무시하므로 (R8) 그때만 없음-누적 눈금을 따로 잰다.
    const stackMode = runtimeStackMode(props, model.input);
    const ticks =
      stackMode === model.layout.stackMode
        ? model.ticks
        : radarTicks(model.transformed);
    return finishModel(model.visible, stackMode, ticks, {
      presentation: model.presentation,
      input: model.input,
      layout: model.layout,
      budget: model.budget,
      sourceRowCount: model.sourceRowCount,
      diagnostics: model.diagnostics,
    });
  }
  const presentation = resolveChartPresentation(props, seriesCount);
  const grid = buildSeriesGrid(rows, props, seriesCount, presentation);
  const stackMode = runtimeStackMode(props, grid);
  const extent = valueExtent(grid, stackMode);
  return finishModel(
    grid,
    stackMode,
    niceTicks(extent.min, extent.max, CHART_TICK_COUNT),
    {
      presentation,
      sourceRowCount: rows.length,
      diagnostics: presentation.diagnostics,
    },
  );
}

function radarTicks(grid: SeriesGrid): TickResult {
  const extent = valueExtent(grid, "none");
  return niceTicks(extent.min, extent.max, CHART_TICK_COUNT);
}

/** radar 는 `stackType` 을 무시한다 (scene 의 R8 과 같은 규칙) — 시리즈 수는 input 기준. */
function runtimeStackMode(props: ChartProps, grid: SeriesGrid): StackMode {
  return props.chartType !== "radar" &&
    grid.series.length > 1 &&
    props.stackType !== "dodged"
    ? props.stackType
    : "none";
}

function finishModel(
  grid: SeriesGrid,
  stackMode: StackMode,
  ticks: TickResult,
  rest: Omit<
    ChartDataModel,
    "grid" | "keys" | "rows" | "stackMode" | "bands" | "ticks"
  >,
): ChartDataModel {
  const keys = grid.series.map((_, i) => `series${i}`);
  return {
    grid,
    keys,
    stackMode,
    bands: stackRangesBySeries(grid, stackMode),
    ticks,
    rows: grid.categories.map((category, ci) => ({
      category,
      categoryIndex: ci,
      ...Object.fromEntries(
        grid.series.map((s, i) => [keys[i], s.values.get(ci) ?? null]),
      ),
    })),
    ...rest,
  };
}
