/**
 * ADR-194 후속 (shadcn `chart-line-dots` 대조) — 데이터 점 표시.
 *
 * 시리즈당 **마크 1개**에 모든 점을 subpath 로 담는다. 점마다 마크를 만들면
 * 200행 × 4시리즈에서 마크가 800개가 되어 두 consumer 의 draw 호출이 그만큼
 * 늘어난다 (G4 프레임 예산의 축). 원끼리 겹치지 않으므로 nonzero 로 충분하다.
 */
import { r2 } from "../scales";
import type { PathMark } from "../types";
import type { ScreenPoint } from "../curves";
import { bboxOf } from "./line";

/** 원 하나의 path — 반원 2개 (`A` 는 시작=끝이면 호가 사라진다, pie 와 같은 규약). */
export function circlePath(cx: number, cy: number, radius: number): string {
  const r = r2(radius);
  const left = r2(cx - radius);
  const right = r2(cx + radius);
  const y = r2(cy);
  return `M ${left} ${y} A ${r} ${r} 0 1 1 ${right} ${y} A ${r} ${r} 0 1 1 ${left} ${y} Z`;
}

/** 선 두께에서 점 반지름 — shadcn 기본(선 2 / 점 r4) 비율. */
export function dotRadius(strokeWidth: number): number {
  return Math.max(2, r2(strokeWidth * 1.6));
}

export function buildDotMarks(
  points: readonly ScreenPoint[],
  seriesIndex: number,
  radius: number,
): PathMark | null {
  if (points.length === 0) return null;
  const d = points.map((p) => circlePath(p.x, p.y, radius)).join(" ");
  const box = bboxOf(points);
  return {
    kind: "path",
    d,
    bbox: {
      x: r2(box.x - radius),
      y: r2(box.y - radius),
      w: r2(box.w + radius * 2),
      h: r2(box.h + radius * 2),
    },
    fillSeries: seriesIndex,
  };
}
