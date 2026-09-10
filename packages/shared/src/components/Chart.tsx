/** ADR-209: 공통 collection rows를 소비하는 lazy Recharts runtime 컨테이너.
 * Builder의 Canvas scene은 유지하며, Preview/Publish는 같은 adapter를 사용한다.
 * CSS base class와 size/variant 토큰은 이 경계에서 유지한다.
 */

import React from "react";
import {
  CHART_DEFAULT_PROPS,
  getChartDescriptor,
  resolveChartMetrics,
} from "@composition/specs";
import type {
  ChartAnimationEasing,
  ChartColorBy,
  ChartCurve,
  ChartLegendPosition,
  ChartOrientation,
  ChartRow,
  ChartStackType,
  ChartType,
  ChartLabelKey,
  ChartProps as SpecChartProps,
  PolarGridType,
} from "@composition/specs";
import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";
import {
  asPropertyBinding,
  useCollectionData,
} from "../hooks/useCollectionData";
import type { DataBinding } from "../types";

export interface ChartProps {
  isAnimationActive?: boolean;
  animationBegin?: number;
  animationDuration?: number;
  animationEasing?: ChartAnimationEasing;
  chartType?: ChartType;
  dimension?: string;
  metric?: string;
  color?: string;
  orientation?: ChartOrientation;
  stackType?: ChartStackType;
  curve?: ChartCurve;
  showDots?: boolean;
  showValueLabels?: boolean;
  colorBy?: ChartColorBy;
  innerRadius?: number;
  /** radar 격자 모양 (ADR-207) */
  gridType?: PolarGridType;
  /** radar 스포크 표시 (shadcn `PolarGrid radialLines`) */
  showSpokes?: boolean;
  /** 동심 격자 링 개수 (0=값 눈금 따름) */
  gridRings?: number;
  /** 가장 바깥 격자 링 채우기 */
  fillGrid?: boolean;
  /** radar 다각형 채우기 (false=선만) */
  fillArea?: boolean;
  /** radial 값 호의 각도 범위 (도, 12시=0 시계). 반원 게이지 = 0~180 */
  startAngle?: number;
  endAngle?: number;
  /** 마크 위 레이블 내용 — 값 또는 범주명 */
  labelKey?: ChartLabelKey;
  showTotal?: boolean;
  showTooltip?: boolean;
  showAxis?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  legendPosition?: ChartLegendPosition;
  // ── ADR-210 — 전부 선택적 (specs `ChartProps` 와 같은 뜻). 명시 destructure 가 필수다:
  //   빠뜨리면 `...rest` 로 `<div>` 속성에 새어 나간다 (P0 inventory `Chart.tsx:300`).
  dataMode?: SpecChartProps["dataMode"];
  valueFields?: SpecChartProps["valueFields"];
  seriesConfig?: SpecChartProps["seriesConfig"];
  valueFormat?: SpecChartProps["valueFormat"];
  valueLocale?: SpecChartProps["valueLocale"];
  valueFractionDigits?: number;
  valueCurrency?: string;
  valuePercentUnit?: SpecChartProps["valuePercentUnit"];
  // ── ADR-211 — 표시 예산 4 키 (전부 선택적, 스칼라).
  budgetOverflow?: SpecChartProps["budgetOverflow"];
  budgetAggregate?: SpecChartProps["budgetAggregate"];
  budgetAxis?: SpecChartProps["budgetAxis"];
  budgetOthersLabel?: string;
  variant?: string;
  size?: "sm" | "md" | "lg";
  /** 샘플/정적 rows — dataBinding 이 없을 때만 사용하는 입력 */
  data?: readonly ChartRow[];
  /**
   * dataTable/API 바인딩 (ADR-152/159 계약 재사용 — 새 data source 경로 0).
   *
   * **`useResolvedCollectionItems` 가 아니라 `useCollectionData` 를 쓴다**: 전자는 행을
   * `{label, description, value}` projection 으로 정규화하는데, 차트는 사용자가 지정한
   * 임의 필드명(`dimension`/`metric`/`color`)을 읽어야 해서 **원본 레코드** 가 필요하다.
   */
  dataBinding?: DataBinding;
  /** 요소 id — 바인딩 캐시 키 */
  "data-element-id"?: string;
  /** 접근성 라벨 (미지정 시 "chart") */
  "aria-label"?: string;
  style?: React.CSSProperties;
  className?: string;
  [dataAttr: `data-${string}`]: unknown;
}

export { renderChartScene, seriesVar } from "./chart/svgDecorations";

/**
 * 컨테이너 실측 크기. scene 은 **실제 박스 크기** 위에 그려져야 Skia(엔진 layout 이
 * 준 w/h) 와 같은 좌표가 나온다 — 고정 viewBox 로 늘리면 텍스트만 왜곡돼 비대칭이 된다.
 */
function useBoxSize(ref: React.RefObject<HTMLDivElement | null>): {
  width: number;
  height: number;
  borderLeft: number;
  borderTop: number;
} {
  const [size, setSize] = React.useState({
    width: 0,
    height: 0,
    borderLeft: 0,
    borderTop: 0,
  });

  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = (): void => {
      const rect = node.getBoundingClientRect();
      setSize((prev) =>
        prev.width === rect.width &&
        prev.height === rect.height &&
        prev.borderLeft === node.clientLeft &&
        prev.borderTop === node.clientTop
          ? prev
          : {
              width: rect.width,
              height: rect.height,
              borderLeft: node.clientLeft,
              borderTop: node.clientTop,
            },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

const RechartsRuntime = React.lazy(() =>
  import("./chart/RechartsChart").then((module) => ({
    default: module.RechartsChart,
  })),
);

export function Chart({
  isAnimationActive,
  animationBegin,
  animationDuration,
  animationEasing,
  chartType,
  dimension,
  metric,
  color,
  orientation,
  stackType,
  curve,
  showDots,
  showValueLabels,
  colorBy,
  innerRadius,
  gridType,
  showSpokes,
  gridRings,
  fillGrid,
  fillArea,
  startAngle,
  endAngle,
  labelKey,
  showTotal,
  showTooltip,
  showAxis,
  showGrid,
  showLegend,
  legendPosition,
  dataMode,
  valueFields,
  seriesConfig,
  valueFormat,
  valueLocale,
  valueFractionDigits,
  valueCurrency,
  valuePercentUnit,
  budgetOverflow,
  budgetAggregate,
  budgetAxis,
  budgetOthersLabel,
  variant = "default",
  size = "md",
  data,
  dataBinding,
  style,
  className,
  "aria-label": ariaLabel,
  ...rest
}: ChartProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const rule = resolveComponentRule("Chart");
  const sizeKey = String(size).toLowerCase();
  const box = useBoxSize(ref);

  const chartSize = React.useMemo(
    () => ({ width: box.width, height: box.height }),
    [box.width, box.height],
  );
  // 배열 props 는 **직렬화 키**로 안정화한다 — postMessage 가 같은 내용을 새 참조로
  //   재전송해도 model·animation 이 재시작하지 않는다 (`rowsKey` 선례, breakdown §2.2).
  const valueFieldsKey = JSON.stringify(valueFields ?? null);
  const seriesConfigKey = JSON.stringify(seriesConfig ?? null);
  const chartProps = React.useMemo(
    () => ({
      isAnimationActive,
      animationBegin,
      animationDuration,
      animationEasing,
      chartType: chartType ?? CHART_DEFAULT_PROPS.chartType,
      dimension: dimension ?? CHART_DEFAULT_PROPS.dimension,
      metric: metric ?? CHART_DEFAULT_PROPS.metric,
      ...(color ? { color } : {}),
      orientation: orientation ?? CHART_DEFAULT_PROPS.orientation,
      stackType: stackType ?? CHART_DEFAULT_PROPS.stackType,
      curve: curve ?? CHART_DEFAULT_PROPS.curve,
      showDots: showDots ?? CHART_DEFAULT_PROPS.showDots,
      showValueLabels: showValueLabels ?? CHART_DEFAULT_PROPS.showValueLabels,
      colorBy: colorBy ?? CHART_DEFAULT_PROPS.colorBy,
      innerRadius: innerRadius ?? CHART_DEFAULT_PROPS.innerRadius,
      gridType: gridType ?? CHART_DEFAULT_PROPS.gridType,
      showSpokes: showSpokes ?? CHART_DEFAULT_PROPS.showSpokes,
      gridRings: gridRings ?? CHART_DEFAULT_PROPS.gridRings,
      fillGrid: fillGrid ?? CHART_DEFAULT_PROPS.fillGrid,
      fillArea: fillArea ?? CHART_DEFAULT_PROPS.fillArea,
      startAngle: startAngle ?? CHART_DEFAULT_PROPS.startAngle,
      endAngle: endAngle ?? CHART_DEFAULT_PROPS.endAngle,
      labelKey: labelKey ?? CHART_DEFAULT_PROPS.labelKey,
      showTotal: showTotal ?? CHART_DEFAULT_PROPS.showTotal,
      showTooltip: showTooltip ?? CHART_DEFAULT_PROPS.showTooltip,
      showAxis: showAxis ?? CHART_DEFAULT_PROPS.showAxis,
      showGrid: showGrid ?? CHART_DEFAULT_PROPS.showGrid,
      showLegend: showLegend ?? CHART_DEFAULT_PROPS.showLegend,
      legendPosition: legendPosition ?? CHART_DEFAULT_PROPS.legendPosition,
      // ADR-210 — 미설정 키는 싣지 않는다 (specs 가 미설정 = group/auto 로 읽는다).
      ...(dataMode !== undefined ? { dataMode } : {}),
      ...(valueFields !== undefined
        ? { valueFields: JSON.parse(valueFieldsKey) as string[] }
        : {}),
      ...(seriesConfig !== undefined
        ? {
            seriesConfig: JSON.parse(
              seriesConfigKey,
            ) as SpecChartProps["seriesConfig"],
          }
        : {}),
      ...(valueFormat !== undefined ? { valueFormat } : {}),
      ...(valueLocale !== undefined ? { valueLocale } : {}),
      ...(valueFractionDigits !== undefined ? { valueFractionDigits } : {}),
      ...(valueCurrency !== undefined ? { valueCurrency } : {}),
      ...(valuePercentUnit !== undefined ? { valuePercentUnit } : {}),
      ...(budgetOverflow !== undefined ? { budgetOverflow } : {}),
      ...(budgetAggregate !== undefined ? { budgetAggregate } : {}),
      ...(budgetAxis !== undefined ? { budgetAxis } : {}),
      ...(budgetOthersLabel !== undefined ? { budgetOthersLabel } : {}),
    }),
    [
      isAnimationActive,
      animationBegin,
      animationDuration,
      animationEasing,
      chartType,
      dimension,
      metric,
      color,
      orientation,
      stackType,
      curve,
      showDots,
      showValueLabels,
      colorBy,
      innerRadius,
      gridType,
      showSpokes,
      gridRings,
      fillGrid,
      fillArea,
      startAngle,
      endAngle,
      labelKey,
      showTotal,
      showTooltip,
      showAxis,
      showGrid,
      showLegend,
      legendPosition,
      dataMode,
      valueFieldsKey,
      seriesConfigKey,
      valueFormat,
      valueLocale,
      valueFractionDigits,
      valueCurrency,
      valuePercentUnit,
      budgetOverflow,
      budgetAggregate,
      budgetAxis,
      budgetOthersLabel,
    ],
  );

  // metrics 해석은 두 consumer 공용 (resolveChartMetrics) — 각자 풀면 좌표가 갈린다.
  const { padding, paddingTop, paddingRight, paddingBottom, paddingLeft } =
    style ?? {};
  const metrics = React.useMemo(
    () =>
      resolveChartMetrics(rule?.chart, sizeKey, {
        padding,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
      }),
    [
      rule,
      sizeKey,
      padding,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
    ],
  );

  const {
    data: boundRows,
    loading,
    error,
    reload,
  } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "Chart",
    elementId: rest["data-element-id"] as string | undefined,
  });
  const rows = dataBinding ? boundRows : (data ?? []);
  const label = ariaLabel ?? getChartDescriptor(chartProps.chartType).label;
  const status =
    dataBinding && loading
      ? "loading"
      : dataBinding && error
        ? "error"
        : rows.length === 0
          ? "empty"
          : "ready";
  return (
    <div
      {...rest}
      ref={ref}
      role="group"
      aria-label={label}
      className={
        className ? `react-aria-Chart ${className}` : "react-aria-Chart"
      }
      data-variant={variant}
      data-size={size}
      data-chart-status={status}
      data-chart-row-count={rows.length}
      style={{ position: "relative", ...style }}
    >
      {status === "error" ? (
        <div role="alert">
          {error}
          {asPropertyBinding(dataBinding)?.source !== "dataTable" && (
            <button type="button" onClick={reload}>
              Retry
            </button>
          )}
        </div>
      ) : status === "loading" ? (
        <div role="status">Loading…</div>
      ) : box.width > 0 && box.height > 0 ? (
        <React.Suspense fallback={<div role="status">Loading chart…</div>}>
          {/* viewport는 border box 원점을 공유한다. 사용자 padding은 공통 metrics가
              내부 plot/범례에 적용하므로 CSS가 viewport를 한 번 더 밀지 않는다. */}
          <div
            style={{
              position: "absolute",
              left: -box.borderLeft,
              top: -box.borderTop,
              width: box.width,
              height: box.height,
            }}
          >
            <RechartsRuntime
              props={chartProps}
              rows={rows}
              size={chartSize}
              metrics={metrics}
              label={label}
            />
          </div>
        </React.Suspense>
      ) : null}
    </div>
  );
}
