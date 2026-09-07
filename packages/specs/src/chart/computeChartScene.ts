/**
 * ADR-194 — 기하 SSOT 진입점.
 *
 * `computeChartScene(props, rows, size, metrics)` 은 순수 함수다. Builder(Skia) 와
 * Preview/Publish(SVG) 가 이 하나를 호출하고, 좌표를 복사만 한다 — "CSS 가 기준"
 * 도 "Skia 가 기준" 도 아니고 이 함수가 기준이다 (ssot-hierarchy §1 D3 대칭).
 */
import { buildAxes } from "./axes";
import { buildLegend, legendExtent } from "./legend";
import { buildAreaMarks } from "./marks/area";
import { buildBarMarks } from "./marks/bar";
import { buildLineMarks } from "./marks/line";
import { buildPieMarks } from "./marks/pie";
import {
  approxTextWidth,
  bandScale,
  formatTick,
  linearScale,
  niceTicks,
  r2,
} from "./scales";
import { buildSeriesGrid, valueExtent } from "./series";
import type {
  ChartMetrics,
  ChartProps,
  ChartRow,
  ChartScene,
  ChartSize,
  Mark,
  Rect,
} from "./types";

export const CHART_TICK_COUNT = 5;

/** 빌더가 캔버스에 그리는 행 상한 (ADR-157 샘플 정책 동형). */
export const CHART_SAMPLE_ROWS = 200;

/** 팔레트 소진 시 순환 기준 — rule 의 series 배열 길이가 없을 때의 기본값. */
export const CHART_DEFAULT_SERIES_COUNT = 8;

export const CHART_DEFAULT_METRICS: ChartMetrics = {
  padding: 12,
  fontSize: 11,
  strokeWidth: 2,
  seriesCount: CHART_DEFAULT_SERIES_COUNT,
};

export const CHART_DEFAULT_PROPS: ChartProps = {
  chartType: "bar",
  dimension: "category",
  metric: "value",
  orientation: "vertical",
  stackType: "dodged",
  showAxis: true,
  showGrid: false,
  showLegend: false,
  legendPosition: "bottom",
};

function emptyScene(size: ChartSize, plot: Rect): ChartScene {
  return {
    size,
    plot,
    marks: [
      {
        kind: "text",
        x: r2(plot.x + plot.w / 2),
        y: r2(plot.y + plot.h / 2),
        text: "No data",
        anchor: "middle",
        baseline: "middle",
        role: "empty",
      },
    ],
    axes: [],
    legend: null,
    empty: true,
  };
}

export function computeChartScene(
  props: ChartProps,
  rows: readonly ChartRow[],
  size: ChartSize,
  metrics: ChartMetrics = CHART_DEFAULT_METRICS,
): ChartScene {
  const width = Number.isFinite(size.width) ? Math.max(0, size.width) : 0;
  const height = Number.isFinite(size.height) ? Math.max(0, size.height) : 0;
  const normalizedSize: ChartSize = { width: r2(width), height: r2(height) };
  const pad = metrics.padding;
  const fontSize = metrics.fontSize;

  const outer: Rect = {
    x: r2(pad),
    y: r2(pad),
    w: r2(Math.max(0, width - pad * 2)),
    h: r2(Math.max(0, height - pad * 2)),
  };

  const grid = buildSeriesGrid(rows, props, metrics.seriesCount);

  if (
    outer.w <= 0 ||
    outer.h <= 0 ||
    grid.categories.length === 0 ||
    !grid.hasValues
  ) {
    return emptyScene(normalizedSize, outer);
  }

  // ── 범례 자리 확보 ───────────────────────────────────────────────────────
  const wantsLegend = props.showLegend && grid.series.length > 0;
  let legendBox: Rect | null = null;
  let plot: Rect = outer;

  if (wantsLegend) {
    const position = props.legendPosition;
    const vertical = position === "left" || position === "right";
    const extent = legendExtent(
      grid,
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

  // ── 파이는 축이 없다 ─────────────────────────────────────────────────────
  if (props.chartType === "pie") {
    const marks: Mark[] = buildPieMarks({
      grid,
      plot,
      seriesCount: metrics.seriesCount,
    });
    if (marks.length === 0) return emptyScene(normalizedSize, outer);
    return {
      size: normalizedSize,
      plot,
      marks,
      axes: [],
      legend: legendBox
        ? buildLegend({
            grid,
            box: legendBox,
            position: props.legendPosition,
            fontSize,
          })
        : null,
      empty: false,
    };
  }

  // ── 축 자리 확보 ─────────────────────────────────────────────────────────
  const stacked = props.stackType === "stacked" && grid.series.length > 1;
  const extent = valueExtent(grid, stacked);
  const ticks = niceTicks(extent.min, extent.max, CHART_TICK_COUNT);
  const horizontal = props.orientation === "horizontal";

  if (props.showAxis) {
    // 값 축 레이블이 차지하는 폭/높이 — tick 문자열 길이로 정한다.
    let widestTick = 0;
    for (const tick of ticks.ticks) {
      const w = approxTextWidth(formatTick(tick), fontSize);
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

  if (plot.w <= 0 || plot.h <= 0) return emptyScene(normalizedSize, outer);

  const band = bandScale(
    grid.categories.length,
    horizontal
      ? [plot.y, r2(plot.y + plot.h)]
      : [plot.x, r2(plot.x + plot.w)],
  );
  const value = linearScale(
    ticks.domain,
    horizontal
      ? [plot.x, r2(plot.x + plot.w)]
      : [r2(plot.y + plot.h), plot.y],
  );

  let marks: Mark[];
  if (props.chartType === "bar") {
    marks = buildBarMarks({
      grid,
      band,
      value,
      plot,
      orientation: props.orientation,
      stacked,
    });
  } else if (props.chartType === "area") {
    marks = buildAreaMarks({
      grid,
      band,
      value,
      plot,
      orientation: props.orientation,
      strokeWidth: metrics.strokeWidth,
    });
  } else {
    marks = buildLineMarks({
      grid,
      band,
      value,
      plot,
      orientation: props.orientation,
      strokeWidth: metrics.strokeWidth,
    });
  }

  return {
    size: normalizedSize,
    plot,
    marks,
    axes: buildAxes({
      categories: grid.categories,
      band,
      value,
      ticks,
      plot,
      orientation: props.orientation,
      fontSize,
      showAxis: props.showAxis,
      showGrid: props.showGrid,
    }),
    legend: legendBox
      ? buildLegend({
          grid,
          box: legendBox,
          position: props.legendPosition,
          fontSize,
        })
      : null,
    empty: false,
  };
}
