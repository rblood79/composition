/**
 * ADR-216 — 시간 눈금 (d3-time `ticks.js` + d3-array `tickStep` 규칙 이식, 외부 의존 0).
 *
 * 18 단 표 (1초 … 1년) 에서 목표 간격 (`span / count`) 에 **비율로 가장 가까운** 단을 고르고,
 * 표 밖 (1년 초과) 은 연 단위 1·2·5 규칙, 표 아래 (1초 미만) 는 ms 단위 1·2·5 규칙이다.
 * 눈금은 interval 경계 (자정 · 월초 · 연초) 에 붙는다 — 값 축 `niceTicks` 가 1·2·5×10ⁿ 에
 * 붙는 것의 달력판. `stop` 을 **포함** 한다 (d3 `interval.range(start, +stop + 1)`).
 */
import {
  DURATION_DAY,
  DURATION_HOUR,
  DURATION_MINUTE,
  DURATION_MONTH,
  DURATION_SECOND,
  DURATION_WEEK,
  DURATION_YEAR,
  millisecond,
  unixDay,
  utcDay,
  utcHour,
  utcMinute,
  utcMonth,
  utcSecond,
  utcWeek,
  utcYear,
} from "./timeIntervals";
import type { TimeInterval } from "./timeIntervals";

/** 눈금 단위 이름 — 2단 라벨 표 (`timeFormat.ts`) 가 이 값으로 형식을 고른다. */
export type TimeGranularity =
  | "millisecond"
  | "second"
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "year";

interface TickEntry {
  interval: TimeInterval;
  granularity: TimeGranularity;
  step: number;
  duration: number;
}

const TICK_INTERVALS: readonly TickEntry[] = [
  [utcSecond, "second", 1, DURATION_SECOND],
  [utcSecond, "second", 5, 5 * DURATION_SECOND],
  [utcSecond, "second", 15, 15 * DURATION_SECOND],
  [utcSecond, "second", 30, 30 * DURATION_SECOND],
  [utcMinute, "minute", 1, DURATION_MINUTE],
  [utcMinute, "minute", 5, 5 * DURATION_MINUTE],
  [utcMinute, "minute", 15, 15 * DURATION_MINUTE],
  [utcMinute, "minute", 30, 30 * DURATION_MINUTE],
  [utcHour, "hour", 1, DURATION_HOUR],
  [utcHour, "hour", 3, 3 * DURATION_HOUR],
  [utcHour, "hour", 6, 6 * DURATION_HOUR],
  [utcHour, "hour", 12, 12 * DURATION_HOUR],
  [unixDay, "day", 1, DURATION_DAY],
  [unixDay, "day", 2, 2 * DURATION_DAY],
  [utcWeek, "week", 1, DURATION_WEEK],
  [utcMonth, "month", 1, DURATION_MONTH],
  [utcMonth, "month", 3, 3 * DURATION_MONTH],
  [utcYear, "year", 1, DURATION_YEAR],
].map(([interval, granularity, step, duration]) => ({
  interval: interval as TimeInterval,
  granularity: granularity as TimeGranularity,
  step: step as number,
  duration: duration as number,
}));

const E10 = Math.sqrt(50);
const E5 = Math.sqrt(10);
const E2 = Math.sqrt(2);

/** d3-array `tickStep` — 1·2·5×10ⁿ 중 목표 간격에 가장 가까운 것 (항상 양수). */
export function tickStep(start: number, stop: number, count: number): number {
  const step0 = Math.abs(stop - start) / Math.max(0, count);
  let step1 = 10 ** Math.floor(Math.log(step0) / Math.LN10);
  const error = step0 / step1;
  if (error >= E10) step1 *= 10;
  else if (error >= E5) step1 *= 5;
  else if (error >= E2) step1 *= 2;
  return step1;
}

export interface TimeTickInterval {
  interval: TimeInterval;
  granularity: TimeGranularity;
  /** 단 안의 배수 (초 5 · 시 3 · 연 10 …) */
  step: number;
}

/**
 * d3 `tickInterval` — 표에서 `target = |stop − start| / count` 보다 큰 첫 단 `i` 를 찾고
 * (bisect right), `i − 1` 과 `i` 중 **비율** 이 가까운 쪽을 고른다. 표 밖은 연/ms 1·2·5.
 */
export function timeTickInterval(
  start: number,
  stop: number,
  count: number,
): TimeTickInterval | null {
  const target = Math.abs(stop - start) / count;
  let i = 0;
  while (i < TICK_INTERVALS.length && TICK_INTERVALS[i].duration <= target) i++;
  if (i === TICK_INTERVALS.length) {
    const step = tickStep(start / DURATION_YEAR, stop / DURATION_YEAR, count);
    const interval = utcYear.every(step);
    return interval ? { interval, granularity: "year", step } : null;
  }
  if (i === 0) {
    const step = Math.max(tickStep(start, stop, count), 1);
    const interval = millisecond.every(step);
    return interval ? { interval, granularity: "millisecond", step } : null;
  }
  const entry =
    target / TICK_INTERVALS[i - 1].duration <
    TICK_INTERVALS[i].duration / target
      ? TICK_INTERVALS[i - 1]
      : TICK_INTERVALS[i];
  const interval = entry.interval.every(entry.step);
  return interval
    ? { interval, granularity: entry.granularity, step: entry.step }
    : null;
}

export interface TimeTickResult {
  /** 눈금 epoch (오름차순, `stop` 포함) */
  ticks: number[];
  granularity: TimeGranularity;
  step: number;
}

/** d3 `utcTicks(start, stop, count)` — `stop` 포함, `count` 는 대략의 개수. */
export function timeTicks(
  start: number,
  stop: number,
  count: number,
): TimeTickResult {
  const reverse = stop < start;
  const [lo, hi] = reverse ? [stop, start] : [start, stop];
  const picked = timeTickInterval(lo, hi, count);
  if (!picked) return { ticks: [], granularity: "millisecond", step: 1 };
  const ticks = picked.interval.range(lo, hi + 1);
  return {
    ticks: reverse ? ticks.reverse() : ticks,
    granularity: picked.granularity,
    step: picked.step,
  };
}

/**
 * d3-scale `scale.nice(count)` — 눈금 interval 로 domain 을 `[floor(min), ceil(max)]` 로 넓힌다.
 * 값 축 `niceTicks` 의 `[niceLo, niceHi]` 와 같은 자리. 폭 0 (단일 시각) 은 하루로 넓힌다 —
 * 단일값 데이터에서 NaN 좌표가 새는 경로를 여기서 끊는다 (`linearScale` 의 0 나눗셈 방어와 짝).
 */
export function niceTime(
  min: number,
  max: number,
  count: number,
): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, DURATION_DAY];
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (lo === hi) {
    lo = utcDay.floor(lo);
    hi = utcDay.offset(lo, 1);
  }
  const picked = timeTickInterval(lo, hi, count);
  if (!picked) return [lo, hi];
  return [picked.interval.floor(lo), picked.interval.ceil(hi)];
}
