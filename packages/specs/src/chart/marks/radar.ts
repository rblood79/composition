/**
 * ADR-207 — radar 마크. **시리즈 하나 = 닫힌 다각형 하나**.
 *
 * 결측 규약이 line/area 와 갈린다 (R3): line/area 는 값 없는 범주에서 subpath 를
 * 끊어 선을 비우지만, radar 의 다각형은 **닫힌 도형**이라 끊으면 도형 자체가
 * 깨진다 (반쪽 다각형이 채워지면 사용자가 준 적 없는 면적이 화면에 생긴다).
 * 그래서 결측 꼭짓점은 **중심(반지름 0)으로 접는다** — 면적이 0 쪽으로 줄어드는
 * 것이 "값이 없다" 에 가장 가까운 시각 결과다.
 */
import { polarPoint } from "../polar";
import type { AngleScale, RadiusScale } from "../polar";
import { formatTick, r2 } from "../scales";
import type { SeriesGrid } from "../series";
import type { PathMark, Rect, TextMark } from "../types";
import { polarLabelAnchor } from "../polarAxes";
import type { PolarCenter } from "../polarAxes";

export interface RadarMarkInput {
  grid: SeriesGrid;
  angle: AngleScale;
  value: RadiusScale;
  center: PolarCenter;
  strokeWidth: number;
  showValueLabels: boolean;
  fontSize: number;
}

export interface RadarMarks {
  marks: PathMark[];
  labels: TextMark[];
  /** 시리즈별 꼭짓점 — 점 표시(`buildDotMarks`) 가 그대로 받는다 */
  vertices: Array<Array<{ x: number; y: number }>>;
}

function bboxOfPoints(points: ReadonlyArray<{ x: number; y: number }>): Rect {
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = points[0].x;
  let maxX = points[0].x;
  let minY = points[0].y;
  let maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: r2(minX), y: r2(minY), w: r2(maxX - minX), h: r2(maxY - minY) };
}

export function buildRadarMarks(input: RadarMarkInput): RadarMarks {
  const { grid, angle, value, center, strokeWidth, showValueLabels, fontSize } =
    input;
  const marks: PathMark[] = [];
  const labels: TextMark[] = [];
  const vertices: Array<Array<{ x: number; y: number }>> = [];

  // 꼭짓점 3개 미만이면 다각형이 아니다 — 선 하나를 채우면 면적 0 의 마크가 남는다.
  if (grid.categories.length < 3 || center.outer <= 0) {
    return { marks, labels, vertices };
  }

  for (const series of grid.series) {
    const points: Array<{ x: number; y: number }> = [];
    for (let ci = 0; ci < grid.categories.length; ci++) {
      const raw = series.values.get(ci);
      // 결측은 중심으로 접는다 (R3) — `radiusScale` 이 비수치를 안쪽 반지름으로
      //   보내므로 결과는 언제나 유한하다.
      const radius = raw === undefined ? center.inner : value(raw);
      points.push(polarPoint(center.x, center.y, radius, angle(ci)));
    }

    let d = "";
    for (let i = 0; i < points.length; i++) {
      d += i === 0 ? `M ${points[i].x} ${points[i].y}` : ` L ${points[i].x} ${points[i].y}`;
    }
    marks.push({
      kind: "path",
      d: `${d} Z`,
      bbox: bboxOfPoints(points),
      fillSeries: series.seriesIndex,
      strokeSeries: series.seriesIndex,
      strokeWidth,
    });
    vertices.push(points);

    if (!showValueLabels) continue;
    for (let ci = 0; ci < grid.categories.length; ci++) {
      const raw = series.values.get(ci);
      if (raw === undefined) continue;
      const deg = angle(ci);
      // 레이블은 꼭짓점보다 조금 바깥에 — 다각형 선 위에 글자가 앉지 않게.
      const at = polarPoint(center.x, center.y, value(raw) + fontSize * 0.4, deg);
      const { anchor, baseline } = polarLabelAnchor(deg);
      labels.push({
        kind: "text",
        x: at.x,
        y: at.y,
        text: formatTick(raw),
        anchor,
        baseline,
        role: "value",
      });
    }
  }

  return { marks, labels, vertices };
}
