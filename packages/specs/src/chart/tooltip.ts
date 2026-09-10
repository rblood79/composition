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
import { seriesLabel } from "./series";
import type { SeriesGrid } from "./series";
import { bandCenter } from "./marks/line";
import type {
  ChartOrientation,
  Rect,
  TooltipBand,
  TooltipEntry,
  TooltipScene,
} from "./types";

/**
 * 값 문자열 (ADR-210) — 미지정이면 기존 `formatTick`. tooltip 값은 stack 모드와
 * 무관하게 **raw** 라 정규화 context 가 없다 (breakdown §3.1).
 */
export type TooltipValueFormatter = (raw: number) => string;

export interface BandTooltipInput {
  grid: SeriesGrid;
  band: BandScale;
  plot: Rect;
  orientation: ChartOrientation;
  seriesCount: number;
  formatValue?: TooltipValueFormatter;
}

function entriesOf(
  grid: SeriesGrid,
  categoryIndex: number,
  fallbackLabel: string,
  formatValue: TooltipValueFormatter,
): TooltipEntry[] {
  const entries: TooltipEntry[] = [];
  for (const series of grid.series) {
    const v = series.values.get(categoryIndex);
    if (v === undefined) continue;
    entries.push({
      label: seriesLabel(series, fallbackLabel),
      colorIndex: series.seriesIndex,
      text: formatValue(v),
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
  const formatValue = input.formatValue ?? formatTick;
  if (grid.categories.length === 0) return null;

  const bands: TooltipBand[] = [];
  for (let ci = 0; ci < grid.categories.length; ci++) {
    const entries = entriesOf(grid, ci, "value", formatValue);
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
  formatValue?: TooltipValueFormatter;
}

export function buildRadialTooltip(
  input: RadialTooltipInput,
): TooltipScene | null {
  const { grid, slices, seriesCount, center } = input;
  const formatValue = input.formatValue ?? formatTick;
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
          text: formatValue(slice.raw),
        },
      ],
    };
  });
  return { bands, center };
}

export interface RingTooltipInput {
  rings: ReadonlyArray<{
    categoryIndex: number;
    label: string;
    inner: number;
    outer: number;
    slices: ReadonlyArray<{ colorIndex: number; start: number; sweep: number; raw: number }>;
  }>;
  seriesKeys: readonly string[];
  center: { x: number; y: number; outer: number; inner: number };
  formatValue?: TooltipValueFormatter;
}

/**
 * ADR-207 — radial 툴팁. **링 하나 = 밴드 하나**이고 히트는 반지름으로 갈린다
 * (각도로 갈리는 pie 와 다른 축이다 — 누적이면 한 링 안에 시리즈가 각도로 쌓여
 * 있어 각도 히트는 시리즈를 가리키지 범주를 가리키지 않는다).
 */
export function buildRingTooltip(
  input: RingTooltipInput,
): TooltipScene | null {
  const { rings, seriesKeys, center } = input;
  const formatValue = input.formatValue ?? formatTick;
  if (rings.length === 0) return null;
  const bands: TooltipBand[] = rings.map((ring) => ({
    categoryIndex: ring.categoryIndex,
    label: ring.label,
    rect: null,
    arc: { start: 0, end: 360 },
    ring: { inner: r2(ring.inner), outer: r2(ring.outer) },
    // 링 위쪽 가운데 — 12시 방향이 값 호의 시작이라 커서가 어디 있든 같은 자리다.
    anchor: { x: r2(center.x), y: r2(center.y - (ring.inner + ring.outer) / 2) },
    entries: ring.slices.map((slice, si) => ({
      label: seriesKeys[si] ?? ring.label,
      colorIndex: slice.colorIndex,
      text: formatValue(slice.raw),
    })),
  }));
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
      // 반지름 밴드가 있으면 그것이 먼저다 (ADR-207 radial — 링이 히트 단위).
      if (band.ring) {
        if (distance >= band.ring.inner && distance <= band.ring.outer) {
          return band;
        }
        continue;
      }
      // 부채꼴이 12시를 넘어 감기는 경우 (radar 의 첫 범주 — start 300, end 420):
      //   각도를 한 바퀴 올려 같은 구간 안으로 되돌린다.
      const a = angle < band.arc.start ? angle + 360 : angle;
      if (a >= band.arc.start && a < band.arc.end) return band;
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

export interface PolarBandTooltipInput {
  grid: SeriesGrid;
  angle: { (index: number): number; readonly step: number };
  center: { x: number; y: number; outer: number; inner: number };
  seriesCount: number;
  formatValue?: TooltipValueFormatter;
}

/**
 * ADR-207 — radar 툴팁. **범주 하나 = 각도 부채꼴 하나**이고, 그 부채꼴 안에서는
 * 시리즈 전부를 한 줄씩 보여 준다 (직교 `buildBandTooltip` 의 기둥과 같은 뜻 —
 * 축만 각도로 바뀐 것이다).
 */
export function buildPolarBandTooltip(
  input: PolarBandTooltipInput,
): TooltipScene | null {
  const { grid, angle, center, seriesCount } = input;
  const formatValue = input.formatValue ?? formatTick;
  const count = grid.categories.length;
  if (count === 0 || center.outer <= 0) return null;
  const palette = Math.max(1, seriesCount);
  const half = angle.step / 2;

  const bands: TooltipBand[] = [];
  for (let ci = 0; ci < count; ci++) {
    const mid = angle(ci);
    const start = ((mid - half) % 360 + 360) % 360;
    const entries: TooltipEntry[] = [];
    for (const series of grid.series) {
      const raw = series.values.get(ci);
      if (raw === undefined) continue;
      entries.push({
        label: seriesLabel(series, "series"),
        colorIndex: series.seriesIndex % palette,
        text: formatValue(raw),
      });
    }
    const radians = ((mid - 90) * Math.PI) / 180;
    bands.push({
      categoryIndex: ci,
      label: grid.categories[ci] || "",
      rect: null,
      arc: { start: r2(start), end: r2(start + angle.step) },
      anchor: {
        x: r2(center.x + center.outer * Math.cos(radians)),
        y: r2(center.y + center.outer * Math.sin(radians)),
      },
      entries,
    });
  }
  return { bands, center };
}
