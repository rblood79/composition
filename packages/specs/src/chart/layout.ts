/**
 * ADR-194 — 공유 레이아웃 (여백 · 범례 자리 · 축 여백 · 값 축 눈금 · 표시 정책).
 *
 * `computeChartScene.ts` 에서 순수 이동 (ADR-211 P1) — 모델 층 (`model.ts`) 이 예산 `fit` 을
 * 재기 전에 `plot` 을 알아야 하는데, scene 진입점을 import 하면 순환이다. 마크 path 는
 * 각 렌더러가 생성한다.
 */
import { legendExtent } from "./legend";
import type { LegendEntry } from "./legend";
import { approxTextWidth, formatTick, niceTicks, r2 } from "./scales";
import { formatChartNumber } from "./presentation";
import type { ResolvedChartPresentation } from "./presentation";
import { seriesLabel, valueExtent } from "./series";
import type { SeriesGrid, StackMode } from "./series";
import type {
  ChartLabelFormatter,
  ChartMetrics,
  ChartProps,
  ChartSize,
  Rect,
} from "./types";

export const CHART_TICK_COUNT = 5;

export interface ChartLayout {
  normalizedSize: ChartSize;
  outer: Rect;
  plot: Rect;
  legendBox: Rect | null;
  legendEntries: readonly LegendEntry[];
  labelText: ChartLabelFormatter;
  fontSize: number;
  stackMode: StackMode;
  ticks: ReturnType<typeof niceTicks>;
  horizontal: boolean;
  /** ADR-210 — 정규화된 표시 설정 (두 consumer 가 같은 것을 본다). */
  presentation: ResolvedChartPresentation;
  /** 값 축 눈금 문자열 — expand 면 정규화 퍼센트 context, 아니면 raw. */
  tickText: (tick: number) => string;
  /** raw 값 문자열 — 값 라벨·tooltip·합계. */
  formatValue: (raw: number) => string;
}

/** 공유하는 것은 여백·축 단위·표시 정책이며, 마크 path는 각 렌더러가 생성한다. */
export function resolveChartLayout(
  props: ChartProps,
  grid: SeriesGrid,
  size: ChartSize,
  metrics: ChartMetrics,
  // 필수 인자다 (ADR-210 P3) — grid 를 만든 그 presentation 을 넘겨야 두 consumer 가
  //   같은 정규화 결과를 본다. 기본 인자로 다시 풀면 렌더당 최대 3회 계산이고, 호출자가
  //   grid 와 다른 props 로 부르는 실수를 타입이 못 잡는다.
  presentation: ResolvedChartPresentation,
): ChartLayout {
  const width = Number.isFinite(size.width) ? Math.max(0, size.width) : 0;
  const height = Number.isFinite(size.height) ? Math.max(0, size.height) : 0;
  const normalizedSize: ChartSize = { width: r2(width), height: r2(height) };
  const pad =
    typeof metrics.padding === "number"
      ? {
          top: metrics.padding,
          right: metrics.padding,
          bottom: metrics.padding,
          left: metrics.padding,
        }
      : metrics.padding;
  const fontSize = metrics.fontSize;

  const outer: Rect = {
    x: r2(pad.left),
    y: r2(pad.top),
    w: r2(Math.max(0, width - pad.left - pad.right)),
    h: r2(Math.max(0, height - pad.top - pad.bottom)),
  };

  // ── 범례 항목 — 색을 가르는 축을 따라간다 ────────────────────────────────
  //   pie 는 조각(범주)이, bar mixed 는 막대(범주)가 색을 가른다. 여기를 시리즈로
  //   고정해 두면 범례가 화면의 색과 무관한 이름을 나열한다 (파이에서 실제로 그랬다).
  const palette = Math.max(1, metrics.seriesCount);
  const byCategory =
    props.chartType === "pie" ||
    // radial 은 링이 범주다 — 단일 시리즈면 호마다 색이 갈리므로 범례도 범주여야
    //   화면의 색과 이름이 맞는다 (radar 는 다각형이 시리즈라 그대로).
    (props.chartType === "radial" && grid.series.length <= 1) ||
    (props.chartType === "bar" && props.colorBy === "category");
  const legendEntries: LegendEntry[] = byCategory
    ? grid.categories.map((label, ci) => ({
        label: label || "category",
        colorIndex: ci % palette,
      }))
    : grid.series.map((series) => ({
        label: seriesLabel(series, "series"),
        colorIndex: series.seriesIndex,
      }));

  // 값 문자열은 **raw** 하나뿐이다 (값 라벨·tooltip·합계 — expand 에서도 정규화하지
  //   않는다, breakdown §3.1). `auto` 면 기존 `formatTick` 과 같은 문자열이다.
  const numberFormat = presentation.numberFormat;
  const formatValue = (raw: number): string =>
    numberFormat.format === "auto"
      ? formatTick(raw)
      : formatChartNumber(raw, numberFormat, "raw");

  // 레이블 내용 규칙은 **여기 한 곳**이다 — 마크 빌더 6개는 자리만 정하고 무엇을
  //   적을지는 모른다 (빌더마다 분기를 두면 타입별로 규칙이 갈린다).
  const labelText: ChartLabelFormatter =
    props.labelKey === "category"
      ? (categoryIndex) => grid.categories[categoryIndex] ?? ""
      : (_categoryIndex, raw) => formatValue(raw);

  // ── 범례 자리 확보 ───────────────────────────────────────────────────────
  const wantsLegend = props.showLegend && legendEntries.length > 0;
  let legendBox: Rect | null = null;
  let plot: Rect = outer;

  if (wantsLegend) {
    const position = props.legendPosition;
    const vertical = position === "left" || position === "right";
    const extent = legendExtent(
      legendEntries,
      position,
      vertical ? outer.w : outer.w,
      fontSize,
    );
    const capped = Math.min(extent, vertical ? outer.w * 0.4 : outer.h * 0.4);
    if (capped > 0) {
      if (position === "bottom") {
        legendBox = {
          x: outer.x,
          y: r2(outer.y + outer.h - capped),
          w: outer.w,
          h: r2(capped),
        };
        plot = { ...outer, h: r2(outer.h - capped) };
      } else if (position === "top") {
        legendBox = { x: outer.x, y: outer.y, w: outer.w, h: r2(capped) };
        plot = { ...outer, y: r2(outer.y + capped), h: r2(outer.h - capped) };
      } else if (position === "left") {
        legendBox = { x: outer.x, y: outer.y, w: r2(capped), h: outer.h };
        plot = { ...outer, x: r2(outer.x + capped), w: r2(outer.w - capped) };
      } else {
        legendBox = {
          x: r2(outer.x + outer.w - capped),
          y: outer.y,
          w: r2(capped),
          h: outer.h,
        };
        plot = { ...outer, w: r2(outer.w - capped) };
      }
    }
  }

  // ── 축 자리 확보 ─────────────────────────────────────────────────────────
  // 누적은 시리즈가 2개 이상일 때만 의미가 있다 (1개면 expand 가 전부 100% 가 된다).
  const stackMode: StackMode =
    grid.series.length > 1 && props.stackType !== "dodged"
      ? props.stackType
      : "none";
  const extent = valueExtent(grid, stackMode);
  const ticks = niceTicks(extent.min, extent.max, CHART_TICK_COUNT);
  const horizontal = props.orientation === "horizontal";
  // expand 축만 정규화 단위다 — opt-in 형식이면 항상 퍼센트, auto 면 기존 문자열.
  const tickText = (tick: number): string =>
    numberFormat.format === "auto"
      ? formatTick(tick)
      : formatChartNumber(
          tick,
          numberFormat,
          stackMode === "expand" ? "normalizedPercent" : "raw",
        );

  if (props.showAxis && ["bar", "line", "area"].includes(props.chartType)) {
    // 값 축 레이블이 차지하는 폭/높이 — tick 문자열 길이로 정한다.
    let widestTick = 0;
    for (const tick of ticks.ticks) {
      const w = approxTextWidth(tickText(tick), fontSize);
      if (w > widestTick) widestTick = w;
    }
    let widestCategory = 0;
    for (const label of grid.categories) {
      const w = approxTextWidth(label, fontSize);
      if (w > widestCategory) widestCategory = w;
    }

    // 세로 막대: 좌측 = 값 레이블, 하단 = 범주 레이블
    // 가로 막대: 좌측 = 범주 레이블, 하단 = 값 레이블
    const leftGutter =
      (horizontal ? widestCategory : widestTick) + fontSize * 0.8;
    const bottomGutter = fontSize * 1.6;
    const nextW = plot.w - leftGutter;
    const nextH = plot.h - bottomGutter;
    if (nextW > 0 && nextH > 0) {
      plot = {
        x: r2(plot.x + leftGutter),
        y: plot.y,
        w: r2(nextW),
        h: r2(nextH),
      };
    }
  }

  return {
    normalizedSize,
    outer,
    plot,
    legendBox,
    legendEntries,
    labelText,
    fontSize,
    stackMode,
    ticks,
    horizontal,
    presentation,
    tickText,
    formatValue,
  };
}
