/**
 * ADR-216 — UTC 시간 interval (d3-time `interval.js` · `utc*.js` 규칙 이식, 외부 의존 0).
 *
 * interval 하나는 `floor` (경계로 내림) 와 `offset` (step 개 이동) 두 규칙로 정의되고
 * `ceil` · `range` · `every` 는 그 둘에서 파생된다 — 달력 단위 (월·연) 는 길이가 일정하지
 * 않아 "ms 나눗셈" 으로는 경계를 못 잡는다. **UTC 벌만** 옮긴다 (원천 §1.4): 로컬 시간대는
 * publish 열람 기기마다 결과가 달라 두 leg 대칭의 정의가 깨진다. DST 보정 0.
 *
 * `every(k)` 는 d3 와 같이 **필드의 배수** 로 거른다 (`utcDay.every(2)` 는 매월 1·3·5일 — 월이
 * 바뀌면 다시 시작, 눈금 표의 `unixDay` 는 epoch 일수라 끊기지 않는다). 이 규칙이 d3 오라클 (G1)
 * 의 대조 대상이다.
 */

export interface TimeInterval {
  /** `date` 를 경계로 내린 새 epoch (ms) */
  floor(t: number): number;
  /** `date` 를 경계로 올린 새 epoch — `floor(t) === t` 면 그대로 */
  ceil(t: number): number;
  /** step 개 이동 (음수 허용) */
  offset(t: number, step: number): number;
  /** `[start, stop)` 안의 경계 (오름차순, `start` 는 ceil) */
  range(start: number, stop: number, step?: number): number[];
  /** k 개마다 하나 — `k ≤ 0` · 비유한이면 null, `k ≤ 1` 이면 자기 자신 */
  every(k: number): TimeInterval | null;
}

type FloorFn = (d: Date) => void;
type OffsetFn = (d: Date, step: number) => void;
type FieldFn = (d: Date) => number;

function fromDate(d: Date): number {
  return d.getTime();
}

function newInterval(
  floori: FloorFn,
  offseti: OffsetFn,
  field?: FieldFn,
  everyi?: (k: number) => TimeInterval,
): TimeInterval {
  const floor = (t: number): number => {
    const d = new Date(t);
    floori(d);
    return fromDate(d);
  };
  const offset = (t: number, step: number): number => {
    const d = new Date(t);
    offseti(d, step);
    return fromDate(d);
  };
  const interval: TimeInterval = {
    floor,
    // d3 `interval.ceil`: floor(t − 1) → offset +1 → floor. `t` 가 이미 경계면 그대로다.
    ceil: (t) => floor(offset(floor(t - 1), 1)),
    offset,
    range: (start, stop, step = 1) => {
      const out: number[] = [];
      let t = interval.ceil(start);
      const s = Math.floor(step) || 1;
      if (!(t < stop) || !(s > 0)) return out;
      let previous: number;
      do {
        out.push(t);
        previous = t;
        t = floor(offset(t, s));
      } while (previous < t && t < stop);
      return out;
    },
    every: (k) => {
      const step = Math.floor(k);
      if (!Number.isFinite(step) || !(step > 0)) return null;
      if (!(step > 1)) return interval;
      if (everyi) return everyi(step);
      if (!field) return null;
      return filterInterval(interval, (d) => field(d) % step === 0);
    },
  };
  return interval;
}

/**
 * d3 `interval.filter` — `test` 를 통과하는 경계만 남긴다. floor 는 1 ms 씩 물러나며
 * 재-floor, offset 은 1 씩 이동하며 test 를 만족할 때까지 반복 (d3 와 같은 걸음).
 */
function filterInterval(
  base: TimeInterval,
  test: (d: Date) => boolean,
): TimeInterval {
  const passes = (t: number): boolean => test(new Date(t));
  return newInterval(
    (d) => {
      let t = base.floor(fromDate(d));
      while (!passes(t)) t = base.floor(t - 1);
      d.setTime(t);
    },
    (d, step) => {
      let t = fromDate(d);
      if (step < 0) {
        while (++step <= 0) {
          do t = base.offset(t, -1);
          while (!passes(t));
        }
      } else {
        while (--step >= 0) {
          do t = base.offset(t, 1);
          while (!passes(t));
        }
      }
      d.setTime(t);
    },
  );
}

export const DURATION_SECOND = 1000;
export const DURATION_MINUTE = 60_000;
export const DURATION_HOUR = 3_600_000;
export const DURATION_DAY = 86_400_000;
export const DURATION_WEEK = 604_800_000;
/** d3 `durationMonth` — 30일 (눈금 표 정렬용 근사, 달력 이동은 `offset` 이 한다) */
export const DURATION_MONTH = 2_592_000_000;
/** d3 `durationYear` — 365일 (같은 용도) */
export const DURATION_YEAR = 31_536_000_000;

export const millisecond: TimeInterval = newInterval(
  () => {},
  (d, step) => d.setTime(fromDate(d) + step),
  undefined,
  (k) =>
    newInterval(
      (d) => d.setTime(Math.floor(fromDate(d) / k) * k),
      (d, step) => d.setTime(fromDate(d) + step * k),
    ),
);

export const utcSecond: TimeInterval = newInterval(
  (d) => d.setTime(fromDate(d) - d.getUTCMilliseconds()),
  (d, step) => d.setTime(fromDate(d) + step * DURATION_SECOND),
  (d) => d.getUTCSeconds(),
);

export const utcMinute: TimeInterval = newInterval(
  (d) => d.setUTCSeconds(0, 0),
  (d, step) => d.setTime(fromDate(d) + step * DURATION_MINUTE),
  (d) => d.getUTCMinutes(),
);

export const utcHour: TimeInterval = newInterval(
  (d) => d.setUTCMinutes(0, 0, 0),
  (d, step) => d.setTime(fromDate(d) + step * DURATION_HOUR),
  (d) => d.getUTCHours(),
);

export const utcDay: TimeInterval = newInterval(
  (d) => d.setUTCHours(0, 0, 0, 0),
  (d, step) => d.setUTCDate(d.getUTCDate() + step),
  (d) => d.getUTCDate() - 1,
);

/**
 * d3 `unixDay` — floor/offset 은 `utcDay` 와 같고 `every(k)` 의 필드만 **epoch 일수** 다
 * (`utcDay` 는 `getUTCDate() − 1` 이라 월마다 다시 시작). d3 `utcTicks` 의 일 단위는 이것을 쓴다
 * — `day.every(2)` 눈금이 월 경계에서 끊기지 않는다.
 */
export const unixDay: TimeInterval = newInterval(
  (d) => d.setUTCHours(0, 0, 0, 0),
  (d, step) => d.setUTCDate(d.getUTCDate() + step),
  (d) => Math.floor(fromDate(d) / DURATION_DAY),
);

/** 일요일 시작 주 (d3 `utcSunday` = `utcWeek`) */
export const utcWeek: TimeInterval = newInterval(
  (d) => {
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    d.setUTCHours(0, 0, 0, 0);
  },
  (d, step) => d.setUTCDate(d.getUTCDate() + step * 7),
);

export const utcMonth: TimeInterval = newInterval(
  (d) => {
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
  },
  (d, step) => d.setUTCMonth(d.getUTCMonth() + step),
  (d) => d.getUTCMonth(),
);

export const utcYear: TimeInterval = newInterval(
  (d) => {
    d.setUTCMonth(0, 1);
    d.setUTCHours(0, 0, 0, 0);
  },
  (d, step) => d.setUTCFullYear(d.getUTCFullYear() + step),
  (d) => d.getUTCFullYear(),
  // d3 `utcYear.every(k)` — 연도를 k 의 배수로 내린다 (필드 filter 가 아니라 직접 계산).
  (k) =>
    newInterval(
      (d) => {
        d.setUTCFullYear(Math.floor(d.getUTCFullYear() / k) * k);
        d.setUTCMonth(0, 1);
        d.setUTCHours(0, 0, 0, 0);
      },
      (d, step) => d.setUTCFullYear(d.getUTCFullYear() + step * k),
    ),
);

/** 하루 안 일련일 (`%j`) — `utcDay.count(utcYear(d), d)` 와 같은 값. */
export function utcDayOfYear(t: number): number {
  return Math.floor((utcDay.floor(t) - utcYear.floor(t)) / DURATION_DAY) + 1;
}
