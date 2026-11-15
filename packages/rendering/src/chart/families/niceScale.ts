/**
 * ztd-charts 0.5.0 축 범위 함수의 이식 — `packages/ztd-charts/src/core/scale.ts` (`niceStep` ·
 * `fitDomain` · `niceDomain` · `ticksFor`).
 *
 * 출처: https://github.com/Junhan2/ztd-charts `3c4376cda61361d630ae4cc7bd472af64ba30d2e`
 * MIT License — Copyright (c) Junhan2 and contributors. 원본 식을 그대로 옮겼다 (이름 · 기본값 유지).
 *
 * 시리즈 경로의 `niceTicks` (d3 `tickIncrement`) 와 다른 규칙이다 — family 는 ztd 종류의 뜻
 * (bullet 의 행 최댓값 · dumbbell 의 값 + 여유 범위) 을 따른다.
 */

export function niceStep(span: number, count: number): number {
  if (!(span > 0) || !Number.isFinite(span)) return 1;
  const raw = span / Math.max(1, count);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  // 1·2·5 단계로 끊는 경계 (√50, √10, √2)
  const k = m >= 7.071 ? 10 : m >= 3.162 ? 5 : m >= 1.414 ? 2 : 1;
  return k * p;
}

/** 끝이 눈금에 가까우면 눈금까지, 멀면 값 + 여유만큼만 넓힌다 (빈 눈금 칸이 생기지 않게). */
export function fitDomain(
  min: number,
  max: number,
  count = 4,
  opts: { zero?: boolean; pad?: number } = {},
): [number, number] {
  let lo = min;
  let hi = max;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (opts.zero !== false) {
    if (lo > 0) lo = 0;
    if (hi < 0) hi = 0;
  }
  if (lo === hi)
    return lo === 0 ? [0, 1] : lo > 0 ? [0, lo * 1.2] : [lo * 1.2, 0];
  const span = hi - lo;
  const pad = opts.pad ?? 0.07;
  let step = niceStep(span, count);
  let d: [number, number] = [lo, hi];
  for (let k = 0; k < 4; k++) {
    const nHi = Math.ceil(hi / step - 1e-9) * step;
    const nLo = Math.floor(lo / step + 1e-9) * step;
    d = [
      lo === 0 ? 0 : lo - nLo <= step * 0.3 ? nLo : lo - span * pad,
      hi === 0 ? 0 : nHi - hi <= step * 0.3 ? nHi : hi + span * pad,
    ];
    const s = niceStep(d[1] - d[0], count);
    if (s === step) break;
    step = s;
  }
  return d;
}

/** 눈금이 깔끔하게 떨어지도록 범위를 넓힌다. */
export function niceDomain(
  min: number,
  max: number,
  count = 4,
  opts: { zero?: boolean } = {},
): [number, number] {
  let lo = min;
  let hi = max;
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (opts.zero !== false) {
    if (lo > 0) lo = 0;
    if (hi < 0) hi = 0;
  }
  if (lo === hi)
    return lo === 0 ? [0, 1] : lo > 0 ? [0, lo * 1.25] : [lo * 1.25, 0];
  const s = niceStep(hi - lo, count);
  return [Math.floor(lo / s + 1e-9) * s, Math.ceil(hi / s - 1e-9) * s];
}

export function ticksFor(d0: number, d1: number, count = 4): number[] {
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  const s = niceStep(hi - lo, count);
  const out: number[] = [];
  const start = Math.ceil(lo / s - 1e-9) * s;
  for (let v = start, i = 0; v <= hi + s * 1e-9 && i < 200; v += s, i++)
    out.push(Number((Math.round(v / s) * s).toPrecision(12)));
  return out;
}
