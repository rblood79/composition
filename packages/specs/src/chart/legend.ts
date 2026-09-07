/**
 * ADR-194 — 범례. swatch(색 사각형) + 레이블 텍스트 쌍의 배치.
 *
 * top/bottom 은 가로로 흘리고 left/right 는 세로로 쌓는다. 가로 배치에서 폭을
 * 넘으면 줄바꿈한다 — 넘친 항목을 잘라내면 사용자가 정의한 시리즈가 화면에서
 * 사라지는데, 그게 색만 보이고 이름이 없는 상태보다 나쁘다.
 */
import { approxTextWidth, r2 } from "./scales";
import type { SeriesGrid } from "./series";
import type { ChartLegendPosition, LegendItem, LegendScene, Rect } from "./types";

export interface LegendInput {
  grid: SeriesGrid;
  /** 범례가 차지하도록 배정된 영역 */
  box: Rect;
  position: ChartLegendPosition;
  fontSize: number;
}

export const LEGEND_SWATCH = 10;
export const LEGEND_GAP = 6;
export const LEGEND_ITEM_GAP = 14;

export function legendItemWidth(label: string, fontSize: number): number {
  return LEGEND_SWATCH + LEGEND_GAP + approxTextWidth(label, fontSize);
}

/** 범례가 필요로 하는 높이 (top/bottom) 또는 폭 (left/right). */
export function legendExtent(
  grid: SeriesGrid,
  position: ChartLegendPosition,
  available: number,
  fontSize: number,
): number {
  const labels = grid.series.map((s) => s.key || "series");
  if (labels.length === 0) return 0;
  const rowHeight = Math.max(LEGEND_SWATCH, fontSize) + LEGEND_GAP;

  if (position === "left" || position === "right") {
    let widest = 0;
    for (const label of labels) {
      const w = legendItemWidth(label, fontSize);
      if (w > widest) widest = w;
    }
    return r2(widest + LEGEND_ITEM_GAP);
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
  return r2(rows * rowHeight + LEGEND_GAP);
}

export function buildLegend(input: LegendInput): LegendScene | null {
  const { grid, box, position, fontSize } = input;
  if (grid.series.length === 0) return null;

  const items: LegendItem[] = [];
  const rowHeight = Math.max(LEGEND_SWATCH, fontSize) + LEGEND_GAP;
  const vertical = position === "left" || position === "right";

  let x = box.x;
  let y = box.y;

  for (const series of grid.series) {
    const label = series.key || "series";
    const width = legendItemWidth(label, fontSize);
    if (!vertical && x > box.x && x + width > box.x + box.w) {
      x = box.x;
      y += rowHeight;
    }

    const swatchY = y + (rowHeight - LEGEND_GAP - LEGEND_SWATCH) / 2;
    items.push({
      label,
      seriesIndex: series.seriesIndex,
      swatch: {
        kind: "rect",
        x: r2(x),
        y: r2(swatchY),
        w: LEGEND_SWATCH,
        h: LEGEND_SWATCH,
        seriesIndex: series.seriesIndex,
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
