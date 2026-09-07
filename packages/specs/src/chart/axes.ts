/**
 * ADR-194 — 축·grid·tick 레이블.
 *
 * **회전 없음** (Skia 가 shape 레벨 텍스트 회전을 지원하지 않는다 — breakdown §2).
 * 범주 레이블이 밴드 폭을 넘으면 every-nth 로 솎아낸다 (R3): 겹쳐 그리는 대신
 * 일부를 안 그린다 — 두 consumer 가 같은 판정을 하도록 솎아내기도 기하가 정한다.
 */
import { approxTextWidth, formatTick, r2 } from "./scales";
import type { BandScale, LinearScale, TickResult } from "./scales";
import { bandCenter } from "./marks/line";
import type {
  AxisScene,
  ChartOrientation,
  LineMark,
  Rect,
  TextMark,
} from "./types";

export interface AxesInput {
  categories: readonly string[];
  band: BandScale;
  value: LinearScale;
  ticks: TickResult;
  plot: Rect;
  orientation: ChartOrientation;
  fontSize: number;
  showAxis: boolean;
  showGrid: boolean;
}

/**
 * 레이블을 몇 개 걸러 그릴지. 밴드 step 에 레이블 폭 + 최소 간격이 안 들어가면
 * 2개, 3개… 로 늘린다.
 */
export function labelStride(
  labels: readonly string[],
  slot: number,
  fontSize: number,
): number {
  if (labels.length === 0 || slot <= 0) return 1;
  let widest = 0;
  for (const label of labels) {
    const w = approxTextWidth(label, fontSize);
    if (w > widest) widest = w;
  }
  const needed = widest + fontSize * 0.5;
  if (needed <= slot) return 1;
  return Math.min(labels.length, Math.ceil(needed / slot));
}

function categoryAxis(input: AxesInput): AxisScene {
  const { categories, band, plot, orientation, fontSize, showAxis } = input;
  const horizontal = orientation === "horizontal";
  const ticks: TextMark[] = [];

  const stride = horizontal
    ? // 가로 막대는 레이블이 세로로 쌓이므로 폭이 아니라 높이가 제약이다.
      band.step >= fontSize * 1.2
      ? 1
      : Math.ceil((fontSize * 1.2) / Math.max(band.step, 0.01))
    : labelStride(categories, band.step, fontSize);

  if (showAxis) {
    for (let ci = 0; ci < categories.length; ci++) {
      if (ci % stride !== 0) continue;
      const center = bandCenter(band, ci);
      ticks.push(
        horizontal
          ? {
              kind: "text",
              x: r2(plot.x - fontSize * 0.4),
              y: r2(center),
              text: categories[ci],
              anchor: "end",
              baseline: "middle",
              role: "tick",
            }
          : {
              kind: "text",
              x: r2(center),
              y: r2(plot.y + plot.h + fontSize * 0.4),
              text: categories[ci],
              anchor: "middle",
              baseline: "top",
              role: "tick",
            },
      );
    }
  }

  const line: LineMark | null = showAxis
    ? horizontal
      ? {
          kind: "line",
          x1: r2(plot.x),
          y1: r2(plot.y),
          x2: r2(plot.x),
          y2: r2(plot.y + plot.h),
          role: "axis",
        }
      : {
          kind: "line",
          x1: r2(plot.x),
          y1: r2(plot.y + plot.h),
          x2: r2(plot.x + plot.w),
          y2: r2(plot.y + plot.h),
          role: "axis",
        }
    : null;

  return { axis: horizontal ? "y" : "x", line, grid: [], ticks };
}

function valueAxis(input: AxesInput): AxisScene {
  const { value, ticks, plot, orientation, fontSize, showAxis, showGrid } =
    input;
  const horizontal = orientation === "horizontal";
  const labels: TextMark[] = [];
  const grid: LineMark[] = [];

  for (const tick of ticks.ticks) {
    const pos = r2(value(tick));
    if (showGrid) {
      grid.push(
        horizontal
          ? {
              kind: "line",
              x1: pos,
              y1: r2(plot.y),
              x2: pos,
              y2: r2(plot.y + plot.h),
              role: "grid",
            }
          : {
              kind: "line",
              x1: r2(plot.x),
              y1: pos,
              x2: r2(plot.x + plot.w),
              y2: pos,
              role: "grid",
            },
      );
    }
    if (showAxis) {
      labels.push(
        horizontal
          ? {
              kind: "text",
              x: pos,
              y: r2(plot.y + plot.h + fontSize * 0.4),
              text: formatTick(tick),
              anchor: "middle",
              baseline: "top",
              role: "tick",
            }
          : {
              kind: "text",
              x: r2(plot.x - fontSize * 0.4),
              y: pos,
              text: formatTick(tick),
              anchor: "end",
              baseline: "middle",
              role: "tick",
            },
      );
    }
  }

  const line: LineMark | null = showAxis
    ? horizontal
      ? {
          kind: "line",
          x1: r2(plot.x),
          y1: r2(plot.y + plot.h),
          x2: r2(plot.x + plot.w),
          y2: r2(plot.y + plot.h),
          role: "axis",
        }
      : {
          kind: "line",
          x1: r2(plot.x),
          y1: r2(plot.y),
          x2: r2(plot.x),
          y2: r2(plot.y + plot.h),
          role: "axis",
        }
    : null;

  return { axis: horizontal ? "x" : "y", line, grid, ticks: labels };
}

/** [범주 축, 값 축] 순. 축 배열 순서는 scene 계약이라 orientation 과 무관하게 고정. */
export function buildAxes(input: AxesInput): AxisScene[] {
  return [categoryAxis(input), valueAxis(input)];
}
