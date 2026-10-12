/** ADR-209: 공통 collection rows를 소비하는 lazy Recharts runtime 컨테이너.
 * Builder의 Canvas scene은 유지하며, Preview/Publish는 같은 adapter를 사용한다.
 * CSS base class와 size/variant 토큰은 이 경계에서 유지한다.
 */

import type {
  ChartAnimationEasing,
  ChartColorBy,
  ChartCurve,
  ChartLabelKey,
  ChartLegendPosition,
  ChartOrientation,
  ChartRow,
  ChartStackType,
  ChartType,
  PolarGridType,
  ChartProps as SpecChartProps,
} from "@composition/rendering";

import React from "react";

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
  /** ADR-215 — 시리즈 팔레트 (`categorical` 기본 · `mono`). `data-palette` 로 CSS 블록을 고른다. */
  palette?: SpecChartProps["palette"];
  // ── ADR-216 — 시간축 3 키 (전부 선택적, 스칼라). line/area 만.
  dimensionScale?: SpecChartProps["dimensionScale"];
  dimensionFormat?: string;
  dimensionLabelFormat?: string;
  // ── ADR-217 — 값 축 기준선 (선택적 배열, bar/line/area). 미설정 = 현행.
  referenceLines?: SpecChartProps["referenceLines"];
  variant?: string;
  size?: "S" | "M" | "L";
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
export function useBoxSize(ref: React.RefObject<HTMLDivElement | null>): {
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
