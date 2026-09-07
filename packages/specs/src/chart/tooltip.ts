/**
 * ADR-194 후속 (shadcn tooltip 대조) — 툴팁 데이터 + 히트 판정.
 *
 * hover 는 D1 상호작용이라 **Preview/Publish(DOM) 소유**다 (Skia 빌더 캔버스는
 * 정적 렌더를 유지한다 — 메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview`).
 * 그렇다고 포인터→범주 계산을 DOM 쪽에 두면 밴드 규칙이 마크 기하와 갈려
 * 툴팁이 가리키는 막대와 실제 막대가 어긋난다. 그래서 **데이터와 히트 기하는
 * 기하 함수가 내고, DOM 은 판정 함수를 호출만** 한다.
 */
import { formatTick, r2 } from "./scales";
import type { BandScale } from "./scales";
import type { SeriesGrid } from "./series";
import { bandCenter } from "./marks/line";
import type {
  ChartOrientation,
  Rect,
  TooltipBand,
  TooltipEntry,
  TooltipScene,
} from "./types";

export interface BandTooltipInput {
  grid: SeriesGrid;
  band: BandScale;
  plot: Rect;
  orientation: ChartOrientation;
  seriesCount: number;
}

function entriesOf(
  grid: SeriesGrid,
  categoryIndex: number,
  fallbackLabel: string,
): TooltipEntry[] {
  const entries: TooltipEntry[] = [];
  for (const series of grid.series) {
    const v = series.values.get(categoryIndex);
    if (v === undefined) continue;
    entries.push({
      label: series.key || fallbackLabel,
      colorIndex: series.seriesIndex,
      text: formatTick(v),
    });
  }
  return entries;
}

/**
 * bar/line/area 의 툴팁. 히트 영역은 **밴드 사이 여백까지 포함한 기둥**이다 —
 * 막대 폭으로만 잡으면 막대 사이에서 툴팁이 끊겨 값을 읽다 놓친다.
 */
export function buildBandTooltip(input: BandTooltipInput): TooltipScene | null {
  const { grid, band, plot, orientation, seriesCount } = input;
  if (grid.categories.length === 0) return null;

  const bands: TooltipBand[] = [];
  for (let ci = 0; ci < grid.categories.length; ci++) {
    const entries = entriesOf(grid, ci, "value");
    if (entries.length === 0) continue;
    const start = band.at(ci) - (band.step - band.bandwidth) / 2;
    const center = bandCenter(band, ci);
    bands.push({
      categoryIndex: ci,
      label: grid.categories[ci] || "",
      rect:
        orientation === "horizontal"
          ? { x: plot.x, y: r2(start), w: plot.w, h: r2(band.step) }
          : { x: r2(start), y: plot.y, w: r2(band.step), h: plot.h },
      arc: null,
      anchor:
        orientation === "horizontal"
          ? { x: r2(plot.x + plot.w / 2), y: r2(center) }
          : { x: r2(center), y: r2(plot.y) },
      entries,
    });
  }
  if (bands.length === 0) return null;
  void seriesCount;
  return { bands, center: null };
}

export interface RadialTooltipInput {
  grid: SeriesGrid;
  /** 조각 각도 — buildPieMarks 와 같은 순서·같은 각도여야 한다 */
  slices: Array<{ categoryIndex: number; start: number; sweep: number; raw: number }>;
  seriesCount: number;
  center: { x: number; y: number; outer: number; inner: number };
}

export function buildRadialTooltip(
  input: RadialTooltipInput,
): TooltipScene | null {
  const { grid, slices, seriesCount, center } = input;
  if (slices.length === 0) return null;
  const palette = Math.max(1, seriesCount);
  const bands: TooltipBand[] = slices.map((slice) => {
    const midAngle = slice.start + slice.sweep / 2;
    const radians = ((midAngle - 90) * Math.PI) / 180;
    const radius = (center.outer + center.inner) / 2;
    const label = grid.categories[slice.categoryIndex] || "";
    return {
      categoryIndex: slice.categoryIndex,
      label,
      rect: null,
      arc: { start: r2(slice.start), end: r2(slice.start + slice.sweep) },
      anchor: {
        x: r2(center.x + radius * Math.cos(radians)),
        y: r2(center.y + radius * Math.sin(radians)),
      },
      entries: [
        {
          label,
          colorIndex: slice.categoryIndex % palette,
          text: formatTick(slice.raw),
        },
      ],
    };
  });
  return { bands, center };
}

/** 12시=0, 시계 방향의 각도 (0~360). */
function angleOf(dx: number, dy: number): number {
  const degrees = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return ((degrees % 360) + 360) % 360;
}

/**
 * 포인터 → 툴팁 밴드. 못 찾으면 null (툴팁을 닫는다).
 *
 * DOM 이 이 함수를 부르는 것이 계약이다 — 밴드 폭·조각 각도를 DOM 이 다시
 * 계산하면 마크와 어긋난다.
 */
export function hitTooltipBand(
  tooltip: TooltipScene | null,
  x: number,
  y: number,
): TooltipBand | null {
  if (!tooltip) return null;

  if (tooltip.center) {
    const { x: cx, y: cy, outer, inner } = tooltip.center;
    const dx = x - cx;
    const dy = y - cy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > outer || distance < inner) return null;
    const angle = angleOf(dx, dy);
    for (const band of tooltip.bands) {
      if (!band.arc) continue;
      if (angle >= band.arc.start && angle < band.arc.end) return band;
    }
    // 마지막 조각이 360 에 닿는 부동소수 경계
    const last = tooltip.bands[tooltip.bands.length - 1];
    return last?.arc && last.arc.end >= 359.99 ? last : null;
  }

  for (const band of tooltip.bands) {
    const rect = band.rect;
    if (!rect) continue;
    if (
      x >= rect.x &&
      x <= rect.x + rect.w &&
      y >= rect.y &&
      y <= rect.y + rect.h
    ) {
      return band;
    }
  }
  return null;
}
