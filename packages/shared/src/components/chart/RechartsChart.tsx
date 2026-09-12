import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
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
  Rectangle,
  Dot,
  type SectorProps,
  type LabelProps,
} from "recharts";
import {
  categoryColorIndex,
  buildReferenceLineMarks,
  clampWindowRange,
  resolveChartData,
  resolveChartAnimation,
  resolveCategoryBand,
  linearScale,
  buildAxes,
  buildPolarAxes,
  buildLegend,
  angleScale,
  dotRadius,
  centerTotalLabels,
  approxTextWidth,
  polarLabelAnchor,
  seriesLabel,
  CHART_INVALID_SETTINGS_TEXT,
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
import type { RenderChartWindowTrack } from "./windowTrack";

/**
 * 막대 하나 = `<path>` 하나 (ADR-210 P4). Recharts 기본 `Rectangle` 은 막대마다 ref 5개 · state ·
 * mount effect 의 `getTotalLength()` (강제 layout) · animationId 를 든다 — W800 에서 800번이라
 * static p95 가 100ms 를 넘겼다. 기하는 `getRectanglePath` 의 radius 0 분기와 같다.
 */
function PlainBarShape(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  radius?: number | readonly number[];
  fill?: string;
  fillOpacity?: number | string;
  stroke?: string;
  strokeWidth?: number | string;
}) {
  const {
    x,
    y,
    width,
    height,
    radius,
    fill,
    fillOpacity,
    stroke,
    strokeWidth,
  } = props;
  // 모서리 radius 채널이 열리면 (catalog 미도입) 기하는 Recharts 기본에 맡긴다 — 여기서 조용히
  //   버리면 DOM leg 만 각진 막대가 돼 Skia 와 갈린다.
  if (
    radius &&
    (typeof radius === "number" ? radius > 0 : radius.some((r) => r > 0))
  )
    return <Rectangle {...(props as object)} />;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(x + y + width + height) ||
    width === 0 ||
    height === 0
  )
    return null;
  return (
    <path
      className="recharts-rectangle"
      d={`M ${x},${y} h ${width} v ${height} h ${-width} Z`}
      fill={fill}
      fillOpacity={fillOpacity}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

function NonEmptyRadialSector(props: SectorProps) {
  if (Math.abs(Number(props.endAngle) - Number(props.startAngle)) < 0.000001)
    return null;
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
  renderWindowTrack,
}: {
  props: ChartProps;
  rows: readonly ChartRow[];
  size: ChartSize;
  metrics: ChartMetrics;
  label: string;
  /**
   * ADR-211 창 트랙 — `Chart.tsx` 가 shared Slider 를 initial 번들에서 넘긴다 (`windowTrack.tsx`).
   * 필수: 이 청크가 Slider 를 직접 import 하면 청크 분리 (P4 번들 +2.5 KiB) 가 되돌아온다.
   */
  renderWindowTrack: RenderChartWindowTrack;
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
  // ADR-211 — 창 시작 `start` 는 **저장하지 않는 뷰 상태** (canonical write 0, breakdown §2.5).
  //   데이터 identity · 차트 종류 · dataMode · overflow 가 바뀌면 0 으로 reset — 결정적 문자열 키로
  //   판정한다 (memo 참조 동일성은 성능 힌트지 의미 보증이 아니다). `size` 만 바뀌면 모델의 clamp
  //   (`clampWindowStart`) 가 자리를 맞춘다.
  const resetKey = `${props.chartType}|${props.dataMode ?? ""}|${props.budgetOverflow ?? ""}|${rowsKey}`;
  //   ADR-216: `[start, end]` — end 는 뷰 상태 (미지정 = start + fitEff, 211 과 같은 창); 최소 창·
  //   resize 는 모델의 `clampWindowRange` 가 맞춘다.
  const [windowState, setWindowState] = useState<{
    key: string;
    start: number;
    end?: number;
  }>({ key: resetKey, start: 0 });
  const windowLive = windowState.key === resetKey;
  const windowStart = windowLive ? windowState.start : 0;
  const windowEnd = windowLive ? windowState.end : undefined;
  // ADR-211 — Canvas 와 같은 `resolveChartModel` 경로: 행 상한 `R` · 슬롯 예산 `fit` · 창을
  //   같은 입력 (`size` · metrics) 으로 푼다. 창 `start` 만 두 leg 가 갈린다 (Canvas 0).
  //   `props` 는 Chart.tsx 가 memo 로 안정화한 객체라 값이 같으면 identity 도 같다.
  const model = useMemo(
    () =>
      resolveChartData(rows, props, metrics.seriesCount, {
        size,
        metrics,
        windowStart,
        windowEnd,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      rowsKey,
      props,
      valueFieldsKey,
      seriesConfigKey,
      size,
      metrics,
      windowStart,
      windowEnd,
    ],
  );
  const { grid, keys, bands, ticks, stackMode, presentation } = model;
  // ADR-210/211 — layout 은 모델이 input 격자로 이미 풀었다 (Canvas 와 같은 입력). 다시 풀면
  //   visible 격자의 가장 긴 라벨로 축 여백이 달라져 두 leg 의 `plot` 이 갈린다.
  const layout = model.layout;
  const {
    plot,
    fontSize,
    horizontal,
    legendBox,
    legendEntries,
    labelText,
    tickText,
    formatValue,
  } = layout;
  const animation = resolveChartAnimation(props);
  animation.isAnimationActive &&= !reducedMotion;
  // ADR-217 — 기준선 마크 (scene 과 같은 `buildReferenceLineMarks` · 같은 값 스케일). `back` 은
  //   backdrop Customized 에, `front` 는 Recharts svg 위 overlay svg 에 — pinned 3.10.1 은 Customized
  //   를 자식 순서와 무관하게 그래픽 항목보다 먼저 렌더한다 (P0 spike).
  const reference = useMemo(() => {
    if (
      presentation.referenceLines.length === 0 ||
      !["bar", "line", "area"].includes(props.chartType)
    )
      return null;
    const value = linearScale(
      ticks.domain,
      horizontal ? [plot.x, plot.x + plot.w] : [plot.y + plot.h, plot.y],
    );
    return buildReferenceLineMarks({
      lines: presentation.referenceLines,
      value,
      plot,
      orientation: props.orientation,
      fontSize,
    });
  }, [
    presentation.referenceLines,
    props.chartType,
    props.orientation,
    ticks.domain,
    horizontal,
    plot,
    fontSize,
  ]);
  const isBar = props.chartType === "bar";
  const radarFlatDomain = Math.max(0, ticks.domain[1]) === 0;
  const n = grid.categories.length;
  const isRange =
    (props.chartType === "area" || isBar || props.chartType === "radial") &&
    stackMode !== "none";
  // ADR-216 — 시간 스케일이면 `position` 은 epoch (scene 의 x 와 같은 domain 위), 아니면 슬롯 중앙.
  const positions = model.time ? grid.positions : undefined;
  const data = useMemo(
    () =>
      model.rows.map((row, ci) => ({
        ...row,
        position: positions ? positions[ci] : ci + 0.5,
        ...Object.fromEntries(
          keys.flatMap((key, si) => {
            const range = bands[si].get(ci);
            const raw = grid.series[si].values.get(ci);
            return [
              [
                key,
                props.chartType === "radar"
                  ? raw === undefined
                    ? 0
                    : radarFlatDomain
                      ? 1
                      : Math.max(0, raw)
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
    [
      model,
      keys,
      bands,
      grid,
      isRange,
      props.chartType,
      labelText,
      radarFlatDomain,
      positions,
    ],
  );
  const chart = useMemo(() => {
    // 설정 오류 (ADR-210) 는 데이터 유무보다 먼저다 — Canvas 의 `CHART_INVALID_SETTINGS_TEXT`
    //   scene 과 같은 뜻. rows 는 그대로라 데이터는 보존된다.
    if (!presentation.ok)
      return (
        <div
          role="status"
          data-chart-diagnostics={presentation.diagnostics
            .map((diagnostic) => diagnostic.code)
            .join(" ")}
          style={{
            height: "100%",
            display: "grid",
            placeItems: "center",
            fontSize,
          }}
        >
          {CHART_INVALID_SETTINGS_TEXT}
        </div>
      );
    // ADR-216 — scene 과 같은 helper: 시간 모델이 있으면 epoch band + 시간 축 입력.
    const { band, timeAxis } = resolveCategoryBand(
      model.time,
      grid,
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
              tickText,
              ...(timeAxis ? { time: timeAxis } : {}),
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
            {reference?.back.map((mark, i) =>
              mark.kind === "text"
                ? renderText(mark, `reference-back-${i}`)
                : renderMark(mark, `reference-back-${i}`),
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
                    <span>
                      {si >= 0
                        ? seriesLabel(grid.series[si], "series")
                        : entry.name}
                    </span>
                    <span>
                      {typeof raw === "number"
                        ? formatValue(raw)
                        : String(raw ?? "")}
                    </span>
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
        : props.curve === "step"
          ? horizontal
            ? legacyStepHorizontal
            : legacyStepVertical
          : legacyLinear;
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
      if (
        !box ||
        !("x" in box) ||
        !("y" in box) ||
        entry.value == null ||
        entry.value === ""
      )
        return null;
      const angle = angleScale(n)(entry.index ?? 0);
      const radians = ((angle - 90) * Math.PI) / 180;
      const { anchor, baseline } = polarLabelAnchor(angle);
      return renderText(
        {
          kind: "text",
          x: Number(box.x) + Math.cos(radians) * fontSize * 0.4,
          y: Number(box.y) + Math.sin(radians) * fontSize * 0.4,
          text: String(entry.value),
          anchor,
          baseline,
          role: "value",
        },
        `radar-label-${entry.index}`,
      );
    };
    const pieLabel = (entry: LabelProps) => {
      const box = entry.viewBox;
      if (
        !box ||
        !("cx" in box) ||
        !("cy" in box) ||
        entry.value == null ||
        entry.value === ""
      )
        return null;
      const outer = Number(box.outerRadius),
        inner = Number(box.innerRadius);
      const radius = inner > 0 ? (outer + inner) / 2 : outer * 0.62;
      const radians =
        ((-(Number(box.startAngle) + Number(box.endAngle)) / 2) * Math.PI) /
        180;
      return renderText(
        {
          kind: "text",
          x: Number(box.cx) + radius * Math.cos(radians),
          y: Number(box.cy) + radius * Math.sin(radians),
          text: String(entry.value),
          anchor: "middle",
          baseline: "middle",
          role: "value",
        },
        `pie-label-${entry.index}`,
      );
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
        w = Math.abs(Number(box.width)),
        h = Math.abs(Number(box.height));
      const positive =
        (grid.series[seriesIndex].values.get(entry.index ?? 0) ?? 0) >= 0;
      const text = String(entry.value);
      if (
        isRange &&
        (horizontal ? w < approxTextWidth(text, fontSize) : h < fontSize)
      )
        return null;
      return (
        <text
          x={
            isRange
              ? x + w / 2
              : horizontal
                ? positive
                  ? x + w + 3
                  : x - 3
                : x + w / 2
          }
          y={isRange || horizontal ? y + h / 2 : positive ? y - 2 : y + h + 2}
          textAnchor={
            isRange || !horizontal ? "middle" : positive ? "start" : "end"
          }
          dominantBaseline={
            isRange || horizontal
              ? "central"
              : positive
                ? "alphabetic"
                : "hanging"
          }
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
    // ADR-216 — 범주 축 domain: 시간이면 scene 과 같은 nice epoch domain, 아니면 슬롯 [0, n].
    const positionDomain: [number, number] = model.time
      ? [...model.time.domain]
      : [0, n];
    // ADR-211 — `fitEff = 0` (플롯이 한 슬롯보다 좁다): Canvas scene 과 같이 마크·축 0 인 빈
    //   상자 + 진단만. "No data" 가 아니다 — 데이터는 있다 (`budget.plotTooSmall`).
    if (!n && model.input.categories.length > 0)
      return (
        <div
          role="status"
          data-chart-diagnostics={model.diagnostics
            .map((diagnostic) => diagnostic.code)
            .join(" ")}
          style={{ height: "100%" }}
        />
      );
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
      const cartesianData =
        !isBar && n === 1
          ? [
              data[0],
              {
                ...data[0],
                _chartEndpoint: true,
                ...Object.fromEntries(keys.map((_, si) => [`label${si}`, ""])),
              },
            ]
          : data;
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
            domain={horizontal ? [...ticks.domain] : positionDomain}
            allowDataOverflow
          />
          <YAxis
            hide
            type={horizontal && isBar ? "category" : "number"}
            dataKey={horizontal ? (isBar ? "category" : "position") : undefined}
            domain={horizontal ? positionDomain : [...ticks.domain]}
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
                  name={seriesLabel(grid.series[si], "series")}
                  fill={paint}
                  barSize={isRange ? band.bandwidth : undefined}
                  shape={PlainBarShape}
                  {...animation}
                >
                  {/* 범주별 색일 때만 셀마다 Cell — 시리즈 색이면 Bar 의 fill 하나로 충분하다.
                    W800 에서 Cell 800개는 React 요소·props 병합 비용만 더한다 (ADR-210 P4). */}
                  {props.colorBy === "category"
                    ? data.map((_, ci) => (
                        <Cell
                          key={ci}
                          fill={seriesVar(
                            categoryColorIndex(
                              ci,
                              metrics.seriesCount,
                              grid.othersIndex,
                            ),
                          )}
                        />
                      ))
                    : null}
                  {labels}
                </Bar>
              );
            const lineProps = {
              dataKey: key,
              name: seriesLabel(grid.series[si], "series"),
              type: curve,
              stroke: paint,
              strokeWidth: metrics.strokeWidth,
              strokeLinecap: "round" as const,
              strokeLinejoin: "round" as const,
              dot: props.showDots
                ? (entry: {
                    cx?: number;
                    cy?: number;
                    payload?: Record<string, unknown>;
                  }) =>
                    entry.payload?._chartEndpoint ? (
                      <g />
                    ) : (
                      <Dot
                        cx={entry.cx}
                        cy={entry.cy}
                        r={dotRadius(metrics.strokeWidth)}
                        fill={paint}
                        stroke="none"
                        style={{ stroke: "none" }}
                        fillOpacity={0.85}
                      />
                    )
                : false,
              activeDot: props.showTooltip,
              connectNulls: false,
              ...animation,
            };
            return props.chartType === "area" ? (
              <Area
                key={key}
                {...lineProps}
                stroke="none"
                style={{ stroke: paint }}
                fill={paint}
                fillOpacity={0.85}
              >
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
      const inner =
        (outer * Math.min(90, Math.max(0, props.innerRadius))) / 100;
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
                fill={seriesVar(
                  categoryColorIndex(
                    slice.categoryIndex,
                    metrics.seriesCount,
                    grid.othersIndex,
                  ),
                )}
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
                    formatValue,
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
            domain={[
              Math.max(0, ticks.domain[0]),
              radarFlatDomain ? 1 : Math.max(0, ticks.domain[1]),
            ]}
            tick={false}
            axisLine={false}
          />
          {backdrop}
          {n >= 3 &&
            keys.map((key, si) => (
              <Radar
                key={key}
                dataKey={key}
                name={seriesLabel(grid.series[si], "series")}
                fill={
                  props.fillArea
                    ? seriesVar(grid.series[si].seriesIndex)
                    : "none"
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
                        style: { stroke: "none" },
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
            name={seriesLabel(grid.series[si], "series")}
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
                    ? categoryColorIndex(
                        ci,
                        metrics.seriesCount,
                        grid.othersIndex,
                      )
                    : grid.series[si].seriesIndex,
                )}
              />
            ))}
            {props.showValueLabels && (
              <LabelList
                dataKey={`label${si}`}
                content={(entry) => {
                  const ci = entry.index ?? 0,
                    range = bands[si].get(ci);
                  const box = entry.viewBox;
                  if (
                    !range ||
                    clamp(range.to) <= clamp(range.from) ||
                    !box ||
                    !("cx" in box)
                  )
                    return null;
                  return renderText(
                    {
                      kind: "text",
                      x: Number(box.cx),
                      y:
                        Number(box.cy) -
                        (Number(box.outerRadius) + Number(box.innerRadius)) /
                          2 +
                        fontSize * 0.35,
                      text: labelText(ci, range.to - range.from),
                      anchor: "middle",
                      baseline: "middle",
                      role: "value",
                    },
                    `radial-label-${ci}`,
                  );
                }}
              />
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
                  formatValue,
                ).map((mark, i) => renderText(mark, `total-${i}`))}
              </g>
            )}
          />
        )}
      </RadialBarChart>
    );
  }, [
    props,
    data,
    grid,
    keys,
    bands,
    ticks,
    stackMode,
    presentation,
    layout,
    metrics,
    size,
    label,
    reducedMotion,
  ]);
  // ADR-211 창 트랙 — layout 이 예약한 자리 (플롯 아래) 에 뷰 상태 Slider (`windowTrack.tsx`).
  //   ADR-216: thumb 2 — 손잡이 = 한쪽 경계, 본체 드래그 = 길이 보존 이동. clamp 는 모델과 같은 함수.
  const track = model.layout.windowTrack;
  const win = model.budget.window;
  const total = model.budget.n;
  const fitEff = model.budget.fitEff;
  // ADR-217 — `front` 기준선 overlay (Recharts svg 의 형제, 같은 좌표계, 입력 차단 0).
  const front =
    presentation.ok && reference && reference.front.length > 0 ? (
      <svg
        className="chart-decoration-front"
        data-chart-reference-front=""
        aria-hidden="true"
        width={size.width}
        height={size.height}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          pointerEvents: "none",
          overflow: "visible",
        }}
      >
        {reference.front.map((mark, i) =>
          mark.kind === "text"
            ? renderText(mark, `reference-front-${i}`)
            : renderMark(mark, `reference-front-${i}`),
        )}
      </svg>
    ) : null;
  if (!track || !win || total <= fitEff || !presentation.ok)
    return front ? (
      <>
        {chart}
        {front}
      </>
    ) : (
      chart
    );
  return (
    <>
      {chart}
      {front}
      {renderWindowTrack({
        track,
        start: win.start,
        end: win.end,
        n: total,
        onChange: (start, end) => {
          const next = clampWindowRange(start, end, total, fitEff);
          setWindowState({ key: resetKey, start: next.start, end: next.end });
        },
      })}
    </>
  );
}
