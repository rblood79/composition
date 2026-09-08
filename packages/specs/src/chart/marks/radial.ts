/**
 * ADR-207 — radial 마크 (호 막대). **범주가 링 · 값이 각도**다 — radar 와 축이
 * 정반대다 (radar 는 범주가 각도 · 값이 반지름).
 *
 * 링마다 **트랙 호 + 값 호 2겹**을 낸다. 트랙(전체 한 바퀴)은 "여기까지가 100%" 를
 * 보여 주는 축 노릇을 하므로 `role: "grid"` 로 축 토큰을 쓴다 — 그래서 radial 은
 * 별도 극좌표 축을 그리지 않는다 (겹치면 이중선이 된다).
 *
 * 누적은 `stackBands`(ADR-194 의 `StackMode`) 를 **각도 축**에 적용한다 — bar 가
 * 값 축에 적용하는 것과 같은 함수다 (shadcn `chart-radial-stacked`).
 */
import { arcSlicePath } from "./pie";
import { formatTick, r2 } from "../scales";
import { stackBands } from "../series";
import type { SeriesGrid, StackMode } from "../series";
import type { PathMark, TextMark } from "../types";
import type { PolarCenter } from "../polarAxes";

/** 링 사이 간격 — 붙여 그리면 두 링의 경계가 사라진다 (pie 의 RING_GAP 동형). */
const RING_GAP = 3;

export interface RadialMarkInput {
  grid: SeriesGrid;
  center: PolarCenter;
  /** 값 → 각도의 기준 범위. 상한이 한 바퀴(360°) 다. */
  domain: readonly [number, number];
  seriesCount: number;
  stackMode: StackMode;
  showValueLabels: boolean;
  fontSize: number;
}

/** 툴팁 히트용 — 링 하나의 반지름 밴드 + 그 안의 조각 각도. */
export interface RadialRing {
  categoryIndex: number;
  label: string;
  inner: number;
  outer: number;
  slices: Array<{
    seriesIndex: number;
    colorIndex: number;
    start: number;
    sweep: number;
    raw: number;
  }>;
}

export interface RadialMarks {
  marks: PathMark[];
  labels: TextMark[];
  rings: RadialRing[];
}

function arcMark(
  center: PolarCenter,
  outer: number,
  inner: number,
  start: number,
  sweep: number,
  paint: { fillSeries: number } | { fillRole: "grid" },
): PathMark | null {
  const d = arcSlicePath(center.x, center.y, outer, inner, start, sweep);
  if (!d) return null;
  return {
    kind: "path",
    d,
    bbox: {
      x: r2(center.x - outer),
      y: r2(center.y - outer),
      w: r2(outer * 2),
      h: r2(outer * 2),
    },
    fillRule: "evenodd",
    ...paint,
  };
}

export function buildRadialMarks(input: RadialMarkInput): RadialMarks {
  const {
    grid,
    center,
    domain,
    seriesCount,
    stackMode,
    showValueLabels,
    fontSize,
  } = input;
  const marks: PathMark[] = [];
  const labels: TextMark[] = [];
  const rings: RadialRing[] = [];

  const count = grid.categories.length;
  const span = center.outer - center.inner;
  if (count === 0 || span <= 0) return { marks, labels, rings };

  const ringSpan = span / count;
  const thickness = Math.max(1, ringSpan - RING_GAP);
  // 값 → 각도. domain 하한은 0 으로 접는다 (`radiusScale` 과 같은 규약 — 극좌표에
  //   "축 아래" 가 없다). 상한이 domain 폭을 다 쓰면 한 바퀴다.
  const d0 = Math.max(0, domain[0]);
  const d1 = Math.max(d0, domain[1]);
  const width = d1 - d0;
  const toAngle = (value: number): number => {
    if (!Number.isFinite(value) || width === 0) return 0;
    const t = Math.min(1, Math.max(0, (value - d0) / width));
    return r2(t * 360);
  };
  const palette = Math.max(1, seriesCount);
  // 시리즈가 하나면 색을 가르는 축이 **범주**다 (pie 와 같은 규약 — 링 하나에
  //   조각도 하나뿐이라 시리즈 색으로 칠하면 전부 같은 색이 된다).
  const byCategory = grid.series.length <= 1;

  for (let ci = 0; ci < count; ci++) {
    // 첫 범주가 가장 바깥 — 목록 순서와 시각 순서가 같아야 범례가 읽힌다.
    const outer = r2(center.outer - ringSpan * ci);
    const inner = r2(outer - thickness);

    // 트랙은 **채운다** — 두께 있는 고리를 선으로만 그으면 동심원 2개가 되어
    //   격자처럼 읽힌다 (`fillRole`, ADR-207).
    const track = arcMark(center, outer, inner, 0, 360, { fillRole: "grid" });
    if (track) marks.push(track);

    const bands = stackBands(grid, ci, stackMode);
    const slices: RadialRing["slices"] = [];
    for (const band of bands) {
      const start = toAngle(band.from);
      const end = toAngle(band.to);
      const sweep = r2(end - start);
      const raw = band.to - band.from;
      if (sweep <= 0) continue;
      const colorIndex = byCategory ? ci % palette : band.series.seriesIndex;
      const arc = arcMark(center, outer, inner, start, sweep, {
        fillSeries: colorIndex,
      });
      if (arc) marks.push(arc);
      slices.push({
        seriesIndex: band.series.seriesIndex,
        colorIndex,
        start,
        sweep,
        raw,
      });

      if (!showValueLabels) continue;
      labels.push({
        kind: "text",
        x: r2(center.x),
        y: r2(center.y - (outer + inner) / 2 + fontSize * 0.35),
        text: formatTick(raw),
        anchor: "middle",
        baseline: "middle",
        role: "value",
      });
    }

    rings.push({
      categoryIndex: ci,
      label: grid.categories[ci] || "",
      inner,
      outer,
      slices,
    });
  }

  return { marks, labels, rings };
}
