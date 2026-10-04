/**
 * ADR-194 — 스케일·tick. 외부 의존 0 (d3-scale/d3-array 미사용).
 *
 * `niceTicks` 는 d3-array `ticks` 의 tickIncrement 알고리즘을 재구현한 것이다 —
 * 같은 알고리즘이라야 사람이 예상하는 "1/2/5×10ⁿ" 눈금이 나오고, 두 consumer 가
 * 아니라 **기하 함수 하나**가 눈금을 정한다는 계약이 성립한다.
 */

/** 좌표를 소수 2자리로 고정 — DOM `d` 문자열과 Skia `PathShape.d` 의 byte 동일성 축. */
export function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 임의 값 → 유한 숫자 (숫자 문자열 허용). 불가면 null. */
export function toFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export interface LinearScale {
  (value: number): number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
}

/**
 * 선형 스케일. domain 폭이 0 이면 range 중앙으로 접는다 (0 나눗셈 금지 —
 * 단일값 데이터에서 NaN 좌표가 path 문자열로 새는 경로를 여기서 끊는다).
 */
export function linearScale(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  const mid = (r0 + r1) / 2;
  const fn = ((value: number) => {
    if (!Number.isFinite(value)) return mid;
    if (span === 0) return mid;
    return r0 + ((value - d0) / span) * (r1 - r0);
  }) as { (v: number): number; domain?: unknown; range?: unknown };
  Object.defineProperty(fn, "domain", { value: domain, enumerable: true });
  Object.defineProperty(fn, "range", { value: range, enumerable: true });
  return fn as LinearScale;
}

export interface BandScale {
  /** i 번째 범주 밴드의 시작 좌표 */
  at(index: number): number;
  /** 밴드 1개의 폭 */
  readonly bandwidth: number;
  /** 밴드 시작 간 간격 */
  readonly step: number;
  readonly count: number;
}

/**
 * 밴드 스케일 (범주 축). `paddingInner` 는 step 대비 간격 비율 (0~1).
 * 범주가 0개면 bandwidth 0 — 호출부가 empty scene 으로 갈린다.
 */
export function bandScale(
  count: number,
  range: readonly [number, number],
  paddingInner = 0.2,
): BandScale {
  const [r0, r1] = range;
  const width = r1 - r0;
  const n = Math.max(0, Math.floor(count));
  if (n === 0) {
    return { at: () => r0, bandwidth: 0, step: 0, count: 0 };
  }
  const step = width / n;
  const pad = Math.min(Math.max(paddingInner, 0), 0.95);
  const bandwidth = step * (1 - pad);
  const offset = (step - bandwidth) / 2;
  return {
    at: (index: number) => r0 + step * index + offset,
    bandwidth,
    step,
    count: n,
  };
}

const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);

/** d3-array `tickIncrement` — 음수면 1/|v| 이 step 이다. */
function tickIncrement(start: number, stop: number, count: number): number {
  const step = (stop - start) / Math.max(1, count);
  const power = Math.floor(Math.log10(step));
  const error = step / 10 ** power;
  const factor = error >= E10 ? 10 : error >= E5 ? 5 : error >= E2 ? 2 : 1;
  return power >= 0 ? factor * 10 ** power : -(10 ** -power) / factor;
}

export interface TickResult {
  /** 눈금에 맞춰 확장한 domain — 마크는 이 domain 위에 그린다 */
  domain: [number, number];
  ticks: number[];
}

/**
 * 값 축 눈금. 경계 4종을 전부 유한 결과로 접는다 (ADR-194 G2):
 * - 비수치/NaN → `[0, 1]`
 * - 단일값 v → v 를 포함하는 폭 있는 domain (v=0 이면 `[0,1]`)
 * - 음수 포함 → 0 을 지나는 domain
 * - count ≤ 0 → 양 끝 2개
 */
export function niceTicks(min: number, max: number, count = 5): TickResult {
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { domain: [0, 1], ticks: [0, 0.5, 1] };
  }
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);

  if (lo === hi) {
    if (lo === 0) return { domain: [0, 1], ticks: [0, 0.5, 1] };
    const magnitude = Math.abs(lo);
    lo = lo > 0 ? 0 : lo - magnitude;
    hi = lo === 0 ? magnitude : 0;
  }

  const n = Math.max(1, Math.floor(count));
  const step = tickIncrement(lo, hi, n);
  const inc = step > 0 ? step : -1 / step;
  const niceLo = Math.floor(lo / inc) * inc;
  const niceHi = Math.ceil(hi / inc) * inc;

  const ticks: number[] = [];
  // 부동소수 누적 오차로 마지막 눈금이 빠지는 것을 막으려 인덱스로 곱한다.
  const steps = Math.round((niceHi - niceLo) / inc);
  for (let i = 0; i <= steps; i++) {
    ticks.push(r2(niceLo + i * inc));
  }
  return { domain: [r2(niceLo), r2(niceHi)], ticks };
}

const TICK_FORMAT = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

/** 눈금 레이블 — locale 흔들림 없이 두 consumer 가 같은 문자열을 쓰도록 en-US 고정. */
export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return "";
  return TICK_FORMAT.format(value);
}

/**
 * 폰트 측정기 없이 쓰는 글자폭 근사 (fontSize 의 0.55배 × 글자 수).
 *
 * 실제 폰트 메트릭이 아니어도 **두 consumer 가 같은 근사를 쓰므로** 대칭은
 * 유지된다 — 이 값은 레이아웃 여백과 every-nth 솎아내기 판정에만 쓰이고,
 * 글자 자체는 각 렌더러가 자기 폰트로 그린다.
 */
export function approxTextWidth(text: string, fontSize: number): number {
  return r2(text.length * fontSize * 0.55);
}
