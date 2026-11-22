/** ADR-209: 공통 collection rows를 소비하는 lazy Recharts runtime 컨테이너.
 * Builder의 Canvas scene은 유지하며, Preview/Publish는 같은 adapter를 사용한다.
 * CSS base class와 variant 토큰은 이 경계에서 유지한다 (공개 size 축은 ADR-306 에서 삭제).
 */

import type { ChartProps as SpecChartProps } from "@composition/rendering";

import {
  CHART_DEFAULT_PROPS,
  CHART_FAMILY_PROP_KEYS,
  chartFamilyAvailable,
  chartFamilyEpoch,
  chartFamilyError,
  chartFamilyOf,
  getChartDescriptor,
  getChartFamily,
  loadChartFamily,
  pickChartFamilyProps,
  chartMetricFontSize,
  resolveChartMetrics,
  subscribeChartFamilies,
} from "@composition/rendering";

import React from "react";

import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";

import {
  asPropertyBinding,
  useCollectionData,
} from "../hooks/useCollectionData";

import type { DataBinding } from "../types";

import { ChartProps, useBoxSize } from "./Chart.runtime";
import { renderChartWindowTrack } from "./chart/windowTrack";

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
  dimensionScale,
  dimensionFormat,
  dimensionLabelFormat,
  referenceLines,
  palette,
  variant = "default",
  data,
  dataBinding,
  style,
  className,
  "aria-label": ariaLabel,
  ...rest
}: ChartProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement>(null);
  const rule = resolveComponentRule("Chart");
  // ADR-306 — family 종류의 역할 · 옵션은 목록 하나 (`CHART_FAMILY_PROP_KEYS`) 로 골라 `rest` 에서
  //   뺀다 (div 속성으로 새지 않게). 배열 값이 있어 직렬화 키로 안정화한다 (`valueFieldsKey` 선례).
  const { familyProps, domRest } = splitFamilyProps(rest);
  const familyKey = JSON.stringify(familyProps);
  // ADR-306 (R1) — family 로드는 여기서 건다. epoch 가 memo 키라 로드 · 실패 뒤 다시 계산한다.
  const familyId = chartFamilyOf(chartType);
  const familyEpoch = React.useSyncExternalStore(
    subscribeChartFamilies,
    chartFamilyEpoch,
    chartFamilyEpoch,
  );
  // (chunk 가 없는 family 는 기다릴 것이 없다 — scene 이 설정 오류를 그린다, Canvas 와 같은 결과.)
  const familyReady =
    familyId === null ||
    getChartFamily(familyId) !== undefined ||
    !chartFamilyAvailable(familyId);
  const familyFailed =
    familyId !== null &&
    !familyReady &&
    chartFamilyError(familyId) !== undefined;
  React.useEffect(() => {
    if (familyId && !familyReady && !familyFailed)
      void loadChartFamily(familyId).catch(() => undefined);
  }, [familyId, familyReady, familyFailed]);
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
      // ADR-312 — 빈 글자는 「Series 해제」 (명시), 없음은 「기본 열 이름」 — 둘을 합치지 않는다.
      ...(color !== undefined ? { color } : {}),
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
      // ADR-216 — 시간축 3 키 (미설정은 싣지 않는다 — specs 가 category 로 읽는다).
      ...(dimensionScale !== undefined ? { dimensionScale } : {}),
      ...(dimensionFormat !== undefined ? { dimensionFormat } : {}),
      ...(dimensionLabelFormat !== undefined ? { dimensionLabelFormat } : {}),
      // ADR-217 — 기준선 (배열 identity 가 memo 키 — 편집기가 새 배열을 줄 때만 다시 푼다).
      ...(referenceLines !== undefined ? { referenceLines } : {}),
      // ADR-306 — family 역할 · 옵션 (미설정 키는 싣지 않는다).
      ...(JSON.parse(familyKey) as Partial<SpecChartProps>),
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
      valueFields,
      valueFieldsKey,
      seriesConfig,
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
      dimensionScale,
      dimensionFormat,
      dimensionLabelFormat,
      referenceLines,
      familyKey,
    ],
  );

  // metrics 해석은 두 consumer 공용 (resolveChartMetrics) — 각자 풀면 좌표가 갈린다.
  const { padding, paddingTop, paddingRight, paddingBottom, paddingLeft } =
    style ?? {};
  // 축 글자는 토큰 — 테마 · 기기 벌이 바꾸는 px 를 memo 키에 (rule 객체는 그대로라서).
  const axisFontSize = chartMetricFontSize(rule?.chart?.metrics?.fontSize);
  const metrics = React.useMemo(
    () =>
      resolveChartMetrics(rule?.chart, {
        padding,
        paddingTop,
        paddingRight,
        paddingBottom,
        paddingLeft,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- axisFontSize: 설치된 글자 맵이 바뀌면 다시 푼다
    [
      rule,
      axisFontSize,
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
      {...domRest}
      ref={ref}
      role="group"
      aria-label={label}
      className={
        className ? `react-aria-Chart ${className}` : "react-aria-Chart"
      }
      data-variant={variant}
      data-palette={palette && palette !== "categorical" ? palette : undefined}
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
      ) : familyFailed ? (
        <div role="alert">
          Chart failed to load
          <button
            type="button"
            onClick={() => {
              if (familyId)
                void loadChartFamily(familyId).catch(() => undefined);
            }}
          >
            Retry
          </button>
        </div>
      ) : !familyReady ? (
        <div role="status">Loading chart…</div>
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
              key={familyId ?? "series"}
              familyEpoch={familyEpoch}
              props={chartProps}
              rows={rows}
              size={chartSize}
              metrics={metrics}
              label={label}
              renderWindowTrack={renderChartWindowTrack}
            />
          </div>
        </React.Suspense>
      ) : null}
    </div>
  );
}

/** ADR-306 — family 역할 · 옵션을 `rest` 에서 떼어 낸다 (목록 하나 — R2). */
function splitFamilyProps(rest: Record<string, unknown>): {
  familyProps: Partial<SpecChartProps>;
  domRest: Record<string, unknown>;
} {
  const domRest: Record<string, unknown> = {};
  const keys = new Set<string>(CHART_FAMILY_PROP_KEYS);
  for (const [key, value] of Object.entries(rest))
    if (!keys.has(key)) domRest[key] = value;
  return { familyProps: pickChartFamilyProps(rest), domRest };
}
