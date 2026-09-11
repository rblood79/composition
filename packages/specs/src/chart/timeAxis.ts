/**
 * ADR-216 — 시간 스케일의 축 모델 (두 leg 가 같이 읽는다).
 *
 * x 는 새 스케일 종류가 아니라 **epoch 위의 `linearScale`** 이다 (원천 §2.1 — d3 time scale 도
 * continuous 위에 Date ↔ number 변환뿐). 마크 빌더 (`marks/line.ts` · `marks/area.ts`) 는
 * `BandScale` 인터페이스 (`at/bandwidth/step/count`) 만 읽으므로, epoch 위치를 같은 인터페이스로
 * 넘기면 (`positionBand`) 마크 코드 변경 0 으로 시간 간격이 된다.
 *
 * 눈금 · 2단 라벨은 모델 층에서 한 번 계산해 (`resolveTimeAxisModel`) scene 과 DOM 이 같은
 * 값을 복사한다 — 눈금 수는 축 픽셀 ÷ 라벨 폭 (`timeTickCount`) 으로 두 leg 가 같은 입력에서
 * 같은 답을 낸다.
 */
import { linearScale, r2 } from "./scales";
import type { BandScale, LinearScale } from "./scales";
import type { SeriesGrid } from "./series";
import { niceTime, timeTicks } from "./timeTicks";
import type { TimeGranularity } from "./timeTicks";
import { formatTime, resolveTimeLocale, timeLabelFormats } from "./timeFormat";
import type { TimeLocale } from "./timeFormat";
import {
  utcDay,
  utcMinute,
  utcMonth,
  utcSecond,
  utcYear,
} from "./timeIntervals";
import type { TimeInterval } from "./timeIntervals";
import type { ResolvedChartPresentation } from "./presentation";

export interface TimeTickLabel {
  /** 눈금 epoch */
  t: number;
  /** 눈금 라벨 (RSC secondary — 작은 단위) */
  tick: string;
  /** 경계 라벨 (RSC primary — 큰 단위 경계에만, 아니면 null). `dimensionLabelFormat` 이면 항상 null. */
  boundary: string | null;
}

export interface ChartTimeAxisModel {
  /** `niceTime` 으로 넓힌 epoch domain — x `linearScale` 의 domain */
  domain: [number, number];
  granularity: TimeGranularity;
  labels: TimeTickLabel[];
  /** 2단 (경계 라벨 행이 있는가) — layout 의 하단 여백이 읽는다 */
  twoTier: boolean;
}

/** 라벨 한 칸의 대략 폭 (글자 8 × 0.55em) — 눈금 수 = 축 px ÷ 이 값, 2 ~ 12 로 clamp. */
export function timeTickCount(axisPx: number, fontSize: number): number {
  const slot = Math.max(1, fontSize * 0.55 * 8);
  return Math.min(12, Math.max(2, Math.floor(axisPx / slot)));
}

/** granularity 의 한 단계 위 interval — 이 경계에 놓인 눈금이 primary (경계) 라벨을 받는다. */
export function timeBoundaryInterval(
  granularity: TimeGranularity,
): TimeInterval | null {
  switch (granularity) {
    case "millisecond":
      return utcSecond;
    case "second":
      return utcMinute;
    case "minute":
    case "hour":
      return utcDay;
    case "day":
    case "week":
      return utcMonth;
    case "month":
      return utcYear;
    case "year":
      return null;
  }
}

/**
 * 시간 스케일이 2단 라벨을 쓰는가 — `dimensionLabelFormat` 이 없을 때. layout 은 눈금을 알기 전에
 * 여백을 정해야 하므로 (plot → count → 눈금의 순환 차단) granularity 와 무관하게 이 값만 읽는다.
 */
export function timeAxisTwoTier(
  presentation: Pick<ResolvedChartPresentation, "dimension">,
): boolean {
  return (
    presentation.dimension.scale === "time" &&
    presentation.dimension.labelFormat === undefined
  );
}

/**
 * transformed 격자의 epoch 범위 → domain · 눈금 · 라벨. 집계 격자는 bucket `[t0, t1]` 의 `t1` 까지
 * domain 에 넣는다 (마지막 bucket 의 끝이 잘리지 않게).
 */
export function resolveTimeAxisModel(
  grid: Pick<SeriesGrid, "positions" | "positionRanges">,
  axisPx: number,
  fontSize: number,
  presentation: Pick<ResolvedChartPresentation, "dimension" | "numberFormat">,
): ChartTimeAxisModel | null {
  const positions = grid.positions;
  if (!positions || positions.length === 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const t of positions) {
    if (t < min) min = t;
    if (t > max) max = t;
  }
  if (grid.positionRanges) {
    for (const [, t1] of grid.positionRanges) if (t1 > max) max = t1;
  }
  const count = timeTickCount(axisPx, fontSize);
  const domain = niceTime(min, max, count);
  const ticks = timeTicks(domain[0], domain[1], count);
  const locale: TimeLocale = resolveTimeLocale(
    presentation.numberFormat.locale,
  );
  const labelFormat = presentation.dimension.labelFormat;
  const formats = timeLabelFormats(ticks.granularity);
  const boundary = labelFormat ? null : timeBoundaryInterval(ticks.granularity);
  const labels: TimeTickLabel[] = ticks.ticks.map((t) => ({
    t,
    tick: formatTime(labelFormat ?? formats.tick, t, locale),
    boundary:
      boundary && formats.boundary && boundary.floor(t) === t
        ? formatTime(formats.boundary, t, locale)
        : null,
  }));
  return {
    domain,
    granularity: ticks.granularity,
    labels,
    twoTier: labelFormat === undefined,
  };
}

/**
 * epoch 위치 → `BandScale` 어댑터. `at(i)` 가 점의 좌표 (bandwidth 0 이라 `bandCenter` 도 같은
 * 값), `step` 은 축 길이 ÷ n (라벨 stride · tooltip 밴드 폭의 근사 — 시간축은 자체 눈금을 쓴다).
 */
export function positionBand(
  positions: readonly number[],
  scale: LinearScale,
): BandScale {
  const n = positions.length;
  const [r0, r1] = scale.range;
  return {
    at: (index) => r2(scale(positions[index] ?? NaN)),
    bandwidth: 0,
    step: n > 0 ? Math.abs(r1 - r0) / n : 0,
    count: n,
  };
}

/** 두 leg 공용 — 시간 모델이 있으면 epoch band, 없으면 호출자의 등간격 band. */
export function timeScaleFor(
  time: Pick<ChartTimeAxisModel, "domain">,
  range: readonly [number, number],
): LinearScale {
  return linearScale(time.domain, range);
}
