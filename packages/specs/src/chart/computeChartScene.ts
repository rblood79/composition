/**
 * ADR-194 — 기하 SSOT 진입점.
 *
 * `computeChartScene(props, rows, size, metrics)` 은 순수 함수다. Builder(Skia) 와
 * Preview/Publish(SVG) 가 이 하나를 호출하고, 좌표를 복사만 한다 — "CSS 가 기준"
 * 도 "Skia 가 기준" 도 아니고 이 함수가 기준이다 (ssot-hierarchy §1 D3 대칭).
 */
import { buildAxes } from "./axes";
import { buildPolarAxes } from "./polarAxes";
import { angleScale, radiusScale } from "./polar";
import { toScreen } from "./curves";
import { buildLegend, legendExtent } from "./legend";
import type { LegendEntry } from "./legend";
import { buildAreaMarks } from "./marks/area";
import { buildBarMarks } from "./marks/bar";
import { buildDotMarks, dotRadius } from "./marks/dots";
import { buildLineMarks, seriesAxialPoints } from "./marks/line";
import { buildPieMarks } from "./marks/pie";
import { buildRadarMarks } from "./marks/radar";
import { buildRadialMarks } from "./marks/radial";
import type { RadialRing } from "./marks/radial";
import {
  approxTextWidth,
  bandScale,
  formatTick,
  linearScale,
  niceTicks,
  r2,
} from "./scales";
import { buildSeriesGrid, valueExtent } from "./series";
import type { SeriesGrid } from "./series";
import {
  buildBandTooltip,
  buildPolarBandTooltip,
  buildRingTooltip,
  buildRadialTooltip,
} from "./tooltip";
import type { StackMode } from "./series";
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
  curve: "linear",
  showDots: false,
  showValueLabels: false,
  colorBy: "series",
  innerRadius: 0,
  gridType: "polygon",
  showSpokes: true,
  gridRings: 0,
  fillGrid: false,
  fillArea: true,
  showTotal: false,
  showTooltip: false,
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
    tooltip: null,
    empty: true,
  };
}

/**
 * R7 — 신규 `chartType` 이 분기 없이 통과하는 자리를 컴파일 오류로 바꾼다.
 * 유니온 확장 자체는 컴파일 신호를 남기지 않으므로 (breakdown F15) 이 함수가
 * `ChartType` 확장에 대한 유일한 기계 방어선이다.
 */
function assertNever(value: never): never {
  throw new Error(`unhandled chartType: ${String(value)}`);
}

/** 극좌표 계열 (radar/radial) 의 중심·반지름 — plot 사각형에 내접시킨다. */
interface PolarSceneInput {
  size: ChartSize;
  outer: Rect;
  plot: Rect;
  legendBox: Rect | null;
  legendEntries: readonly LegendEntry[];
  metrics: ChartMetrics;
  fontSize: number;
}

/**
 * ADR-207 — 극좌표 scene.
 *
 * radar 는 **범주가 각도 · 값이 반지름**, radial 은 **범주가 링 · 값이 각도**다.
 * 둘의 축 구성이 갈리므로 (radar 만 스포크·동심 격자를 갖는다) 여기서 나뉜다.
 */
function computePolarScene(
  props: ChartProps,
  grid: SeriesGrid,
  input: PolarSceneInput,
): ChartScene {
  const { size, outer, plot, legendBox, legendEntries, metrics, fontSize } =
    input;

  // 각도 레이블이 바깥으로 나가므로 그만큼 반지름을 줄인다 (radar 만).
  const labelRoom =
    props.chartType === "radar" && props.showAxis
      ? fontSize * 2.2
      : fontSize * 0.5;
  const radius = Math.min(plot.w, plot.h) / 2 - labelRoom;
  if (radius <= 0) return emptyScene(size, outer);

  const center = {
    x: r2(plot.x + plot.w / 2),
    y: r2(plot.y + plot.h / 2),
    outer: r2(radius),
    inner: r2((radius * Math.min(90, Math.max(0, props.innerRadius))) / 100),
  };

  // R8 — radar 는 `stackType` 을 **무시한다**. 다각형은 시리즈끼리 겹쳐 보이는 것이
  //   표현이라 누적할 축이 없다 (Recharts `Radar` 도 stackId 를 받지 않는다).
  //   radial 은 호가 쌓이므로 누적이 뜻을 갖는다 (shadcn `chart-radial-stacked`).
  const stackMode: StackMode =
    props.chartType === "radial" &&
    grid.series.length > 1 &&
    props.stackType !== "dodged"
      ? props.stackType
      : "none";
  const extent = valueExtent(grid, stackMode);
  const ticks = niceTicks(extent.min, extent.max, CHART_TICK_COUNT);
  const angle = angleScale(grid.categories.length);
  const value = radiusScale(ticks.domain, [center.inner, center.outer]);

  const marks: Mark[] = [];
  const labels: Mark[] = [];

  if (props.chartType === "radar") {
    const radar = buildRadarMarks({
      grid,
      angle,
      value,
      center,
      strokeWidth: metrics.strokeWidth,
      fillArea: props.fillArea,
      showValueLabels: props.showValueLabels,
      fontSize,
    });
    marks.push(...radar.marks);
    labels.push(...radar.labels);
    if (props.showDots) {
      radar.vertices.forEach((points, si) => {
        const dot = buildDotMarks(
          points,
          grid.series[si].seriesIndex,
          dotRadius(metrics.strokeWidth),
        );
        if (dot) marks.push(dot);
      });
    }
  }

  let radialRings: readonly RadialRing[] = [];
  if (props.chartType === "radial") {
    const radial = buildRadialMarks({
      grid,
      center,
      domain: ticks.domain,
      seriesCount: metrics.seriesCount,
      stackMode,
      showValueLabels: props.showValueLabels,
      fontSize,
    });
    marks.push(...radial.marks);
    labels.push(...radial.labels);
    radialRings = radial.rings;
  }

  const axes =
    props.chartType === "radar"
      ? buildPolarAxes({
          categories: grid.categories,
          angle,
          center,
          ticks,
          gridType: props.gridType,
          fontSize,
          showAxis: props.showAxis,
          showGrid: props.showGrid,
          showSpokes: props.showSpokes,
          gridRings: props.gridRings,
          fillGrid: props.fillGrid,
        })
      : // radial 은 트랙 호가 격자 노릇을 한다 — 축을 따로 그리면 이중선이 된다
        //   (shadcn `chart-radial-*` 도 PolarGrid 를 쓰지 않는다).
        [];

  return {
    size,
    plot,
    marks: [...marks, ...labels],
    axes,
    legend: legendBox
      ? buildLegend({
          entries: legendEntries,
          box: legendBox,
          position: props.legendPosition,
          fontSize,
        })
      : null,
    tooltip: !props.showTooltip
      ? null
      : radialRings.length > 0
        ? buildRingTooltip({
            rings: radialRings,
            seriesKeys: grid.series.map((series) => series.key || "series"),
            center,
          })
        : buildPolarBandTooltip({
            grid,
            angle,
            center,
            seriesCount: metrics.seriesCount,
          }),
    empty: false,
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
        label: series.key || "series",
        colorIndex: series.seriesIndex,
      }));

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

  // ── 파이는 축이 없다 ─────────────────────────────────────────────────────
  if (props.chartType === "pie") {
    const pie = buildPieMarks({
      grid,
      plot,
      seriesCount: metrics.seriesCount,
      showValueLabels: props.showValueLabels,
      innerRadius: props.innerRadius,
      showTotal: props.showTotal,
      totalCaption: props.metric,
      // 파이의 링 분할은 값 축이 없어 여기서 따로 판정한다 (bar/area 의 stackMode
      //   는 축 계산 뒤에 나온다 — 파이 분기는 그보다 앞이다).
      stackMode:
        grid.series.length > 1 && props.stackType !== "dodged"
          ? props.stackType
          : "none",
      fontSize,
    });
    if (pie.marks.length === 0) return emptyScene(normalizedSize, outer);
    return {
      size: normalizedSize,
      plot,
      marks: [...pie.marks, ...pie.labels],
      axes: [],
      legend: legendBox
        ? buildLegend({
            entries: legendEntries,
            box: legendBox,
            position: props.legendPosition,
            fontSize,
          })
        : null,
      tooltip:
        props.showTooltip && pie.hit
          ? buildRadialTooltip({
              grid,
              slices: pie.hit.slices,
              seriesCount: metrics.seriesCount,
              center: pie.hit.center,
            })
          : null,
      empty: false,
    };
  }

  // ── 극좌표 (radar/radial) 는 직교 축이 없다 ──────────────────────────────
  if (props.chartType === "radar" || props.chartType === "radial") {
    return computePolarScene(props, grid, {
      size: normalizedSize,
      outer,
      plot,
      legendBox,
      legendEntries,
      metrics,
      fontSize,
    });
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

  // 점은 선/띠 **뒤에** 밀어 넣는다 — 두 consumer 가 같은 순서로 그리므로 겹치는
  //   자리에서 점이 항상 위에 온다 (순서가 갈리면 그 자리에서만 화면이 다르다).
  const pushDots = (points: readonly { x: number; y: number }[], si: number): void => {
    const dot = buildDotMarks(
      points,
      grid.series[si].seriesIndex,
      dotRadius(metrics.strokeWidth),
    );
    if (dot) marks.push(dot);
  };

  let marks: Mark[];
  let labels: Mark[] = [];
  // R7 — 분기를 `else` 로 닫으면 신규 chartType 이 조용히 line 으로 그려진다.
  //   `assertNever` 가 그 자리를 컴파일 오류로 바꾼다 (유니온 확장 자체는 컴파일
  //   신호를 안 남기므로 — breakdown F15 — 방어선은 여기 하나뿐이다).
  const cartesianType: "bar" | "area" | "line" = props.chartType;
  if (cartesianType === "bar") {
    const bar = buildBarMarks({
      grid,
      band,
      value,
      plot,
      orientation: props.orientation,
      stackMode,
      colorBy: props.colorBy,
      seriesCount: metrics.seriesCount,
      showValueLabels: props.showValueLabels,
      fontSize,
    });
    marks = [...bar.marks];
    labels = bar.labels;
  } else if (cartesianType === "area") {
    const area = buildAreaMarks({
      grid,
      band,
      value,
      plot,
      orientation: props.orientation,
      strokeWidth: metrics.strokeWidth,
      stackMode,
      curve: props.curve,
      showValueLabels: props.showValueLabels,
    });
    marks = [...area.marks];
    labels = area.labels;
    if (props.showDots) area.upper.forEach((points, si) => pushDots(points, si));
  } else if (cartesianType === "line") {
    const line = buildLineMarks({
      grid,
      band,
      value,
      plot,
      orientation: props.orientation,
      strokeWidth: metrics.strokeWidth,
      curve: props.curve,
      showValueLabels: props.showValueLabels,
      fontSize,
    });
    marks = [...line.marks];
    labels = line.labels;
    if (props.showDots) {
      for (let si = 0; si < grid.series.length; si++) {
        pushDots(
          seriesAxialPoints(grid, si, band, value).map((point) =>
            toScreen(props.orientation, point),
          ),
          si,
        );
      }
    }
  } else {
    return assertNever(cartesianType);
  }

  // 값 레이블은 마크 뒤에 — 겹치는 자리에서 글자가 위에 온다.
  if (labels.length > 0) marks = [...marks, ...labels];

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
          entries: legendEntries,
          box: legendBox,
          position: props.legendPosition,
          fontSize,
        })
      : null,
    tooltip: props.showTooltip
      ? buildBandTooltip({
          grid,
          band,
          plot,
          orientation: props.orientation,
          seriesCount: metrics.seriesCount,
        })
      : null,
    empty: false,
  };
}

/** rule 의 `chart` 채널 모양 (shared `ComponentRuleChart` 미러 — specs 는 shared 를 import 하지 않는다). */
export interface ChartRuleChannel {
  series: readonly string[];
  axis: string;
  grid: string;
  strokeWidth?: number;
  metrics?: Readonly<Record<string, { padding: number; fontSize: number }>>;
  tooltipBackground?: string;
  tooltipBorder?: string;
  tooltipText?: string;
}

/**
 * rule 의 chart 채널 + size 키 → 기하 metric.
 *
 * **두 consumer 가 같이 부른다** (DOM `Chart.tsx` / Skia `chart_scene` primitive).
 * 각자 rule 을 해석하면 padding/fontSize 가 갈려 좌표가 어긋나는데, 그 어긋남은
 * 스냅샷 테스트가 아니라 live 화면에서만 보인다 — 그래서 해석을 한 곳에 둔다.
 */
export function resolveChartMetrics(
  channel: ChartRuleChannel | undefined,
  sizeKey: string,
): ChartMetrics {
  const entry = channel?.metrics?.[sizeKey];
  return {
    padding: entry?.padding ?? CHART_DEFAULT_METRICS.padding,
    fontSize: entry?.fontSize ?? CHART_DEFAULT_METRICS.fontSize,
    strokeWidth: channel?.strokeWidth ?? CHART_DEFAULT_METRICS.strokeWidth,
    seriesCount:
      channel?.series.length ?? CHART_DEFAULT_METRICS.seriesCount,
  };
}

/**
 * scene 의 `TextMark`(점 기준 앵커) → Skia `TextShape` 의 박스 기하.
 *
 * **두 렌더러의 텍스트 앵커 의미가 다르다.** DOM `<text textAnchor>` 는 `x` 를 **점**으로
 * 두고 그 점을 기준으로 정렬한다. Skia 쪽 converter 는 문단 박스로 옮기는데, `align:"center"`
 * 는 `[x, containerWidth - x]` 안에서 가운데 정렬이라 **결과가 항상 컨테이너 중앙** 이고 `x`
 * 는 사실상 무시된다 (`specShapeConverter` text case). 그래서 좌표를 그대로 넘기면 축 레이블이
 * 전부 상자 한가운데로 몰린다 — 2026-09-08 live 에서 실제로 그렇게 나왔고, 좌표 숫자만 비교하는
 * 단위 parity 는 두 값이 같아서 통과했다.
 *
 * 해소: 중앙 정렬은 **중심이 `px` 가 되는 박스** `[x, x + 2(px - x)]` 로 옮긴다. 좌/우 정렬은
 * converter 의 의미가 점 기준과 일치하므로 그대로 둔다. 매핑을 여기 한 곳에 두어 primitive 와
 * parity 테스트가 같은 규칙을 본다.
 */
export interface SkiaTextGeometry {
  x: number;
  align: "left" | "center" | "right";
  maxWidth?: number;
}

export function toSkiaTextGeometry(
  mark: { x: number; anchor: "start" | "middle" | "end"; text: string },
  fontSize: number,
): SkiaTextGeometry {
  if (mark.anchor === "start") return { x: r2(mark.x), align: "left" };
  if (mark.anchor === "end") return { x: r2(mark.x), align: "right" };
  const needed = approxTextWidth(mark.text, fontSize) + fontSize;
  // 왼쪽을 **먼저** 반올림하고 폭을 거기서 파생한다. 순서를 바꾸면 왕복
  //   (`skiaTextAnchorX`) 이 0.01 씩 어긋나 좌표 동일성 게이트가 흔들린다.
  const left = r2(Math.max(0, mark.x - needed / 2));
  return {
    x: left,
    align: "center",
    maxWidth: r2((mark.x - left) * 2),
  };
}

/** `toSkiaTextGeometry` 의 역 — 박스에서 앵커 점을 되돌린다 (parity 검증용). */
export function skiaTextAnchorX(geometry: SkiaTextGeometry): number {
  if (geometry.align === "center") {
    return r2(geometry.x + (geometry.maxWidth ?? 0) / 2);
  }
  return geometry.x;
}
