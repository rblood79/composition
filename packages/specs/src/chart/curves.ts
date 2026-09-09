/**
 * ADR-194 후속 (shadcn 대조) — 선 보간.
 *
 * 외부 의존 0 유지: d3-shape 의 `curveMonotoneX`(Fritsch–Carlson PCHIP) 와
 * `curveStep`(중점 계단) 을 그대로 재구현한다. 같은 알고리즘이라야 사람이
 * 예상하는 곡선이 나오고, **두 consumer 가 아니라 기하 함수 하나**가 곡선을
 * 정한다는 계약이 유지된다 (Skia 는 `PathShape.d` 를, DOM 은 `<path d>` 를
 * 같은 문자열로 받는다 — 곡선을 각자 그리면 그 순간 발산한다).
 *
 * 계산은 **범주 축(along) × 값 축(across)** 좌표계에서 한다. 화면 x/y 로 먼저
 * 바꾸면 horizontal 차트에서 보간 방향이 축과 어긋난다 (세로로 흐르는 선을
 * 가로 기준으로 단조화하게 된다).
 */
import { r2 } from "./scales";
import type { ChartCurve, ChartOrientation } from "./types";

export interface AxialPoint {
  /** 범주 축 좌표 */
  along: number;
  /** 값 축 좌표 */
  across: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

export function toScreen(
  orientation: ChartOrientation,
  point: AxialPoint,
): ScreenPoint {
  return orientation === "horizontal"
    ? { x: r2(point.across), y: r2(point.along) }
    : { x: r2(point.along), y: r2(point.across) };
}

/**
 * Fritsch–Carlson 단조 3차 보간의 접선. 구간 기울기 부호가 바뀌는 자리에서
 * 접선을 0 으로 눕혀 **데이터에 없는 봉우리**가 생기지 않게 한다 (곡선 차트가
 * 값을 과장하지 않는다는 것이 monotone 을 쓰는 유일한 이유다).
 */
export function monotoneTangents(
  along: readonly number[],
  across: readonly number[],
): number[] {
  const n = along.length;
  if (n < 2) return new Array<number>(n).fill(0);

  const secant: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = along[i + 1] - along[i];
    secant.push(dx === 0 ? 0 : (across[i + 1] - across[i]) / dx);
  }

  const tangent = new Array<number>(n).fill(0);
  tangent[0] = secant[0];
  tangent[n - 1] = secant[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangent[i] =
      secant[i - 1] * secant[i] <= 0 ? 0 : (secant[i - 1] + secant[i]) / 2;
  }

  for (let i = 0; i < n - 1; i++) {
    if (secant[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / secant[i];
    const b = tangent[i + 1] / secant[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      tangent[i] = t * a * secant[i];
      tangent[i + 1] = t * b * secant[i];
    }
  }
  return tangent;
}

/**
 * 한 subpath 의 path 명령. `move` 가 true 면 `M` 으로 시작하고, false 면
 * 이미 찍힌 현재 점에서 이어 그린다 (area 의 아래 경계가 이 형태로 붙는다).
 */
export function curveCommands(
  points: readonly AxialPoint[],
  curve: ChartCurve,
  orientation: ChartOrientation,
  move: boolean,
): string {
  if (points.length === 0) return "";
  const screen = points.map((p) => toScreen(orientation, p));
  let d = move
    ? `M ${screen[0].x} ${screen[0].y}`
    : ` L ${screen[0].x} ${screen[0].y}`;
  if (points.length === 1) return d;

  if (curve === "step") {
    for (let i = 1; i < points.length; i++) {
      const mid = toScreen(orientation, {
        along: (points[i - 1].along + points[i].along) / 2,
        across: points[i - 1].across,
      });
      const midNext = toScreen(orientation, {
        along: (points[i - 1].along + points[i].along) / 2,
        across: points[i].across,
      });
      d += ` L ${mid.x} ${mid.y} L ${midNext.x} ${midNext.y} L ${screen[i].x} ${screen[i].y}`;
    }
    return d;
  }

  if (curve === "monotone") {
    const along = points.map((p) => p.along);
    const across = points.map((p) => p.across);
    const tangent = monotoneTangents(along, across);
    for (let i = 1; i < points.length; i++) {
      const dx = (along[i] - along[i - 1]) / 3;
      const c1 = toScreen(orientation, {
        along: along[i - 1] + dx,
        across: across[i - 1] + tangent[i - 1] * dx,
      });
      const c2 = toScreen(orientation, {
        along: along[i] - dx,
        across: across[i] - tangent[i] * dx,
      });
      d += ` C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${screen[i].x} ${screen[i].y}`;
    }
    return d;
  }

  for (let i = 1; i < points.length; i++) {
    d += ` L ${screen[i].x} ${screen[i].y}`;
  }
  return d;
}
