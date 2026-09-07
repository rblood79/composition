/**
 * ADR-194 — pie 마크. 자체 `arcPath` 로 SVG `A` 명령을 낸다.
 *
 * CanvasKit `Path.MakeFromSVGString` 이 `A` 를 파싱한다는 것은 Phase 1 의
 * `nodeRendererPath.integration.test.ts` 가 실제 픽셀로 확인했다 — 이 파일이
 * 그 전제 위에 선다.
 *
 * 파이는 범주 축·값 축이 없다: 첫 시리즈의 범주별 값이 조각이 된다 (다중 시리즈
 * 파이는 v1 비스코프 — 도넛/이중 링은 chartType 확장 시 마크 파일 추가).
 */
import { r2 } from "../scales";
import type { SeriesGrid } from "../series";
import type { PathMark, Rect } from "../types";

export interface PieMarkInput {
  grid: SeriesGrid;
  plot: Rect;
  /** 팔레트 길이 — 파이는 **범주**가 색을 가르므로 범주 인덱스를 여기로 modulo 한다. */
  seriesCount: number;
}

/** 각도(도) → 원 위의 점. 12시 방향을 0° 로 두고 시계 방향. */
function polar(
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [
    r2(cx + radius * Math.cos(radians)),
    r2(cy + radius * Math.sin(radians)),
  ];
}

/**
 * 파이 한 조각의 path. 360°(단일 조각)는 `A` 하나로 표현할 수 없어
 * (시작=끝이면 호가 사라진다) 반원 2개로 쪼갠다.
 */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  sweepDeg: number,
): string {
  if (sweepDeg <= 0) return "";
  if (sweepDeg >= 359.999) {
    const [ax, ay] = polar(cx, cy, radius, 0);
    const [bx, by] = polar(cx, cy, radius, 180);
    return `M ${ax} ${ay} A ${r2(radius)} ${r2(radius)} 0 1 1 ${bx} ${by} A ${r2(radius)} ${r2(radius)} 0 1 1 ${ax} ${ay} Z`;
  }
  const [sx, sy] = polar(cx, cy, radius, startDeg);
  const [ex, ey] = polar(cx, cy, radius, startDeg + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${r2(cx)} ${r2(cy)} L ${sx} ${sy} A ${r2(radius)} ${r2(radius)} 0 ${largeArc} 1 ${ex} ${ey} Z`;
}

export function buildPieMarks(input: PieMarkInput): PathMark[] {
  const { grid, plot, seriesCount } = input;
  const series = grid.series[0];
  if (!series) return [];

  // 음수는 각도를 만들 수 없다 — 절대값으로 비중을 낸다 (파이에 음수를 넣은
  //   입력을 버리지 않고 크기로 해석. 부호는 파이가 표현할 수 없는 축이다).
  const slices: Array<{ ci: number; magnitude: number }> = [];
  let total = 0;
  for (let ci = 0; ci < grid.categories.length; ci++) {
    const v = series.values.get(ci);
    if (v === undefined) continue;
    const magnitude = Math.abs(v);
    if (magnitude === 0) continue;
    slices.push({ ci, magnitude });
    total += magnitude;
  }
  if (total === 0) return [];

  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;
  const radius = Math.min(plot.w, plot.h) / 2;
  if (radius <= 0) return [];

  const palette = Math.max(1, seriesCount);
  const marks: PathMark[] = [];
  let angle = 0;
  for (const slice of slices) {
    const sweep = (slice.magnitude / total) * 360;
    const d = arcPath(cx, cy, radius, angle, sweep);
    angle += sweep;
    if (!d) continue;
    marks.push({
      kind: "path",
      d,
      // 조각별 bbox 를 정확히 재려면 호의 극점 판정이 필요하다. 원 전체 bbox 는
      //   항상 상위집합이라 컬링이 오판하지 않는다 (R9 요구는 상위집합).
      bbox: {
        x: r2(cx - radius),
        y: r2(cy - radius),
        w: r2(radius * 2),
        h: r2(radius * 2),
      },
      // 파이는 시리즈가 아니라 **범주**가 색을 가른다 (조각마다 다른 색).
      fillSeries: slice.ci % palette,
    });
  }
  return marks;
}
