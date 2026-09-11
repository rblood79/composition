/**
 * ADR-194 — 기하 SSOT 진입점.
 *
 * `computeChartScene(props, rows, size, metrics)` 은 순수 함수다. Builder(Skia) 와
 * Preview/Publish(SVG) 가 이 하나를 호출하고, 좌표를 복사만 한다 — "CSS 가 기준"
 * 도 "Skia 가 기준" 도 아니고 이 함수가 기준이다 (ssot-hierarchy §1 D3 대칭).
 */
import { buildAxes } from "./axes";
import { parsePadding4Way } from "../primitives/cssValueParser";
import { buildPolarAxes } from "./polarAxes";
import { angleScale, radiusScale } from "./polar";
import { toScreen } from "./curves";
import { buildLegend } from "./legend";
import type { LegendEntry } from "./legend";
import {
  CHART_BUDGET_DEFAULTS,
  mergeBudgetMetrics,
  polarGeometry,
} from "./budget";
import type { ChartBudgetMetrics } from "./budget";
import { CHART_TICK_COUNT, resolveChartLayout } from "./layout";
import type { ChartLayout } from "./layout";
import { resolveChartModel } from "./model";
import { buildAreaMarks } from "./marks/area";
import { buildBarMarks } from "./marks/bar";
import { buildWindowTrackMarks } from "./marks/windowTrack";
import { buildDotMarks, dotRadius } from "./marks/dots";
import { buildLineMarks, seriesAxialPoints } from "./marks/line";
import { buildPieMarks } from "./marks/pie";
import { buildRadarMarks } from "./marks/radar";
import { buildRadialMarks } from "./marks/radial";
import type { RadialRing } from "./marks/radial";
import {
  approxTextWidth,
  bandScale,
  linearScale,
  niceTicks,
  r2,
} from "./scales";
import { seriesLabel, valueExtent } from "./series";
import type { SeriesGrid } from "./series";
import { positionBand, timeScaleFor } from "./timeAxis";
import type { ChartTimeAxisModel } from "./timeAxis";
import {
  buildBandTooltip,
  buildPolarBandTooltip,
  buildRingTooltip,
  buildRadialTooltip,
} from "./tooltip";
import type { StackMode } from "./series";
import type {
  ChartDiagnostic,
  ChartLabelFormatter,
  ChartMetrics,
  ChartProps,
  ChartRow,
  ChartScene,
  ChartSize,
  Mark,
  Rect,
} from "./types";

/** 팔레트 소진 시 순환 기준 — rule 의 series 배열 길이가 없을 때의 기본값. */
export const CHART_DEFAULT_SERIES_COUNT = 8;

export const CHART_DEFAULT_METRICS: ChartMetrics = {
  padding: 12,
  fontSize: 11,
  strokeWidth: 2,
  seriesCount: CHART_DEFAULT_SERIES_COUNT,
  ...CHART_BUDGET_DEFAULTS,
};

// `resolveChartLayout` 은 `layout.ts` 로 옮겼다 (ADR-211 P1) — 기존 import 경로 유지.
export { CHART_TICK_COUNT, resolveChartLayout };
export type { ChartLayout };

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
  startAngle: 0,
  endAngle: 360,
  labelKey: "value",
  showTotal: false,
  showTooltip: false,
  showAxis: true,
  showGrid: false,
  showLegend: false,
  legendPosition: "bottom",
};

function emptyScene(
  size: ChartSize,
  plot: Rect,
  text = "No data",
  diagnostics?: readonly ChartDiagnostic[],
): ChartScene {
  return {
    size,
    plot,
    marks: [
      {
        kind: "text",
        x: r2(plot.x + plot.w / 2),
        y: r2(plot.y + plot.h / 2),
        text,
        anchor: "middle",
        baseline: "middle",
        role: "empty",
      },
    ],
    axes: [],
    legend: null,
    tooltip: null,
    empty: true,
    ...(diagnostics && diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

/**
 * ADR-210 — 설정 오류 상태의 안내 문구. 데이터는 보존되고 (props 불변) 다른 뜻으로
 * 렌더하지 않는다 — 두 consumer 가 `empty` 텍스트 마크를 그대로 그리므로 Canvas 와
 * DOM 이 같은 안내를 낸다.
 */
export const CHART_INVALID_SETTINGS_TEXT = "Check chart settings";

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
  labelText: ChartLabelFormatter;
  formatValue: (raw: number) => string;
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
  diagnostics: readonly ChartDiagnostic[] = [],
): ChartScene {
  const {
    size,
    outer,
    plot,
    legendBox,
    legendEntries,
    metrics,
    fontSize,
    labelText,
  } = input;

  // 각도 레이블이 바깥으로 나가므로 그만큼 반지름을 줄인다 (radar 만). 식은 예산
  //   `fit` 이 읽는 `polarGeometry` 와 같은 것이다 (ADR-211 — 한 곳).
  const radius = polarGeometry(props.chartType, plot, fontSize, props);
  if (radius.outer <= 0) return emptyScene(size, outer);

  const center = {
    x: r2(plot.x + plot.w / 2),
    y: r2(plot.y + plot.h / 2),
    outer: r2(radius.outer),
    inner: r2(radius.inner),
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
      labelText,
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
      startAngle: props.startAngle,
      endAngle: props.endAngle,
      showValueLabels: props.showValueLabels,
      labelText,
      showTotal: props.showTotal,
      totalCaption: props.metric,
      totalText: input.formatValue,
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
            seriesKeys: grid.series.map((series) =>
              seriesLabel(series, "series"),
            ),
            center,
            formatValue: input.formatValue,
          })
        : buildPolarBandTooltip({
            grid,
            angle,
            center,
            seriesCount: metrics.seriesCount,
            formatValue: input.formatValue,
          }),
    empty: false,
    ...(diagnostics.length > 0 ? { diagnostics } : {}),
  };
}

export function computeChartScene(
  props: ChartProps,
  rows: readonly ChartRow[],
  size: ChartSize,
  metrics: ChartMetrics = CHART_DEFAULT_METRICS,
): ChartScene {
  // ADR-211 — 모델 층 (행 상한 · 예산 · 창) 은 DOM leg 와 같은 `resolveChartModel` 이다.
  //   Canvas 는 창 `start = 0` 을 정적으로 그린다 (빌더는 상호작용 표면이 아니다).
  const model = resolveChartModel(rows, props, {
    size,
    metrics,
    windowStart: 0,
  });
  const { presentation, input, diagnostics } = model;
  // 마크 · 축 · tooltip 은 **visible** 격자에서, domain (`ticks`) 은 transformed 에서 (layout).
  const grid = model.visible;
  const {
    normalizedSize,
    outer,
    plot,
    legendBox,
    legendEntries,
    labelText,
    fontSize,
    stackMode,
    horizontal,
    tickText,
    formatValue,
    windowTrack,
  } = model.layout;
  const { ticks } = model;
  const withDiagnostics = diagnostics.length > 0 ? { diagnostics } : {};
  // 설정 오류 (ADR-210) 는 데이터 유무보다 먼저다 — 잘못된 설정으로 그린 그림은
  //   "다른 뜻" 이라 아예 그리지 않는다. 진단은 scene 에 실어 UI 가 읽는다.
  if (!presentation.ok) {
    return emptyScene(
      normalizedSize,
      outer,
      CHART_INVALID_SETTINGS_TEXT,
      diagnostics,
    );
  }
  if (
    outer.w <= 0 ||
    outer.h <= 0 ||
    input.categories.length === 0 ||
    !input.hasValues ||
    plot.w <= 0 ||
    plot.h <= 0
  ) {
    return emptyScene(normalizedSize, outer, "No data", diagnostics);
  }
  // `fitEff = 0` (플롯이 최소 슬롯보다 좁다) — 마크 0 + 진단 `plot-too-small`. 데이터는
  //   보존되고 empty 경로 ("No data") 가 아니다 (breakdown §2.1).
  if (grid.categories.length === 0) {
    return {
      size: normalizedSize,
      plot,
      marks: [],
      axes: [],
      legend: null,
      tooltip: null,
      empty: false,
      ...withDiagnostics,
    };
  }

  // ── 파이는 축이 없다 ─────────────────────────────────────────────────────
  if (props.chartType === "pie") {
    const pie = buildPieMarks({
      grid,
      plot,
      seriesCount: metrics.seriesCount,
      showValueLabels: props.showValueLabels,
      labelText,
      innerRadius: props.innerRadius,
      showTotal: props.showTotal,
      totalCaption: props.metric,
      totalText: formatValue,
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
              formatValue,
            })
          : null,
      empty: false,
      ...withDiagnostics,
    };
  }

  // ── 극좌표 (radar/radial) 는 직교 축이 없다 ──────────────────────────────
  if (props.chartType === "radar" || props.chartType === "radial") {
    return computePolarScene(
      props,
      grid,
      {
        size: normalizedSize,
        outer,
        plot,
        legendBox,
        legendEntries,
        metrics,
        fontSize,
        labelText,
        formatValue,
      },
      diagnostics,
    );
  }

  // ADR-216 — 시간 스케일이면 epoch 위 linearScale 을 BandScale 어댑터로 (마크 빌더 무변경).
  const { band, timeAxis } = resolveCategoryBand(
    model.time,
    grid,
    horizontal ? [plot.y, r2(plot.y + plot.h)] : [plot.x, r2(plot.x + plot.w)],
  );
  const value = linearScale(
    ticks.domain,
    horizontal ? [plot.x, r2(plot.x + plot.w)] : [r2(plot.y + plot.h), plot.y],
  );

  // 점은 선/띠 **뒤에** 밀어 넣는다 — 두 consumer 가 같은 순서로 그리므로 겹치는
  //   자리에서 점이 항상 위에 온다 (순서가 갈리면 그 자리에서만 화면이 다르다).
  const pushDots = (
    points: readonly { x: number; y: number }[],
    si: number,
  ): void => {
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
      labelText,
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
      labelText,
    });
    marks = [...area.marks];
    labels = area.labels;
    if (props.showDots)
      area.upper.forEach((points, si) => pushDots(points, si));
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
      labelText,
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
  // ADR-211 창 트랙 — DOM 은 같은 자리에 Slider 를 얹고 Canvas 는 비활성 트랙을 그린다.
  if (windowTrack) marks = [...marks, ...buildWindowTrackMarks(windowTrack)];

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
      tickText,
      ...(timeAxis ? { time: timeAxis } : {}),
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
          formatValue,
        })
      : null,
    empty: false,
    ...(windowTrack ? { windowTrack } : {}),
    ...withDiagnostics,
  };
}

/**
 * ADR-216 — 범주 축 band. **두 leg 가 같이 부른다** (scene · `RechartsChart`): 시간 모델이 있으면
 * epoch 위치 band (`positionBand`) + 축 입력 (`buildAxes.time`), 없으면 현행 등간격 `bandScale`.
 * 각자 고르면 한쪽만 시간 간격이 된다.
 */
export function resolveCategoryBand(
  time: ChartTimeAxisModel | undefined,
  grid: Pick<SeriesGrid, "categories" | "positions">,
  range: readonly [number, number],
): {
  band: ReturnType<typeof bandScale>;
  timeAxis: { scale: ReturnType<typeof linearScale>; labels: ChartTimeAxisModel["labels"] } | null;
} {
  if (time && grid.positions) {
    const scale = timeScaleFor(time, range);
    return {
      band: positionBand(grid.positions, scale),
      timeAxis: { scale, labels: time.labels },
    };
  }
  return { band: bandScale(grid.categories.length, range), timeAxis: null };
}

/** rule 의 `chart` 채널 모양 (shared `ComponentRuleChart` 미러 — specs 는 shared 를 import 하지 않는다). */
export interface ChartRuleChannel {
  series: readonly string[];
  /** ADR-215 — 대안 팔레트 (id → 토큰 배열). `resolveChartPalette` 가 고른다. */
  palettes?: Readonly<Record<string, readonly string[]>>;
  axis: string;
  grid: string;
  strokeWidth?: number;
  metrics?: Readonly<Record<string, { padding: number; fontSize: number }>>;
  tooltipBackground?: string;
  tooltipBorder?: string;
  tooltipText?: string;
  /** ADR-211 — others 범주 토큰 */
  others?: string;
  /** ADR-211 — 표시 예산 (최소 단위 5종 · `M` · `P` · `R` · 창 트랙 높이). 없는 키는 P0 확정값. */
  budget?: Partial<ChartBudgetMetrics>;
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
  style?: Parameters<typeof parsePadding4Way>[0],
): ChartMetrics {
  const entry = channel?.metrics?.[sizeKey];
  const padding = entry?.padding ?? CHART_DEFAULT_METRICS.padding;
  return {
    // 사용자 longhand > shorthand > catalog 기본값. 미지정 방향은 기본값 유지.
    padding: style
      ? parsePadding4Way({ ...style, padding: style.padding ?? padding })
      : padding,
    fontSize: entry?.fontSize ?? CHART_DEFAULT_METRICS.fontSize,
    strokeWidth: channel?.strokeWidth ?? CHART_DEFAULT_METRICS.strokeWidth,
    seriesCount: channel?.series.length ?? CHART_DEFAULT_METRICS.seriesCount,
    ...mergeBudgetMetrics(channel?.budget),
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
