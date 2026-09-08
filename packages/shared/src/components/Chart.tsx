/**
 * Chart — ADR-194 의 DOM consumer.
 *
 * 기하는 이 파일에 없다. `computeChartScene`(@composition/specs) 이 낸 좌표를 SVG
 * 엘리먼트로 옮기기만 한다 — Skia consumer(`chart_scene` primitive)도 같은 scene 의
 * 같은 숫자를 옮긴다. "CSS 가 기준" 도 "Skia 가 기준" 도 아니고 기하 함수가 기준이다.
 *
 * 색은 scene 에 실린 **인덱스** 를 여기서 `var(--chart-series-N)` 으로 푼다 (팔레트는
 * `COMPONENT_RULES_TABLE.Chart.chart` → generate-css 가 `.react-aria-Chart` 에 emit).
 * hex 를 scene 에 싣지 않으므로 dark 전환 시 CSS 가 알아서 단계를 바꾼다.
 *
 * D1: internal source `<div role="img">` (RAC 에 chart primitive 없음 — ARIA 는
 *     binding.staticAttrs 가 부여). D2: RSC prop 명. D3: catalog rule.
 */

import React from "react";
import {
  CHART_DEFAULT_PROPS,
  CHART_SAMPLE_ROWS,
  computeChartScene,
  hitTooltipBand,
  resolveChartMetrics,
} from "@composition/specs";
import type {
  ChartColorBy,
  ChartCurve,
  ChartLegendPosition,
  ChartOrientation,
  ChartRow,
  ChartScene,
  ChartStackType,
  ChartType,
  ChartLabelKey,
  Mark,
  PolarGridType,
  TextMark,
  TooltipBand,
} from "@composition/specs";
import { resolveComponentRule } from "../catalog/resolvers/resolveComponentRule";
import { useCollectionData } from "../hooks";
import type { DataBinding } from "../types";

export interface ChartProps {
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
  variant?: string;
  size?: "sm" | "md" | "lg";
  /** 샘플/정적 rows — dataBinding 이 없거나 0행일 때의 입력 */
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

/** scene 의 series 인덱스 → CSS 변수. 1-based (shadcn `--chart-1..N` 관례). */
export function seriesVar(index: number): string {
  return `var(--chart-series-${index + 1}, currentColor)`;
}

const ROLE_FILL: Record<TextMark["role"], string> = {
  tick: "var(--chart-axis, currentColor)",
  legend: "currentColor",
  empty: "var(--chart-axis, currentColor)",
  // 값 레이블은 데이터를 읽는 글자다 — 축 보조색이 아니라 본문 전경색.
  value: "currentColor",
};

const ANCHOR_MAP = {
  start: "start",
  middle: "middle",
  end: "end",
} as const;

const BASELINE_MAP = {
  top: "hanging",
  middle: "central",
  bottom: "alphabetic",
} as const;

function renderText(mark: TextMark, key: string): React.ReactElement {
  return (
    <text
      key={key}
      x={mark.x}
      y={mark.y}
      textAnchor={ANCHOR_MAP[mark.anchor]}
      dominantBaseline={BASELINE_MAP[mark.baseline]}
      fill={ROLE_FILL[mark.role]}
      // fontScale 은 부모 svg 의 font-size 기준 배율 — em 이라야 Skia 의
      //   metrics.fontSize 곱과 같은 값이 된다.
      fontSize={mark.fontScale ? `${mark.fontScale}em` : "inherit"}
    >
      {mark.text}
    </text>
  );
}

function renderMark(mark: Mark, key: string): React.ReactElement | null {
  switch (mark.kind) {
    case "rect":
      return (
        <rect
          key={key}
          x={mark.x}
          y={mark.y}
          width={mark.w}
          height={mark.h}
          fill={seriesVar(mark.seriesIndex)}
        />
      );
    case "path":
      return (
        <path
          key={key}
          d={mark.d}
          fill={
            // 축 토큰 채우기 (ADR-207 radial 트랙) — Skia 의 fillRole 분기와 같은 규약.
            mark.fillRole !== undefined
              ? mark.fillRole === "grid"
                ? "var(--chart-grid, currentColor)"
                : "var(--chart-axis, currentColor)"
              : mark.fillSeries !== undefined
                ? seriesVar(mark.fillSeries)
                : "none"
          }
          fillOpacity={
            mark.fillRole !== undefined
              ? 0.35
              : mark.fillSeries !== undefined
                ? 0.85
                : undefined
          }
          fillRule={mark.fillRule}
          stroke={
            // 격자·축 path (ADR-207 극좌표) 는 축 토큰 — Skia 쪽 `pushMark` 와 같은 규약.
            mark.role !== undefined
              ? mark.role === "grid"
                ? "var(--chart-grid, currentColor)"
                : "var(--chart-axis, currentColor)"
              : mark.strokeSeries !== undefined
                ? seriesVar(mark.strokeSeries)
                : "none"
          }
          strokeWidth={
            mark.role !== undefined
              ? (mark.strokeWidth ?? 1)
              : mark.strokeWidth
          }
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    case "line":
      return (
        <line
          key={key}
          x1={mark.x1}
          y1={mark.y1}
          x2={mark.x2}
          y2={mark.y2}
          stroke={
            mark.role === "grid"
              ? "var(--chart-grid, currentColor)"
              : "var(--chart-axis, currentColor)"
          }
          strokeWidth={1}
        />
      );
    case "text":
      return renderText(mark, key);
    default:
      return null;
  }
}

/** scene → SVG 자식 목록. Skia primitive 와 **같은 순서** 로 그린다 (겹침 순서 대칭). */
export function renderChartScene(scene: ChartScene): React.ReactElement[] {
  const nodes: React.ReactElement[] = [];

  for (const axis of scene.axes) {
    axis.grid.forEach((line, i) => {
      const node = renderMark(line, `grid-${axis.axis}-${i}`);
      if (node) nodes.push(node);
    });
  }
  scene.marks.forEach((mark, i) => {
    const node = renderMark(mark, `mark-${i}`);
    if (node) nodes.push(node);
  });
  for (const axis of scene.axes) {
    if (axis.line) {
      const node = renderMark(axis.line, `axis-${axis.axis}`);
      if (node) nodes.push(node);
    }
    axis.ticks.forEach((tick, i) => {
      nodes.push(renderText(tick, `tick-${axis.axis}-${i}`));
    });
  }
  if (scene.legend) {
    scene.legend.items.forEach((item, i) => {
      const swatch = renderMark(item.swatch, `legend-swatch-${i}`);
      if (swatch) nodes.push(swatch);
      nodes.push(renderText(item.text, `legend-text-${i}`));
    });
  }

  return nodes;
}

/**
 * 컨테이너 실측 크기. scene 은 **실제 박스 크기** 위에 그려져야 Skia(엔진 layout 이
 * 준 w/h) 와 같은 좌표가 나온다 — 고정 viewBox 로 늘리면 텍스트만 왜곡돼 비대칭이 된다.
 */
function useBoxSize(
  ref: React.RefObject<HTMLDivElement | null>,
  fallback: { width: number; height: number },
): { width: number; height: number } {
  const [size, setSize] = React.useState(fallback);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = (): void => {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize((prev) =>
          prev.width === rect.width && prev.height === rect.height
            ? prev
            : { width: rect.width, height: rect.height },
        );
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

const FALLBACK_WIDTH = 320;

export function Chart({
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
  const ruleHeight = rule?.sizes?.[sizeKey]?.height;
  const fallbackHeight =
    typeof ruleHeight === "number" && ruleHeight > 0 ? ruleHeight : 240;
  const box = useBoxSize(ref, {
    width: FALLBACK_WIDTH,
    height: fallbackHeight,
  });

  const chartProps = React.useMemo(
    () => ({
      chartType: chartType ?? CHART_DEFAULT_PROPS.chartType,
      dimension: dimension ?? CHART_DEFAULT_PROPS.dimension,
      metric: metric ?? CHART_DEFAULT_PROPS.metric,
      ...(color ? { color } : {}),
      orientation: orientation ?? CHART_DEFAULT_PROPS.orientation,
      stackType: stackType ?? CHART_DEFAULT_PROPS.stackType,
      curve: curve ?? CHART_DEFAULT_PROPS.curve,
      showDots: showDots ?? CHART_DEFAULT_PROPS.showDots,
      showValueLabels:
        showValueLabels ?? CHART_DEFAULT_PROPS.showValueLabels,
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
    }),
    [
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
    ],
  );

  // metrics 해석은 두 consumer 공용 (resolveChartMetrics) — 각자 풀면 좌표가 갈린다.
  const metrics = React.useMemo(
    () => resolveChartMetrics(rule?.chart, sizeKey),
    [rule, sizeKey],
  );

  // 바인딩 행. provider 가 없거나(builder 밖) 아직 0행이면 샘플로 떨어진다 — 팔레트에서
  //   갓 놓은 차트가 빈 상자로 보이지 않게 하는 같은 규칙 (Skia leg 의 _chartRows 동형).
  const { data: boundRows } = useCollectionData({
    dataBinding: dataBinding as DataBinding,
    componentName: "Chart",
    fallbackData: [],
    elementId: rest["data-element-id"] as string | undefined,
  });

  const rows = React.useMemo<readonly ChartRow[]>(() => {
    const source =
      boundRows && boundRows.length > 0 ? boundRows : (data ?? []);
    return source.length > CHART_SAMPLE_ROWS
      ? source.slice(0, CHART_SAMPLE_ROWS)
      : source;
  }, [boundRows, data]);

  const scene = React.useMemo(
    () => computeChartScene(chartProps, rows, box, metrics),
    [chartProps, rows, box, metrics],
  );

  // hover 는 D1 상호작용 — Preview/Publish(DOM) 만 가진다. Builder 의 Skia 는
  //   같은 scene 을 정적으로 그린다 (scene.tooltip 을 읽지 않는다).
  const [hover, setHover] = React.useState<{
    band: TooltipBand;
    x: number;
    y: number;
  } | null>(null);
  const hasTooltip = scene.tooltip !== null;

  const handleMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      const node = ref.current;
      if (!node || !scene.tooltip) return;
      const rect = node.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      // 히트 판정은 기하가 한다 — DOM 이 밴드 폭을 다시 계산하면 마크와 어긋난다.
      const band = hitTooltipBand(scene.tooltip, x, y);
      setHover((prev) => {
        if (!band) return prev === null ? prev : null;
        return prev &&
          prev.band.categoryIndex === band.categoryIndex &&
          prev.x === x &&
          prev.y === y
          ? prev
          : { band, x, y };
      });
    },
    [scene.tooltip],
  );

  const handleLeave = React.useCallback((): void => setHover(null), []);

  React.useEffect(() => {
    if (!hasTooltip) setHover(null);
  }, [hasTooltip]);

  const cursorBand = hover?.band.rect;
  // 툴팁이 컨테이너 밖으로 나가지 않게 접는다 (오른쪽·아래 가장자리).
  const tooltipLeft = hover
    ? Math.min(hover.x + 12, Math.max(0, box.width - 140))
    : 0;
  const tooltipTop = hover ? Math.max(0, hover.y - 12) : 0;

  return (
    <div
      {...rest}
      ref={ref}
      role="img"
      aria-label={ariaLabel ?? "chart"}
      // internal source wrapper 는 **자기 root class 를 자기가 합성한다** (Badge/Icon/ListBox …
      //   전수 동일 규약 — CanonicalNodeRenderer 는 사용자 class 만 넘긴다). 빠뜨리면 생성
      //   CSS(.react-aria-Chart)가 통째로 미매칭이라 배경·테두리·팔레트 변수가 DOM 에 안 닿고
      //   Skia(rule 직독) 와 발산한다 — 2026-09-08 live 에서 클래스 없는 div 로 확인.
      className={
        className ? `react-aria-Chart ${className}` : "react-aria-Chart"
      }
      // variant/size 는 binding 의 propPassthrough 로 **React prop** 으로 온다 (차트 기하의
      //   입력이라 그렇게 뒀다). 그래서 generic data-attr 라우팅이 없고, 생성 CSS 의
      //   `[data-variant]`/`[data-size]` 선택자를 여기서 직접 채워야 매칭된다.
      data-variant={variant}
      data-size={size}
      style={hasTooltip ? { position: "relative", ...style } : style}
      onPointerMove={hasTooltip ? handleMove : undefined}
      onPointerLeave={hasTooltip ? handleLeave : undefined}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${scene.size.width} ${scene.size.height}`}
        // 폰트 크기는 scene 이 여백을 계산할 때 쓴 숫자와 **같아야** 한다.
        //   CSS 상속(font-size: var(--text-sm) = 14)에 맡기면 레이블이 확보된
        //   자리보다 커져 축과 겹친다 — Skia 는 metrics 숫자로 그리므로 비대칭.
        style={{ display: "block", overflow: "visible", fontSize: metrics.fontSize }}
        aria-hidden="true"
        focusable="false"
      >
        {cursorBand ? (
          <rect
            x={cursorBand.x}
            y={cursorBand.y}
            width={cursorBand.w}
            height={cursorBand.h}
            fill="var(--chart-grid, currentColor)"
            fillOpacity={0.18}
          />
        ) : null}
        {renderChartScene(scene)}
      </svg>
      {hover ? (
        <div
          className="react-aria-Chart-tooltip"
          aria-hidden="true"
          style={{
            position: "absolute",
            left: tooltipLeft,
            top: tooltipTop,
            pointerEvents: "none",
            background: "var(--chart-tooltip-bg, Canvas)",
            border: "1px solid var(--chart-tooltip-border, currentColor)",
            color: "var(--chart-tooltip-text, inherit)",
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: 12,
            lineHeight: 1.4,
            whiteSpace: "nowrap",
            zIndex: 1,
          }}
        >
          <div className="react-aria-Chart-tooltip-label">
            {hover.band.label}
          </div>
          {hover.band.entries.map((entry) => (
            <div
              key={`${entry.label}-${entry.colorIndex}`}
              className="react-aria-Chart-tooltip-entry"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: seriesVar(entry.colorIndex),
                  flex: "none",
                }}
              />
              <span style={{ flex: 1 }}>{entry.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {entry.text}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default Chart;
