import { useMemo, useSyncExternalStore, type ReactNode } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  RadarChart,
  Radar,
  RadialBarChart,
  RadialBar,
  XAxis,
  YAxis,
  PolarAngleAxis,
  PolarRadiusAxis,
  Cell,
  Tooltip,
  Customized,
  LabelList,
  Sector,
  Dot,
  type SectorProps,
  type LabelProps,
} from "recharts";
import {
  resolveChartData,
  resolveChartLayout,
  resolveChartAnimation,
  bandScale,
  linearScale,
  buildAxes,
  buildPolarAxes,
  buildLegend,
  angleScale,
  dotRadius,
  centerTotalLabels,
  approxTextWidth,
  polarLabelAnchor,
  formatTick,
  type ChartProps,
  type ChartRow,
  type ChartMetrics,
  type ChartSize,
  type AxisScene,
} from "@composition/specs";
import {
  legacyMonotoneHorizontal,
  legacyMonotoneVertical,
  legacyStepHorizontal,
  legacyStepVertical,
  legacyLinear,
} from "./legacyMonotone";
import { renderMark, renderText, seriesVar } from "./svgDecorations";

function NonEmptyRadialSector(props: SectorProps) {
  if (Math.abs(Number(props.endAngle) - Number(props.startAngle)) < 0.000001) return null;
  return <Sector {...props} />;
}

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (onChange: () => void) => {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const readMotion = () => window.matchMedia(motionQuery).matches;

/** 마크는 native Recharts가 계산한다. 공통 rows/domain/layout/장식 계약만 재사용한다. */
export function RechartsChart({
  props,
  rows,
  size,
  metrics,
  label,
}: {
  props: ChartProps;
  rows: readonly ChartRow[];
  size: ChartSize;
  metrics: ChartMetrics;
  label: string;
}) {
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    readMotion,
    () => true,
  );
  // postMessage가 같은 배열 내용을 재전송해도 Recharts의 animation identity를 유지한다.
  const rowsKey = useMemo(() => JSON.stringify(rows), [rows]);
  // ADR-210 — 배열 props 는 직렬화 키로 (Chart.tsx 가 이미 안정화하지만 이 경계도 같은 규칙).
  const valueFieldsKey = JSON.stringify(props.valueFields ?? null);
  const seriesConfigKey = JSON.stringify(props.seriesConfig ?? null);
  const model = useMemo(
    () => resolveChartData(rows, props, metrics.seriesCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      rowsKey,
      props.dimension,
      props.metric,
      props.color,
      props.chartType,
      props.stackType,
      props.colorBy,
      props.dataMode,
      valueFieldsKey,
      seriesConfigKey,
      props.valueFormat,
      props.valueLocale,
      props.valueFractionDigits,
      props.valueCurrency,
      props.valuePercentUnit,
      metrics.seriesCount,
    ],
  );
  const { grid, keys, bands, ticks, stackMode } = model;
  const layout = useMemo(
    () => resolveChartLayout(props, grid, size, metrics),
    [props, grid, size, metrics],
  );
  const { plot, fontSize, horizontal, legendBox, legendEntries, labelText } =
    layout;
  const animation = resolveChartAnimation(props);
  animation.isAnimationActive &&= !reducedMotion;
  const isBar = props.chartType === "bar";
  const radarFlatDomain = Math.max(0, ticks.domain[1]) === 0;
  const n = grid.categories.length;
  const isRange =
    (props.chartType === "area" || isBar || props.chartType === "radial") &&
    stackMode !== "none";
  const data = useMemo(
    () =>
      model.rows.map((row, ci) => ({
        ...row,
        position: ci + 0.5,
        ...Object.fromEntries(
          keys.flatMap((key, si) => {
            const range = bands[si].get(ci);
            const raw = grid.series[si].values.get(ci);
            return [
              [
                key,
                props.chartType === "radar"
                  ? raw === undefined ? 0 : radarFlatDomain ? 1 : Math.max(0, raw)
                  : raw === undefined
                    ? null
                    : isRange && range
                      ? [range.from, range.to]
                      : raw,
              ],
              [`label${si}`, raw === undefined ? "" : labelText(ci, raw)],
            ];
          }),
        ),
      })),
    [model, keys, bands, grid, isRange, props.chartType, labelText, radarFlatDomain],
  );
  return useMemo(() => {
  const band = bandScale(
    n,
    horizontal ? [plot.y, plot.y + plot.h] : [plot.x, plot.x + plot.w],
  );
  const value = linearScale(
    ticks.domain,
    horizontal ? [plot.x, plot.x + plot.w] : [plot.y + plot.h, plot.y],
  );
  const cx = plot.x + plot.w / 2,
    cy = plot.y + plot.h / 2;
  const polarRadius =
    Math.min(plot.w, plot.h) / 2 -
    (props.chartType === "radar" && props.showAxis
      ? fontSize * 2.2
      : fontSize * 0.5);
  const hole =
    (polarRadius * Math.min(90, Math.max(0, props.innerRadius))) / 100;
  const axes: AxisScene[] =
    props.chartType === "radar"
      ? buildPolarAxes({
          categories: grid.categories,
          angle: angleScale(n),
          center: { x: cx, y: cy, outer: polarRadius, inner: hole },
          ticks,
          gridType: props.gridType,
          fontSize,
          showAxis: props.showAxis,
          showGrid: props.showGrid,
          showSpokes: props.showSpokes,
          gridRings: props.gridRings,
          fillGrid: props.fillGrid,
        })
      : ["bar", "area", "line"].includes(props.chartType)
        ? buildAxes({
            categories: grid.categories,
            band,
            value,
            ticks,
            plot,
            orientation: props.orientation,
            fontSize,
            showAxis: props.showAxis,
            showGrid: props.showGrid,
          })
        : [];
  const legend = legendBox
    ? buildLegend({
        entries: legendEntries,
        box: legendBox,
        position: props.legendPosition,
        fontSize,
      })
    : null;
  const backdrop = (
    <Customized
      key="grid"
      component={() => (
        <g data-chart-grid="">
          {axes.flatMap((axis) =>
            axis.grid.map((mark, i) =>
              renderMark(mark, `grid-${axis.axis}-${i}`),
            ),
          )}
        </g>
      )}
    />
  );
  const foreground = (
    <Customized
      key="decoration"
      component={() => (
        <g data-chart-decoration="">
          {axes.flatMap((axis) => [
            axis.line && renderMark(axis.line, `axis-${axis.axis}`),
            ...axis.ticks.map((tick, i) =>
              renderText(tick, `tick-${axis.axis}-${i}`),
            ),
          ])}
          {legend?.items.map((item, i) => (
            <g key={i}>
              {renderMark(item.swatch, `swatch-${i}`)}
              {renderText(item.text, `legend-${i}`)}
            </g>
          ))}
        </g>
      )}
    />
  );
  const tooltip = props.showTooltip ? (
    <Tooltip
      key="tooltip"
      isAnimationActive={false}
      content={({ active, payload, label: tooltipLabel }) =>
        active && payload?.length ? (
          <div
            className="react-aria-Chart-tooltip"
            role="status"
            style={{
              background: "var(--chart-tooltip-bg, Canvas)",
              color: "var(--chart-tooltip-text, inherit)",
              border: "1px solid var(--chart-tooltip-border, currentColor)",
              borderRadius: 6,
              padding: "6px 8px",
              fontSize: 12,
            }}
          >
            <div>
              {String(payload[0]?.payload?.category ?? tooltipLabel ?? "")}
            </div>
            {payload.map((entry, i) => {
              const si = keys.indexOf(String(entry.dataKey));
              const ci = Number(entry.payload?.categoryIndex ?? 0);
              const raw =
                si >= 0 ? grid.series[si].values.get(ci) : entry.payload?.raw;
              return (
                <div
                  key={`${String(entry.dataKey)}-${i}`}
                  style={{ display: "flex", gap: 6 }}
                >
                  <span>{si >= 0 ? grid.series[si].key : entry.name}</span>
                  <span>{typeof raw === "number" ? formatTick(raw) : String(raw ?? "")}</span>
                </div>
              );
            })}
          </div>
        ) : null
      }
    />
  ) : null;
  const curve =
    props.curve === "monotone"
      ? horizontal
        ? legacyMonotoneHorizontal
        : legacyMonotoneVertical
      : props.curve === "step" ? horizontal ? legacyStepHorizontal : legacyStepVertical : legacyLinear;
  const pointLabel = (entry: LabelProps) => {
    if (entry.value == null || entry.value === "") return null;
    const box = entry.viewBox;
    if (!box || !("x" in box) || !("y" in box)) return null;
    const x = Number(box.x),
      y = Number(box.y);
    return (
      <text
        x={x + (horizontal ? 6 : 0)}
        y={y - (horizontal ? 0 : 6)}
        dominantBaseline={horizontal ? "central" : "alphabetic"}
        textAnchor={horizontal ? "start" : "middle"}
        fill="currentColor"
      >
        {entry.value}
      </text>
    );
  };
  const radarLabel = (entry: LabelProps) => {
    const box = entry.viewBox;
    if (!box || !("x" in box) || !("y" in box) || entry.value == null || entry.value === "") return null;
    const angle = angleScale(n)(entry.index ?? 0);
    const radians = (angle - 90) * Math.PI / 180;
    const { anchor, baseline } = polarLabelAnchor(angle);
    return renderText({kind: "text", x: Number(box.x) + Math.cos(radians) * fontSize * 0.4,
      y: Number(box.y) + Math.sin(radians) * fontSize * 0.4, text: String(entry.value),
      anchor, baseline, role: "value"}, `radar-label-${entry.index}`);
  };
  const pieLabel = (entry: LabelProps) => {
    const box = entry.viewBox;
    if (!box || !("cx" in box) || !("cy" in box) || entry.value == null || entry.value === "") return null;
    const outer = Number(box.outerRadius), inner = Number(box.innerRadius);
    const radius = inner > 0 ? (outer + inner) / 2 : outer * 0.62;
    const radians = -(Number(box.startAngle) + Number(box.endAngle)) / 2 * Math.PI / 180;
    return renderText({kind: "text", x: Number(box.cx) + radius * Math.cos(radians),
      y: Number(box.cy) + radius * Math.sin(radians), text: String(entry.value),
      anchor: "middle", baseline: "middle", role: "value"}, `pie-label-${entry.index}`);
  };
  const barLabel = (entry: LabelProps, seriesIndex: number) => {
    const box = entry.viewBox;
    if (
      !box ||
      !("x" in box) ||
      !("y" in box) ||
      !("width" in box) ||
      !("height" in box) ||
      entry.value == null ||
      entry.value === ""
    )
      return null;
    const x = Math.min(Number(box.x), Number(box.x) + Number(box.width)),
      y = Math.min(Number(box.y), Number(box.y) + Number(box.height)),
      w = Math.abs(Number(box.width)), h = Math.abs(Number(box.height));
    const positive = (grid.series[seriesIndex].values.get(entry.index ?? 0) ?? 0) >= 0;
    const text = String(entry.value);
    if (
      isRange &&
      (horizontal ? w < approxTextWidth(text, fontSize) : h < fontSize)
    )
      return null;
    return (
      <text
        x={isRange ? x + w / 2 : horizontal ? positive ? x + w + 3 : x - 3 : x + w / 2}
        y={isRange || horizontal ? y + h / 2 : positive ? y - 2 : y + h + 2}
        textAnchor={isRange || !horizontal ? "middle" : positive ? "start" : "end"}
        dominantBaseline={isRange || horizontal ? "central" : positive ? "alphabetic" : "hanging"}
        fill="currentColor"
      >
        {text}
      </text>
    );
  };
  const common = {
    ...size,
    accessibilityLayer: true,
    "aria-label": label,
    style: { fontSize, overflow: "visible" },
  };
  const margin = {
    left: plot.x,
    top: plot.y,
    right: size.width - plot.x - plot.w,
    bottom: size.height - plot.y - plot.h,
  };
  if (!grid.hasValues || !n || !keys.length || plot.w <= 0 || plot.h <= 0)
    return (
      <div
        role="status"
        style={{
          height: "100%",
          display: "grid",
          placeItems: "center",
          fontSize,
        }}
      >
        No data
      </div>
    );

  if (
    props.chartType === "bar" ||
    props.chartType === "line" ||
    props.chartType === "area"
  ) {
    const Parent = isBar
      ? BarChart
      : props.chartType === "line"
        ? LineChart
        : AreaChart;
    // Recharts는 한 점일 때 line/area 경로를 생략한다. 같은 좌표의 끝점을
    // 하나 더 전달해 기존 0길이 선/닫힌 baseline을 유지한다. row 집계에는 넣지 않는다.
    const cartesianData = !isBar && n === 1 ? [data[0], {...data[0], _chartEndpoint: true,
      ...Object.fromEntries(keys.map((_, si) => [`label${si}`, ""]))}] : data;
    return (
      <Parent
        {...common}
        data={cartesianData}
        margin={margin}
        layout={horizontal ? "vertical" : "horizontal"}
        barCategoryGap="10%"
        barGap={isRange ? -band.bandwidth : 0}
      >
        <XAxis
          hide
          type={horizontal ? "number" : isBar ? "category" : "number"}
          dataKey={horizontal ? undefined : isBar ? "category" : "position"}
          domain={horizontal ? [...ticks.domain] : [0, n]}
          allowDataOverflow
        />
        <YAxis
          hide
          type={horizontal && isBar ? "category" : "number"}
          dataKey={horizontal ? (isBar ? "category" : "position") : undefined}
          domain={horizontal ? [0, n] : [...ticks.domain]}
          allowDataOverflow
        />
        {backdrop}
        {keys.map((key, si) => {
          const paint = seriesVar(grid.series[si].seriesIndex);
          const labels = props.showValueLabels ? (
            <LabelList
              dataKey={`label${si}`}
              content={isBar ? (entry) => barLabel(entry, si) : pointLabel}
            />
          ) : null;
          if (isBar)
            return (
              <Bar
                key={key}
                dataKey={key}
                name={grid.series[si].key}
                fill={paint}
                barSize={isRange ? band.bandwidth : undefined}
                {...animation}
              >
                {data.map((_, ci) => (
                  <Cell
                    key={ci}
                    fill={seriesVar(
                      props.colorBy === "category"
                        ? ci % metrics.seriesCount
                        : grid.series[si].seriesIndex,
                    )}
                  />
                ))}
                {labels}
              </Bar>
            );
          const lineProps = {
            dataKey: key,
            name: grid.series[si].key,
            type: curve,
            stroke: paint,
            strokeWidth: metrics.strokeWidth,
            strokeLinecap: "round" as const,
            strokeLinejoin: "round" as const,
            dot: props.showDots ? (entry: {cx?: number; cy?: number; payload?: Record<string, unknown>}) =>
              entry.payload?._chartEndpoint ? <g /> : <Dot cx={entry.cx} cy={entry.cy} r={dotRadius(metrics.strokeWidth)}
                fill={paint} stroke="none" style={{stroke: "none"}} fillOpacity={0.85} /> : false,
            activeDot: props.showTooltip,
            connectNulls: false,
            ...animation,
          };
          return props.chartType === "area" ? (
            <Area key={key} {...lineProps} stroke="none" style={{stroke: paint}} fill={paint} fillOpacity={0.85}>
              {labels}
            </Area>
          ) : (
            <Line key={key} {...lineProps}>
              {labels}
            </Line>
          );
        })}
        {foreground}
        {tooltip}
      </Parent>
    );
  }
  if (props.chartType === "pie") {
    const outer = Math.min(plot.w, plot.h) / 2;
    const inner = (outer * Math.min(90, Math.max(0, props.innerRadius))) / 100;
    const count = stackMode === "none" ? 1 : keys.length;
    const ring = (outer - inner) / count;
    let total = 0;
    const pies: ReactNode[] = [];
    for (let si = 0; si < count; si++) {
      const slices = grid.categories.flatMap((category, ci) => {
        const raw = grid.series[si].values.get(ci);
        if (!raw) return [];
        total += Math.abs(raw);
        return [
          {
            category,
            categoryIndex: ci,
            raw,
            magnitude: Math.abs(raw),
            label: labelText(ci, raw),
          },
        ];
      });
      const ro = outer - si * ring,
        ri = count > 1 ? ro - ring + 2 : inner;
      if (ro <= ri) continue;
      pies.push(
        <Pie
          key={keys[si]}
          data={slices}
          dataKey="magnitude"
          nameKey="category"
          cx={cx}
          cy={cy}
          outerRadius={ro}
          innerRadius={ri}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          fillOpacity={0.85}
          {...animation}
        >
          {slices.map((slice) => (
            <Cell
              key={slice.categoryIndex}
              fill={seriesVar(slice.categoryIndex % metrics.seriesCount)}
            />
          ))}
          {props.showValueLabels && (
            <LabelList dataKey="label" content={pieLabel} />
          )}
        </Pie>,
      );
    }
    return (
      <PieChart {...common} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
        {pies}
        {foreground}
        {tooltip}
        {props.showTotal && (
          <Customized
            component={() => (
              <g>
                {centerTotalLabels(
                  cx,
                  cy,
                  count > 1 ? inner + 2 : inner,
                  total,
                  props.metric,
                  fontSize,
                ).map((mark, i) => renderText(mark, `total-${i}`))}
              </g>
            )}
          />
        )}
      </PieChart>
    );
  }
  if (props.chartType === "radar")
    return (
      <RadarChart
        {...common}
        data={data}
        cx={cx}
        cy={cy}
        innerRadius={hole}
        outerRadius={polarRadius}
        startAngle={90}
        endAngle={-270}
        margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
      >
        <PolarAngleAxis dataKey="category" tick={false} axisLine={false} />
        <PolarRadiusAxis
          domain={[Math.max(0, ticks.domain[0]), radarFlatDomain ? 1 : Math.max(0, ticks.domain[1])]}
          tick={false}
          axisLine={false}
        />
        {backdrop}
        {n >= 3 && keys.map((key, si) => (
          <Radar
            key={key}
            dataKey={key}
            name={grid.series[si].key}
            fill={
              props.fillArea ? seriesVar(grid.series[si].seriesIndex) : "none"
            }
            fillOpacity={0.85}
            stroke={seriesVar(grid.series[si].seriesIndex)}
            strokeWidth={metrics.strokeWidth}
            dot={
              props.showDots
                ? {
                    r: dotRadius(metrics.strokeWidth),
                    fill: seriesVar(grid.series[si].seriesIndex),
                    stroke: "none",
                  style: {stroke: "none"},
                  fillOpacity: 0.85,
                  }
                : false
            }
            {...animation}
          >
            {props.showValueLabels && (
              <LabelList dataKey={`label${si}`} content={radarLabel} />
            )}
          </Radar>
        ))}
        {foreground}
        {tooltip}
      </RadarChart>
    );
  const ringSpan = (polarRadius - hole) / n;
  const thickness = Math.max(1, ringSpan - 3);
  const gap = ringSpan - thickness;
  const shift = gap - Math.round(gap / 2);
  const start = Number.isFinite(props.startAngle) ? props.startAngle : 0;
  const rawSweep = props.endAngle - props.startAngle;
  const sweep = rawSweep > 0 && rawSweep < 360 ? rawSweep : 360;
  const d0 = Math.max(0, ticks.domain[0]),
    d1 = Math.max(d0, ticks.domain[1]);
  const clamp = (v: number) => Math.min(d1, Math.max(d0, v));
  const radialData = data.map((row, ci) => ({
    ...row,
    ...Object.fromEntries(
      keys.map((key, si) => {
        const range = bands[si].get(ci);
        return [key, range ? [clamp(range.from), clamp(range.to)] : [d0, d0]];
      }),
    ),
  }));
  const total = bands
    .flatMap((ranges) => Array.from(ranges.values()))
    .reduce(
      (sum, range) =>
        sum +
        (range.to > range.from && clamp(range.to) > clamp(range.from)
          ? range.to - range.from
          : 0),
      0,
    );
  return (
    <RadialBarChart
      {...common}
      data={radialData}
      cx={cx}
      cy={cy}
      innerRadius={hole + shift}
      outerRadius={polarRadius + shift}
      startAngle={90 - start}
      endAngle={90 - start - sweep}
      barGap={-thickness}
      barCategoryGap={0}
      margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
    >
      <PolarAngleAxis
        type="number"
        domain={[d0, d1]}
        tick={false}
        axisLine={false}
      />
      <PolarRadiusAxis
        type="category"
        dataKey="category"
        reversed
        tick={false}
        axisLine={false}
      />
      {keys.map((key, si) => (
        <RadialBar
          key={key}
          dataKey={key}
          name={grid.series[si].key}
          shape={<NonEmptyRadialSector />}
          barSize={thickness}
          fillOpacity={0.85}
          stroke="none"
          background={
            si === 0
              ? { fill: "var(--chart-grid, currentColor)", fillOpacity: 0.35 }
              : false
          }
          {...animation}
        >
          {data.map((_, ci) => (
            <Cell
              key={ci}
              fill={seriesVar(
                keys.length === 1
                  ? ci % metrics.seriesCount
                  : grid.series[si].seriesIndex,
              )}
            />
          ))}
          {props.showValueLabels && (
            <LabelList dataKey={`label${si}`} content={(entry) => {
              const ci = entry.index ?? 0, range = bands[si].get(ci);
              const box = entry.viewBox;
              if (!range || clamp(range.to) <= clamp(range.from) || !box || !("cx" in box)) return null;
              return renderText({kind: "text", x: Number(box.cx),
                y: Number(box.cy) - (Number(box.outerRadius) + Number(box.innerRadius)) / 2 + fontSize * 0.35,
                text: labelText(ci, range.to - range.from), anchor: "middle", baseline: "middle", role: "value"}, `radial-label-${ci}`);
            }} />
          )}
        </RadialBar>
      ))}
      {foreground}
      {tooltip}
      {props.showTotal && (
        <Customized
          component={() => (
            <g>
              {centerTotalLabels(
                cx,
                cy,
                hole,
                total,
                props.metric,
                fontSize,
              ).map((mark, i) => renderText(mark, `total-${i}`))}
            </g>
          )}
        />
      )}
    </RadialBarChart>
  );
  }, [props, data, grid, keys, bands, ticks, stackMode, layout, metrics, size, label, reducedMotion]);
}
