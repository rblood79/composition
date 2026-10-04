/**
 * ADR-194 — bar 마크. dodged(나란히) / stacked(누적) / expand(100% 누적) × vertical / horizontal.
 *
 * 막대는 `RectMark` 다 — path 로 만들 수도 있지만, Skia 가 rect 를 직접 그리는
 * 경로(`RectShape`)가 이미 있고 DOM 도 `<rect>` 가 있어 양쪽 다 path 파싱을
 * 건너뛴다. 좌표는 같은 기하가 낸 같은 숫자다.
 *
 * 값 레이블은 **원래 값**을 쓴다 (expand 로 정규화한 길이가 아니라). 비중으로
 * 그린 막대에 비중을 또 적으면 사용자가 준 숫자가 화면에서 사라진다.
 */
import { approxTextWidth, r2 } from "../scales";
import { categoryColorIndex } from "../budget";
import type { LinearScale, BandScale } from "../scales";
import { stackBands } from "../series";
import type { SeriesGrid, StackMode } from "../series";
import type {
  ChartColorBy,
  ChartLabelFormatter,
  ChartOrientation,
  Rect,
  RectMark,
  TextMark,
} from "../types";

export interface BarMarkInput {
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  stackMode: StackMode;
  colorBy: ChartColorBy;
  /** 팔레트 길이 — colorBy="category" 의 modulo 기준 */
  seriesCount: number;
  showValueLabels: boolean;
  /** 레이블 텍스트 생성기 — 값/범주명 판정은 호출부(`computeChartScene`)가 한다 */
  labelText: ChartLabelFormatter;
  fontSize: number;
}

export interface BarMarks {
  marks: RectMark[];
  labels: TextMark[];
}

function rect(
  orientation: ChartOrientation,
  bandStart: number,
  bandSize: number,
  valueFrom: number,
  valueTo: number,
  seriesIndex: number,
): RectMark {
  const lo = Math.min(valueFrom, valueTo);
  const hi = Math.max(valueFrom, valueTo);
  if (orientation === "horizontal") {
    return {
      kind: "rect",
      x: r2(lo),
      y: r2(bandStart),
      w: r2(hi - lo),
      h: r2(bandSize),
      seriesIndex,
    };
  }
  return {
    kind: "rect",
    x: r2(bandStart),
    y: r2(lo),
    w: r2(bandSize),
    h: r2(hi - lo),
    seriesIndex,
  };
}

/**
 * 막대 하나의 값 레이블. 누적 막대는 위에 얹을 자리가 없어 **안쪽 중앙**에 놓고,
 * 칸이 글자보다 작으면 아예 만들지 않는다 (겹쳐 읽을 수 없는 글자를 그리느니
 * 없는 편이 낫다).
 */
function valueLabel(
  mark: RectMark,
  text: string,
  /** 값 **부호** — 레이블을 막대 어느 쪽에 둘지 정한다 (내용은 `text` 가 갖는다) */
  raw: number,
  orientation: ChartOrientation,
  inside: boolean,
  fontSize: number,
): TextMark | null {
  if (text === "") return null;
  if (text === "") return null;
  const centerX = r2(mark.x + mark.w / 2);
  const centerY = r2(mark.y + mark.h / 2);

  if (inside) {
    const fits =
      orientation === "horizontal"
        ? mark.w >= approxTextWidth(text, fontSize)
        : mark.h >= fontSize;
    if (!fits) return null;
    return {
      kind: "text",
      x: centerX,
      y: centerY,
      text,
      anchor: "middle",
      baseline: "middle",
      role: "value",
    };
  }

  if (orientation === "horizontal") {
    return raw >= 0
      ? {
          kind: "text",
          x: r2(mark.x + mark.w + 3),
          y: centerY,
          text,
          anchor: "start",
          baseline: "middle",
          role: "value",
        }
      : {
          kind: "text",
          x: r2(mark.x - 3),
          y: centerY,
          text,
          anchor: "end",
          baseline: "middle",
          role: "value",
        };
  }

  return raw >= 0
    ? {
        kind: "text",
        x: centerX,
        y: r2(mark.y - 2),
        text,
        anchor: "middle",
        baseline: "bottom",
        role: "value",
      }
    : {
        kind: "text",
        x: centerX,
        y: r2(mark.y + mark.h + 2),
        text,
        anchor: "middle",
        baseline: "top",
        role: "value",
      };
}

export function buildBarMarks(input: BarMarkInput): BarMarks {
  const {
    grid,
    band,
    value,
    orientation,
    stackMode,
    colorBy,
    seriesCount,
    showValueLabels,
    labelText,
    fontSize,
  } = input;
  const marks: RectMark[] = [];
  const labels: TextMark[] = [];
  const palette = Math.max(1, seriesCount);
  const zero = value(0);

  const push = (
    mark: RectMark,
    raw: number,
    inside: boolean,
    categoryIndex: number,
  ): void => {
    marks.push(mark);
    if (!showValueLabels) return;
    const label = valueLabel(
      mark,
      labelText(categoryIndex, raw),
      raw,
      orientation,
      inside,
      fontSize,
    );
    if (label) labels.push(label);
  };

  for (let ci = 0; ci < grid.categories.length; ci++) {
    // 범주별 색은 시리즈 인덱스 대신 범주 인덱스를 팔레트에 넣는다 (shadcn mixed).
    const colorOf = (seriesIndex: number): number =>
      colorBy === "category"
        ? categoryColorIndex(ci, palette, grid.othersIndex)
        : seriesIndex;

    if (stackMode !== "none") {
      for (const { series, from, to } of stackBands(grid, ci, stackMode)) {
        push(
          rect(
            orientation,
            band.at(ci),
            band.bandwidth,
            value(from),
            value(to),
            colorOf(series.seriesIndex),
          ),
          series.values.get(ci) ?? 0,
          true,
          ci,
        );
      }
      continue;
    }

    // dodged — 밴드를 시리즈 수로 균등 분할. 값이 없는 시리즈도 자리는 차지한다
    //   (자리를 접으면 같은 범주가 시리즈 유무에 따라 다른 폭이 돼 축이 흔들린다).
    const n = Math.max(1, grid.series.length);
    const slot = band.bandwidth / n;
    for (let si = 0; si < grid.series.length; si++) {
      const series = grid.series[si];
      const v = series.values.get(ci);
      if (v === undefined) continue;
      push(
        rect(
          orientation,
          band.at(ci) + slot * si,
          slot,
          zero,
          value(v),
          colorOf(series.seriesIndex),
        ),
        v,
        false,
        ci,
      );
    }
  }

  return { marks, labels };
}
