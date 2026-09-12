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
  const { entries, box, position, fontSize } = input;
  if (entries.length === 0) return null;

  const items: LegendItem[] = [];
  const rowHeight = Math.max(LEGEND_SWATCH, fontSize) + LEGEND_GAP;
  const vertical = position === "left" || position === "right";

  let x = box.x;
  let y = box.y;

  for (const entry of entries) {
    const label = entry.label;
    const width = legendItemWidth(label, fontSize);
    if (!vertical && x > box.x && x + width > box.x + box.w) {
      x = box.x;
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
