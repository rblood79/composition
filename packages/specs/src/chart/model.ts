/**
 * ADR-211 — 두 leg 가 같이 부르는 모델 층 (breakdown §2.5 · §3).
 *
 * 세 층: **input** (원본 범주·값, `series.ts` 합산 결과) → **transformed** (overflow 적용 후
 * 전체 — 창은 input 그대로, 집계/others/극값은 P2) → **visible** (창 모드만 `[start, start +
 * fitEff)` 로 자름). **domain (값 축 범위) 은 항상 transformed 전체** 에서 — 창을 옮겨도 축이
 * 흔들리지 않는다. 범례·시리즈 목록은 input 에서.
 *
 * 행 상한 `R` 도 여기서 두 leg 에 똑같이 자른다 (Canvas 전용 slice 를 두지 않는다 — round 1
 * m4). `layout` 은 input 격자로 푼다 — 축 여백 (가장 긴 범주 라벨) 이 창 위치에 따라 변하면
 * `plot` → `fit` → 창이 서로를 다시 정하는 순환이 생긴다.
 */
import {
  applyBudget,
  budgetSweep,
  capRows,
  categoryColorIndex,
  markFactor,
  polarGeometry,
  resolveAxisKind,
  resolveDisplayBudget,
} from "./budget";
import type { ChartBudgetGeometry, DisplayBudget } from "./budget";
import { CHART_TICK_COUNT, resolveChartLayout } from "./layout";
import type { ChartLayout } from "./layout";
import { niceTicks, r2 } from "./scales";
import type { TickResult } from "./scales";
import { legendExtent } from "./legend";
import type { LegendEntry } from "./legend";
import {
  CHART_AGGREGATE_SUFFIX,
  resolveChartPresentation,
} from "./presentation";
import type { ResolvedChartPresentation } from "./presentation";
import { buildSeriesGrid, valueExtent } from "./series";
import type { SeriesGrid } from "./series";
import type {
  ChartDiagnostic,
  ChartMetrics,
  ChartProps,
  ChartRow,
  ChartSize,
  Rect,
} from "./types";

export interface ChartModelView {
  size: ChartSize;
  metrics: ChartMetrics;
  /** 창 시작 — Canvas 는 항상 0, DOM 은 뷰 상태. 미지정 0. */
  windowStart?: number;
}

export interface ChartModel {
  presentation: ResolvedChartPresentation;
  /** 원본 격자 (행 상한 적용 뒤) */
  input: SeriesGrid;
  /** overflow 적용 후 전체 — domain 의 원천 */
  transformed: SeriesGrid;
  /** 실제로 그리는 격자 (창 모드만 transformed 와 다르다) */
  visible: SeriesGrid;
  /**
   * 레이아웃 — input 격자로 푼 여백·범례·축 자리. `labelText` 는 **visible index** 를 받도록
   * 창 offset 으로 다시 묶여 있다 (원본 index 를 닫은 closure 를 그대로 두면 창 `start > 0`
   * 에서 두 leg 가 같이 틀린 라벨을 찍는다).
   */
  layout: ChartLayout;
  /** 값 축 눈금 — **transformed 전체** 에서 (두 leg 가 이것만 읽는다; `layout.ticks` 는 여백 계산용) */
  ticks: TickResult;
  budget: DisplayBudget;
  /** 행 상한 적용 전 원본 행 수 */
  sourceRowCount: number;
  /** 표시 설정 진단 + 예산 진단 (순서: presentation → 행 상한 → 예산) */
  diagnostics: ChartDiagnostic[];
}

/**
 * 범주색 범례가 줄어들면 (others) input 으로 예약한 상자 안에서 필요한 만큼만 차지한다 —
 * bottom/right 는 바깥쪽에 붙고 top/left 는 그대로. plot 은 바꾸지 않는다 (plot → fit →
 * others 수 → 범례 크기의 순환을 끊는다; 남는 자리는 빈 여백).
 */
function shrinkLegendBox(
  box: Rect | null,
  position: ChartProps["legendPosition"],
  entries: readonly LegendEntry[],
  fontSize: number,
): Rect | null {
  if (!box) return null;
  const vertical = position === "left" || position === "right";
  const needed = Math.min(
    vertical ? box.w : box.h,
    legendExtent(entries, position, box.w, fontSize),
  );
  if (needed <= 0) return null;
  if (position === "bottom")
    return { ...box, y: r2(box.y + box.h - needed), h: r2(needed) };
  if (position === "top") return { ...box, h: r2(needed) };
  if (position === "left") return { ...box, w: r2(needed) };
  return { ...box, x: r2(box.x + box.w - needed), w: r2(needed) };
}

/** budget 이 읽는 기하 — scene 이 쓰는 반지름 식 (`polarGeometry`) 그대로. */
function budgetGeometry(
  props: ChartProps,
  layout: ChartLayout,
): ChartBudgetGeometry {
  const kind = props.chartType;
  if (kind === "pie" || kind === "radar" || kind === "radial") {
    return {
      plot: layout.plot,
      horizontal: false,
      radius: polarGeometry(kind, layout.plot, layout.fontSize, props),
      sweep: budgetSweep(kind, props),
    };
  }
  return { plot: layout.plot, horizontal: layout.horizontal };
}

/**
 * rows + props + 크기 → 모델. 순수 함수 — 같은 입력이면 두 leg 가 같은 visible 에 이른다.
 * 두 leg 가 갈리는 입력은 `view.size` (Compare Mode 반폭) 와 `view.windowStart` 뿐이다.
 */
export function resolveChartModel(
  rows: readonly ChartRow[],
  props: ChartProps,
  view: ChartModelView,
): ChartModel {
  const { metrics } = view;
  const presentation = resolveChartPresentation(props, metrics.seriesCount);
  const capped = capRows(rows, metrics.rowCap);
  const input = buildSeriesGrid(
    capped.rows,
    props,
    metrics.seriesCount,
    presentation,
  );
  const baseLayout = resolveChartLayout(
    props,
    input,
    view.size,
    metrics,
    presentation,
  );
  const settings = presentation.budget;
  const stacked = baseLayout.stackMode !== "none";
  const decided = resolveDisplayBudget({
    kind: props.chartType,
    geometry: budgetGeometry(props, baseLayout),
    series: input.series.length,
    stacked,
    n: input.categories.length,
    k: markFactor(props.chartType, props),
    metrics,
    axisKind: resolveAxisKind(input.categories, settings.axis),
    overflow: settings.overflow,
    aggregate: settings.aggregate,
    windowStart: view.windowStart,
  });
  // 변환 — 창 · bucket 집계 · 극값 선택 · others · pie 링 상한 (§2.4 · §2.5).
  const { budget, transformed, visible } = applyBudget(input, decided, {
    kind: props.chartType,
    stacked,
    othersLabel: settings.othersLabel,
    metrics,
  });
  const start = budget.window?.start ?? 0;
  // 실제 적용 (`applied`) 으로 판정한다 — 극값 fallback 은 요청 `mode` 가 extrema 여도 집계다.
  const suffix =
    budget.applied === "aggregate"
      ? ` ${CHART_AGGREGATE_SUFFIX[budget.aggregate]}`
      : "";
  // 값 문자열 — 집계면 접미 (`합계`/`평균`…) 로 통계를 밝힌다 (tooltip · 값 라벨 · 합계; 눈금은
  //   숫자 그대로). 라벨 텍스트는 visible 격자를 읽는다 (창 offset · 집계 라벨 `첫 ~ 끝` · others).
  const formatValue = suffix
    ? (raw: number) => `${baseLayout.formatValue(raw)}${suffix}`
    : baseLayout.formatValue;
  const labelText =
    props.labelKey === "category"
      ? (ci: number) => visible.categories[ci] ?? ""
      : (_ci: number, raw: number) => formatValue(raw);
  // 범주색 범례 (pie · radial 단일 시리즈 · bar 범주색) 는 transformed 범주 — others 가 포함되고
  //   묶인 원본은 빠진다. 상자는 input 으로 예약한 자리 안에서 필요한 만큼만 (plot 불변 — 순환 0).
  const byCategoryLegend =
    baseLayout.legendEntries.length > 0 &&
    baseLayout.legendEntries.length === input.categories.length &&
    (props.chartType === "pie" ||
      (props.chartType === "radial" && input.series.length <= 1) ||
      (props.chartType === "bar" && props.colorBy === "category"));
  const palette = Math.max(1, metrics.seriesCount);
  const legendEntries: readonly LegendEntry[] =
    byCategoryLegend && transformed !== input
      ? transformed.categories.map((label, ci) => ({
          label: label || "category",
          colorIndex: categoryColorIndex(ci, palette, transformed.othersIndex),
        }))
      : baseLayout.legendEntries;
  const legendBox =
    legendEntries === baseLayout.legendEntries
      ? baseLayout.legendBox
      : shrinkLegendBox(
          baseLayout.legendBox,
          props.legendPosition,
          legendEntries,
          baseLayout.fontSize,
        );
  const layout: ChartLayout =
    start === 0 &&
    !suffix &&
    legendEntries === baseLayout.legendEntries &&
    transformed === input
      ? baseLayout
      : { ...baseLayout, formatValue, labelText, legendEntries, legendBox };
  // domain 은 transformed 전체 — 창은 input 과 같아 `layout.ticks` 와 값이 같고, 집계/others/
  //   극값은 여기서 갈린다 (여백 폭은 input 눈금 기준 그대로 — 두 leg 같은 값).
  const extent = valueExtent(transformed, baseLayout.stackMode);
  const ticks =
    transformed === input
      ? baseLayout.ticks
      : niceTicks(extent.min, extent.max, CHART_TICK_COUNT);
  return {
    presentation,
    input,
    transformed,
    visible,
    layout,
    ticks,
    budget,
    sourceRowCount: rows.length,
    diagnostics: [
      ...presentation.diagnostics,
      ...(capped.diagnostic ? [capped.diagnostic] : []),
      ...budget.diagnostics,
    ],
  };
}
