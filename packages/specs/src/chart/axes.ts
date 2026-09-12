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
import type { TimeTickLabel } from "./timeAxis";
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
  /** 값 눈금 문자열 (ADR-210). 미지정이면 기존 `formatTick`. */
  tickText?: (tick: number) => string;
  /**
   * ADR-216 — 시간 스케일이면 범주 축을 눈금 (epoch → `scale`) + 2단 라벨로 그린다.
   * `categories` 는 읽지 않는다 (라벨은 눈금에서 나온다).
   */
  time?: { scale: LinearScale; labels: readonly TimeTickLabel[] };
  /**
   * ADR-217 — 산점도 linear x: 범주 축을 값 축과 같은 규칙의 숫자 눈금으로 그린다 (`niceTicks` ·
   * `tickText`). `categories` 는 읽지 않는다.
   */
  linear?: { scale: LinearScale; ticks: TickResult };
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

/**
 * ADR-216 — 시간축. 눈금마다 secondary 라벨 (첫 줄), 큰 단위 경계에만 primary 라벨 (둘째 줄,
 * `fontSize × 1.3` 아래). 가로 방향은 한 줄 (secondary 만 — 왼쪽 여백은 8 글자 폭). 눈금이 plot
 * 밖 (nice 로 넓힌 domain 은 plot 안이지만 방어) 이면 건너뛴다. 격자는 값 축만 (현행과 같음).
 */
function timeAxis(
  input: AxesInput,
  time: NonNullable<AxesInput["time"]>,
): AxisScene {
  const { plot, orientation, fontSize, showAxis } = input;
  const horizontal = orientation === "horizontal";
  const ticks: TextMark[] = [];
  if (showAxis) {
    for (const label of time.labels) {
      const pos = r2(time.scale(label.t));
      if (horizontal) {
        if (pos < plot.y - 0.01 || pos > plot.y + plot.h + 0.01) continue;
        ticks.push({
          kind: "text",
          x: r2(plot.x - fontSize * 0.4),
          y: pos,
          text: label.tick,
          anchor: "end",
          baseline: "middle",
          role: "tick",
        });
        continue;
      }
      if (pos < plot.x - 0.01 || pos > plot.x + plot.w + 0.01) continue;
      ticks.push({
        kind: "text",
        x: pos,
        y: r2(plot.y + plot.h + fontSize * 0.4),
        text: label.tick,
        anchor: "middle",
        baseline: "top",
        role: "tick",
      });
      if (label.boundary !== null) {
        ticks.push({
          kind: "text",
          x: pos,
          y: r2(plot.y + plot.h + fontSize * 1.7),
          text: label.boundary,
          anchor: "middle",
          baseline: "top",
          role: "tick",
        });
      }
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
  const tickText = input.tickText ?? formatTick;
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
              text: tickText(tick),
              anchor: "middle",
              baseline: "top",
              role: "tick",
            }
          : {
              kind: "text",
              x: r2(plot.x - fontSize * 0.4),
              y: pos,
              text: tickText(tick),
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
/** ADR-217 — linear x 축: 눈금 = `ticks.ticks` 를 `scale` 로, 문자열은 값 축과 같은 `tickText`. */
function linearAxis(
  input: AxesInput,
  linear: NonNullable<AxesInput["linear"]>,
): AxisScene {
  const tickText = input.tickText ?? formatTick;
  const labels: TimeTickLabel[] = linear.ticks.ticks.map((t) => ({
    t,
    tick: tickText(t),
    boundary: null,
  }));
  return timeAxis(input, { scale: linear.scale, labels });
}

export function buildAxes(input: AxesInput): AxisScene[] {
  return [
    input.time
      ? timeAxis(input, input.time)
      : input.linear
        ? linearAxis(input, input.linear)
        : categoryAxis(input),
    valueAxis(input),
  ];
}
