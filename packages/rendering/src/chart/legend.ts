/**
 * ADR-194 — 범례. swatch(색 사각형) + 레이블 텍스트 쌍의 배치.
 *
 * top/bottom 은 가로로 흘리고 left/right 는 세로로 쌓는다. 가로 배치에서 폭을
 * 넘으면 줄바꿈한다 — 넘친 항목을 잘라내면 사용자가 정의한 시리즈가 화면에서
 * 사라지는데, 그게 색만 보이고 이름이 없는 상태보다 나쁘다.
 */
import { approxTextWidth, r2 } from "./scales";
import type {
  ChartLegendPosition,
  ChartPaintRole,
  LegendItem,
  LegendScene,
  Rect,
} from "./types";

/**
 * 범례 한 줄. **grid.series 가 아니라 이 목록**을 받는다 — 색을 가르는 축이
 * 차트마다 다르기 때문이다 (pie 와 bar mixed 는 범주가, 나머지는 시리즈가
 * 색을 가른다). grid 를 직접 읽던 때는 pie 범례가 조각과 무관한 시리즈 이름을
 * 나열했다 (2026-09-08 shadcn 대조에서 발견).
 */
export interface LegendEntry {
  label: string;
  /** 팔레트 인덱스 (이미 modulo 됨) */
  colorIndex: number;
  /** 팔레트 대신 역할 색 (dumbbell 의 이전 · 이후 = neutral · accent). */
  fillPaint?: ChartPaintRole;
}

export interface LegendInput {
  entries: readonly LegendEntry[];
  /** 범례가 차지하도록 배정된 영역 */
  box: Rect;
  position: ChartLegendPosition;
  fontSize: number;
}

export const LEGEND_SWATCH = 10;
export const LEGEND_GAP = 6;
export const LEGEND_ITEM_GAP = 14;
/**
 * 범례와 차트 사이 (범례 내용 ↔ 차트 내용) — 사용자 결정 2026-11-16 「차트 기준 범례와 간격 위 · 아래 8px」 → 같은 날
 * 16px · 좌우도 16px. 줄 사이 (`LEGEND_GAP`) · 가로 항목 사이 (`LEGEND_ITEM_GAP`) 는 그대로다.
 */
export const LEGEND_CHART_GAP = 16;

export function legendItemWidth(label: string, fontSize: number): number {
  return LEGEND_SWATCH + LEGEND_GAP + approxTextWidth(label, fontSize);
}

/** 범례가 필요로 하는 높이 (top/bottom) 또는 폭 (left/right). */
export function legendExtent(
  entries: readonly LegendEntry[],
  position: ChartLegendPosition,
  available: number,
  fontSize: number,
): number {
  const labels = entries.map((e) => e.label);
  if (labels.length === 0) return 0;
  const rowHeight = Math.max(LEGEND_SWATCH, fontSize) + LEGEND_GAP;

  if (position === "left" || position === "right") {
    let widest = 0;
    for (const label of labels) {
      const w = legendItemWidth(label, fontSize);
      if (w > widest) widest = w;
    }
    return r2(widest + LEGEND_CHART_GAP);
  }

  let rows = 1;
  let x = 0;
  for (const label of labels) {
    const w = legendItemWidth(label, fontSize);
    if (x > 0 && x + w > available) {
      rows++;
      x = 0;
    }
    x += w + LEGEND_ITEM_GAP;
  }
  // 줄 내용 높이 (마지막 줄 뒤 줄 간격 없음) + 차트 쪽 간격.
  return r2(rows * rowHeight - LEGEND_GAP + LEGEND_CHART_GAP);
}

/**
 * 범례 자리 떼기 — `position` 쪽 가장자리에서 `extent` (가로면 폭 · 세로면 높이) 만큼 범례 상자를 떼고
 * 남은 그림 영역을 돌려준다. 시리즈 경로 (`layout.ts`) 와 family (`placeLegend`) 가 같은 배치를 쓴다.
 */
export function carveLegend(
  outer: Rect,
  extent: number,
  position: ChartLegendPosition,
): { box: Rect; plot: Rect } {
  const e = r2(extent);
  if (position === "top")
    return {
      box: { x: outer.x, y: outer.y, w: outer.w, h: e },
      plot: { ...outer, y: r2(outer.y + e), h: r2(outer.h - e) },
    };
  if (position === "left")
    return {
      box: { x: outer.x, y: outer.y, w: e, h: outer.h },
      plot: { ...outer, x: r2(outer.x + e), w: r2(outer.w - e) },
    };
  if (position === "right")
    return {
      box: { x: r2(outer.x + outer.w - e), y: outer.y, w: e, h: outer.h },
      plot: { ...outer, w: r2(outer.w - e) },
    };
  return {
    box: { x: outer.x, y: r2(outer.y + outer.h - e), w: outer.w, h: e },
    plot: { ...outer, h: r2(outer.h - e) },
  };
}

/** 범례 자리 이름 — 모르는 값은 기본 (bottom). */
export function legendPositionOf(value: unknown): ChartLegendPosition {
  return value === "top" || value === "left" || value === "right"
    ? value
    : "bottom";
}

/**
 * family 범례 — 자리 (`legendPosition`) 에 범례를 놓고 남은 그림 영역을 돌려준다 (2026-11-16 /fix — 전에는
 * family 마다 위에 고정해 그렸다). 범례가 그 방향 길이의 1/3 을 넘으면 내지 않는다 — 작은 상자 (Library
 * 표본 칸 · 좁은 카드) 에서 범례가 그림을 밀어내 아무것도 읽히지 않는다 (색 이름은 툴팁에 남는다).
 */
export function placeLegend(input: {
  entries: readonly LegendEntry[];
  outer: Rect;
  position: unknown;
  fontSize: number;
}): { legend: LegendScene | null; plot: Rect } {
  const { entries, outer, fontSize } = input;
  const position = legendPositionOf(input.position);
  const vertical = position === "left" || position === "right";
  const extent = legendExtent(entries, position, outer.w, fontSize);
  if (extent <= 0 || extent > (vertical ? outer.w : outer.h) / 3)
    return { legend: null, plot: outer };
  const { box, plot } = carveLegend(outer, extent, position);
  return {
    legend: buildLegend({ entries, box, position, fontSize }),
    plot,
  };
}

export function buildLegend(input: LegendInput): LegendScene | null {
  const { entries, box, position, fontSize } = input;
  if (entries.length === 0) return null;

  const items: LegendItem[] = [];
  const rowHeight = Math.max(LEGEND_SWATCH, fontSize) + LEGEND_GAP;
  const vertical = position === "left" || position === "right";

  // 상자의 여백 (`legendExtent` 의 LEGEND_CHART_GAP) 은 그림 쪽에 둔다 — top · left 는 상자 끝,
  //   bottom · right 는 상자 시작. 늘 시작점부터 놓으면 bottom · right 범례가 그림 (축 글자 · 막대) 에 붙는다
  //   (2026-11-16 /fix — 사용자 보고 「legend bottom 일 때 chart 와 여백이 없다」).
  const startX = box.x + (position === "right" ? LEGEND_CHART_GAP : 0);
  let x = startX;
  let y = box.y + (position === "bottom" ? LEGEND_CHART_GAP : 0);

  for (const entry of entries) {
    const label = entry.label;
    const width = legendItemWidth(label, fontSize);
    if (!vertical && x > startX && x + width > box.x + box.w) {
      x = startX;
      y += rowHeight;
    }

    const swatchY = y + (rowHeight - LEGEND_GAP - LEGEND_SWATCH) / 2;
    items.push({
      label,
      seriesIndex: entry.colorIndex,
      swatch: {
        kind: "rect",
        x: r2(x),
        y: r2(swatchY),
        w: LEGEND_SWATCH,
        h: LEGEND_SWATCH,
        seriesIndex: entry.colorIndex,
        ...(entry.fillPaint ? { fillPaint: entry.fillPaint } : {}),
      },
      text: {
        kind: "text",
        x: r2(x + LEGEND_SWATCH + LEGEND_GAP),
        y: r2(swatchY + LEGEND_SWATCH / 2),
        text: label,
        anchor: "start",
        baseline: "middle",
        role: "legend",
      },
    });

    if (vertical) y += rowHeight;
    else x += width + LEGEND_ITEM_GAP;
  }

  return { position, items };
}
