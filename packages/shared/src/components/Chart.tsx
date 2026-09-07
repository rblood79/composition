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
  resolveChartMetrics,
} from "@composition/specs";
import type {
  ChartLegendPosition,
  ChartOrientation,
  ChartRow,
  ChartScene,
  ChartStackType,
  ChartType,
  Mark,
  TextMark,
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
      fontSize="inherit"
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
            mark.fillSeries !== undefined ? seriesVar(mark.fillSeries) : "none"
          }
          fillOpacity={mark.fillSeries !== undefined ? 0.85 : undefined}
          fillRule={mark.fillRule}
          stroke={
            mark.strokeSeries !== undefined
              ? seriesVar(mark.strokeSeries)
              : "none"
          }
          strokeWidth={mark.strokeWidth}
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
      style={style}
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
        {renderChartScene(scene)}
      </svg>
    </div>
  );
}

export default Chart;
