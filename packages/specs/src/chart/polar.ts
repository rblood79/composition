/**
 * ADR-207 — 극좌표 스케일. 직교 축의 `bandScale` / `linearScale` 에 대응한다.
 *
 * 각도 규약은 pie 가 이미 정한 것을 그대로 쓴다 — **12시 = 0°, 시계 방향**.
 * `marks/pie.ts` 의 지역 `polar()` 를 여기로 올리고 pie 가 이 함수를 재사용하므로
 * 두 극좌표 계열(파이·radar/radial)의 각도 원점이 갈릴 수 없다.
 *
 * 반지름은 **항상 0 이상**이다 (R2). 직교 값 축은 음수를 축 아래로 그릴 수 있지만
 * 극좌표에서 음수 반지름은 도형을 중심 반대편으로 뒤집어 버린다 — 그래서 스케일
 * 자체가 안쪽 반지름으로 clamp 한다. NaN/Infinity 도 같은 자리로 접어 `d` 문자열에
 * 비수치가 새지 않게 한다 (G2 의 "d 에 NaN/Infinity 0건").
 */
import { r2 } from "./scales";

export interface AngleScale {
  (index: number): number;
  /** 범주 1개가 차지하는 각도 */
  readonly step: number;
  readonly count: number;
  readonly start: number;
  readonly sweep: number;
}

/**
 * 범주 i → 각도(도). `bandScale` 의 극좌표 대응이되 **패딩이 없다** — 다각형의
 * 꼭짓점은 밴드 중앙이 아니라 범주 그 자체의 방향이라야 스포크와 겹친다.
 */
export function angleScale(count: number, start = 0, sweep = 360): AngleScale {
  const n = Math.max(0, Math.floor(count));
  // 규칙은 하나다 — `sweep / n`. 한 바퀴면 마지막 범주가 첫 범주 자리로 겹치지
  //   않고, 부분 sweep 이면 각 범주가 같은 크기의 호를 차지한다 (`bandScale` 이
  //   step 을 `width / n` 로 두는 것과 같은 규약). 예외를 두면 radar 와 radial 이
  //   서로 다른 각도 원점을 갖게 된다.
  const step = n === 0 ? 0 : sweep / n;
  const fn = ((index: number) => r2(start + step * index)) as {
    (i: number): number;
    step?: unknown;
    count?: unknown;
    start?: unknown;
    sweep?: unknown;
  };
  Object.defineProperty(fn, "step", { value: r2(step), enumerable: true });
  Object.defineProperty(fn, "count", { value: n, enumerable: true });
  Object.defineProperty(fn, "start", { value: start, enumerable: true });
  Object.defineProperty(fn, "sweep", { value: sweep, enumerable: true });
  return fn as AngleScale;
}

export interface RadiusScale {
  (value: number): number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
}

/**
 * 값 → 반지름. `range` 는 `[안쪽, 바깥]` 이며 결과는 그 구간으로 clamp 된다.
 * domain 폭이 0 이면 바깥 반지름으로 접는다 (단일값 데이터가 점으로 사라지지 않게).
 */
export function radiusScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): RadiusScale {
  // **domain 하한을 0 으로 clamp** (R2). 극좌표에는 "축 아래" 가 없다 — 음수 값을
  //   domain 에 남겨 두면 0 이 안쪽 반지름이 아닌 자리에 놓여 도형이 중심을 비운다.
  const d0 = Math.max(0, domain[0]);
  const d1 = Math.max(d0, domain[1]);
  const [inner, outer] = range;
  const lo = Math.max(0, Math.min(inner, outer));
  const hi = Math.max(0, Math.max(inner, outer));
  const span = d1 - d0;
  const fn = ((value: number) => {
    if (!Number.isFinite(value)) return r2(lo);
    if (span === 0) return r2(hi);
    const t = (value - d0) / span;
    return r2(lo + Math.min(1, Math.max(0, t)) * (hi - lo));
  }) as { (v: number): number; domain?: unknown; range?: unknown };
  Object.defineProperty(fn, "domain", { value: domain, enumerable: true });
  Object.defineProperty(fn, "range", { value: range, enumerable: true });
  return fn as RadiusScale;
}

export interface PolarPoint {
  x: number;
  y: number;
}

/** 극좌표 → 화면 좌표. 12시 = 0°, 시계 방향. */
export function polarPoint(
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
): PolarPoint {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return {
    x: r2(cx + radius * Math.cos(radians)),
    y: r2(cy + radius * Math.sin(radians)),
  };
}

/**
 * 정다각형 격자 (radar `gridType="polygon"`). 꼭짓점이 `angleScale` 과 같은
 * 방향에 오도록 `start` 를 그대로 받는다.
 */
export function polygonPath(
  cx: number,
  cy: number,
  radius: number,
  count: number,
  start = 0,
  sweep = 360,
): string {
  const n = Math.floor(count);
  if (radius <= 0 || n < 3) return "";
  const angle = angleScale(n, start, sweep);
  let d = "";
  for (let i = 0; i < n; i++) {
    const p = polarPoint(cx, cy, radius, angle(i));
    d += i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`;
  }
  return `${d} Z`;
}

/** 원형 격자 (radar `gridType="circle"`) — 반원 2개 (`A` 는 시작=끝이면 사라진다). */
export function circlePathAt(cx: number, cy: number, radius: number): string {
  if (radius <= 0) return "";
  const r = r2(radius);
  const top = polarPoint(cx, cy, radius, 0);
  const bottom = polarPoint(cx, cy, radius, 180);
  return `M ${top.x} ${top.y} A ${r} ${r} 0 1 1 ${bottom.x} ${bottom.y} A ${r} ${r} 0 1 1 ${top.x} ${top.y} Z`;
}
