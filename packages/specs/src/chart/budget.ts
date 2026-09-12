/**
 * ADR-211 — 차트 표시 예산 (breakdown §2 · §3).
 *
 * 세 예산을 가른다: **슬롯 `fit`** (예산 축 픽셀 / 최소 슬롯 간격 — 범주를 몇 개까지
 * 두는가), **요소 마크 `M`** (rect · 조각 · 점 · 링 · dot · 값 라벨 총수), **경로 점 `P`**
 * (line/area 의 `S × 슬롯`). 마크 비용이 종류마다 20배 다르다 (P0: rect 0.085 ms/개,
 * line path 점 20,000 에 123ms) 라 `M` 과 `P` 를 하나로 두면 line 이 10px 에 1점으로
 * 깎이거나 bar 가 200ms 를 넘는다.
 *
 * 순수 함수다 — Recharts import 0, 입력이 같으면 두 leg 가 같은 값에 이른다. 두 leg 가
 * 갈리는 입력은 `size` (Compare Mode 반폭) 와 창 `start` (Canvas 0 · DOM 뷰 상태) 뿐이다.
 * 최소 크기 (pie 의 작은 조각 호 0.377px 등) 는 **보장하지 않는다** — 값 비중으로 묶으면
 * 데이터 의미가 바뀐다 (`[1000, 1]` 은 조각 2개가 정답).
 */
import type { SeriesGrid, SeriesData } from "./series";
import type {
  ChartBudgetAggregate,
  ChartBudgetAxis,
  ChartBudgetOverflow,
  ChartDiagnostic,
  ChartMetrics,
  ChartProps,
  ChartType,
  Rect,
} from "./types";

/** `ChartMetrics` 의 예산 부분 — rule chart 채널 `budget` 이 덮는다. */
export type ChartBudgetMetrics = Pick<
  ChartMetrics,
  | "minSlot"
  | "minPointGap"
  | "minArc"
  | "minAxisGap"
  | "minRing"
  | "markBudget"
  | "pointBudget"
  | "rowCap"
  | "windowTrackHeight"
>;

/**
 * P0 확정값 (`docs/adr/evidence/211-p0-spike.md`, 2026-09-10). light/dark 실측이 같아
 * 테마 채널이 아니라 상수다.
 * - `minSlot 8`: S1 막대 5.98px + 틈 1.5px (step 7) 부터 개수가 정확 — 여유 1.
 * - `minPointGap 3`: 2px 는 zigzag 진폭이 1/3 로 접힌다.
 * - `minArc 5`: 4.3px 에서 200/200 — 바닥 4.3.
 * - `minAxisGap 12`: 스포크는 4px 부터 갈리나 라벨 가독성 축으로 설계값 유지.
 * - `minRing 5`: `RING_GAP 3` + 두께 2 에서 27/27, 4 는 32/33.
 * - `markBudget 800` = ADR-210 W800 (800 rect → 75ms) 과 같은 작업량 → G4 ≤100ms.
 * - `pointBudget 5,000`: line 5,000 점 ≈ 30ms 대.
 * - `rowCap 20,000`: 20k행 × S4 모델 12–15ms p50 + 극값 8ms; 50k 는 line path 120ms.
 * - `windowTrackHeight 24`: Preview `.react-aria-Slider` 상자 12 · md thumb 18 이 밖으로 넘친다.
 */
export const CHART_BUDGET_DEFAULTS: ChartBudgetMetrics = {
  minSlot: 8,
  minPointGap: 3,
  minArc: 5,
  minAxisGap: 12,
  minRing: 5,
  markBudget: 800,
  pointBudget: 5000,
  rowCap: 20000,
  windowTrackHeight: 24,
};

/**
 * rule 채널 `budget` (부분) 을 기본값 위에 얹는다 — 키별 검사라 명시 `undefined` 가 기본값을
 * 지우지 못한다 (스프레드는 `{ minSlot: undefined }` 를 그대로 덮어 `fit` 이 NaN → 0 이 된다).
 */
export function mergeBudgetMetrics(
  override: Partial<ChartBudgetMetrics> | undefined,
  defaults: ChartBudgetMetrics = CHART_BUDGET_DEFAULTS,
): ChartBudgetMetrics {
  const out = { ...defaults };
  if (!override) return out;
  for (const key of Object.keys(defaults) as Array<keyof ChartBudgetMetrics>) {
    const v = override[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

/** 넘칠 때 실제로 적용하는 처리 (`auto` 가 풀린 뒤). */
export type ChartBudgetMode = Exclude<ChartBudgetOverflow, "auto">;

/**
 * `fit` 이 읽는 기하. 직교는 `plot` + 방향, 극좌표는 반지름 (+ radial 의 sweep).
 * 반지름은 scene 이 쓰는 그 값이어야 한다 (`polarGeometry`) — 예산이 다른 반지름을
 * 가정하면 두 leg 가 같아도 그림과 예산이 어긋난다.
 */
export interface ChartBudgetGeometry {
  plot: Rect;
  horizontal: boolean;
  radius?: { outer: number; inner: number };
  /** 값 호가 도는 각도 범위 (도). 미지정 360. */
  sweep?: number;
}

/**
 * 극좌표 반지름 — `computePolarScene` · `buildPieMarks` 와 **같은 식** 을 한 곳에 둔다.
 * pie 는 plot 내접 반지름 그대로, radar 는 바깥 레이블 자리 (`fontSize × 2.2`) 를,
 * radial 은 `fontSize × 0.5` 를 뺀다. `inner` 는 `innerRadius` (0~90%) 비율.
 */
export function polarGeometry(
  kind: ChartType,
  plot: Rect,
  fontSize: number,
  props: Pick<ChartProps, "showAxis" | "innerRadius">,
): { outer: number; inner: number } {
  const half = Math.min(plot.w, plot.h) / 2;
  const labelRoom =
    kind === "pie"
      ? 0
      : kind === "radar" && props.showAxis
        ? fontSize * 2.2
        : fontSize * 0.5;
  const outer = half - labelRoom;
  const ratio = Math.min(90, Math.max(0, props.innerRadius)) / 100;
  return { outer, inner: outer * ratio };
}

/** radial 의 sweep — `endAngle − startAngle`, 0 이하·360 초과는 한 바퀴 (`marks/radial.ts`). */
export function budgetSweep(
  kind: ChartType,
  props: Pick<ChartProps, "startAngle" | "endAngle">,
): number {
  if (kind !== "radial") return 360;
  const raw = props.endAngle - props.startAngle;
  return raw <= 0 || raw > 360 || !Number.isFinite(raw) ? 360 : raw;
}

/**
 * §2.2 — 슬롯 예산 `fit`. 예산 축 / 최소 단위, 내림.
 * - bar: 묶음(dodged) 은 `S` 슬롯이 한 범주에 나란히 → `minSlot × S`; 누적/expand 는 `minSlot`.
 * - line/area: 범주 축 길이 / `minPointGap` (horizontal 이면 `plot.h`).
 * - pie: 바깥 둘레 / `minArc` — **범주(조각) 수만**. 동심 링 (시리즈) 은 대상이 아니다.
 * - radar: 둘레 / `minAxisGap` (축 간 호).
 * - radial: 링 두께 `(outer − inner) / minRing`.
 * 기하가 0 이하면 0 (진단 `plot-too-small` 은 호출자가).
 */
export function slotFit(
  kind: ChartType,
  geometry: ChartBudgetGeometry,
  series: number,
  stacked: boolean,
  units: Pick<
    ChartBudgetMetrics,
    | "minSlot"
    | "minPointGap"
    | "minArc"
    | "minAxisGap"
    | "minRing"
    | "pointBudget"
  >,
): number {
  const S = Math.max(1, series);
  const axis = geometry.horizontal ? geometry.plot.h : geometry.plot.w;
  const sweep = geometry.sweep ?? 360;
  const outer = geometry.radius?.outer ?? 0;
  const inner = geometry.radius?.inner ?? 0;
  const circumference = (2 * Math.PI * outer * sweep) / 360;
  let raw: number;
  switch (kind) {
    case "bar":
      raw = axis / (stacked ? units.minSlot : units.minSlot * S);
      break;
    case "line":
    case "area":
      raw = axis / units.minPointGap;
      break;
    case "pie":
      raw = circumference / units.minArc;
      break;
    case "radar":
      raw = circumference / units.minAxisGap;
      break;
    case "radial":
      raw = (outer - inner) / units.minRing;
      break;
    case "scatter":
      // ADR-217 — 슬롯 = 점: 점은 겹쳐도 되므로 px 간격 제약이 없다. 예산 P 가 곧 슬롯 수 (HC9).
      raw = units.pointBudget;
      break;
    default:
      // R7 — 신규 chartType 이 조용히 예산 0 으로 통과하지 않게 (scene 의 assertNever 와 같은 방어선).
      throw new Error(`unhandled chartType: ${String(kind)}`);
  }
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

/**
 * §2.2 `k` — 슬롯당 시리즈당 **요소** 마크 수. line/area 의 path 점 자체는 `P` 가 세므로
 * 0 이고, dot · 값 라벨만 요소다 (P0 계약 보정 — M/P 분리).
 */
export function markFactor(
  kind: ChartType,
  props: Pick<ChartProps, "showDots" | "showValueLabels">,
): number {
  const labels = props.showValueLabels ? 1 : 0;
  switch (kind) {
    case "bar":
    case "pie":
    case "radar":
    case "radial":
      return 1 + labels;
    case "line":
    case "area":
      return (props.showDots ? 1 : 0) + labels;
    case "scatter":
      // ADR-217 — 점 path 는 시리즈당 1 (S ≤ M) 이라 슬롯당 요소는 값 라벨뿐.
      return labels;
    default:
      throw new Error(`unhandled chartType: ${String(kind)}`);
  }
}

/**
 * §2.1 — `fitEff = min(fit, floor(M / (S × k)), floor(P / S))`. `M` 항은 요소가 있을 때
 * (`k > 0`) 만, `P` 항은 line/area 만.
 */
export function resolveFitEff(
  kind: ChartType,
  fit: number,
  series: number,
  k: number,
  budget: Pick<ChartBudgetMetrics, "markBudget" | "pointBudget">,
): number {
  const S = Math.max(1, series);
  let eff = fit;
  if (k > 0) eff = Math.min(eff, Math.floor(budget.markBudget / (S * k)));
  if (kind === "line" || kind === "area") {
    eff = Math.min(eff, Math.floor(budget.pointBudget / S));
  }
  // ADR-217 — 산점도는 관측점 수로 P 를 잰다 (희소: 점 하나 = 시리즈 하나의 값).
  if (kind === "scatter") eff = Math.min(eff, budget.pointBudget);
  return Math.max(0, eff);
}

/** §2.3 — 범주 축 종류. `ordinal` 은 기간 (bucket 이 인접 index 구간), `category` 는 이름. */
export type ChartAxisKind = "category" | "ordinal";

/**
 * 엄격 ISO-8601: `YYYY-MM-DD` 또는 `YYYY-MM-DDTHH:mm[:ss[.sss]][Z|±hh:mm]`. 숫자형 문자열
 * (`"001"`, `"2024"`) 은 통과하지 않는다 — ID 를 기간처럼 묶는 사고 방지 (§2.3).
 */
const ISO_8601 =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** ISO 문자열 → epoch ms (엄격 형식 + 실제 달력 검사). 아니면 null. */
export function parseIsoStrict(label: string): number | null {
  const m = ISO_8601.exec(label);
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00", sec = "00", ms = "0", tz] = m;
  const month = Number(mo);
  const day = Number(d);
  const hour = Number(h);
  const minute = Number(mi);
  const second = Number(sec);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour > 23 || minute > 59 || second > 59) return null;
  const utc = Date.UTC(
    Number(y),
    month - 1,
    day,
    hour,
    minute,
    second,
    Number(ms.padEnd(3, "0")),
  );
  // 2월 30일 같은 날짜는 UTC 가 다음 달로 넘겨 버린다 — 되돌려 검사.
  const back = new Date(utc);
  if (back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day)
    return null;
  if (!tz || tz === "Z") return utc;
  const sign = tz.startsWith("-") ? 1 : -1;
  const [tzh, tzm] = tz.slice(1).split(":").map(Number);
  return utc + sign * (tzh * 60 + tzm) * 60_000;
}

/**
 * §2.3 — 축 종류 자동 판정은 **보수적**이다: 결측 (`""`) 을 뺀 모든 범주가 엄격 ISO-8601 로
 * 파싱되고 첫 출현 순서가 단조 (오름 또는 내림) 일 때만 `ordinal`. 하나라도 실패하면
 * `category`. `budgetAxis` 가 명시되면 그대로.
 */
export function resolveAxisKind(
  categories: readonly string[],
  axis: ChartBudgetAxis | undefined,
): ChartAxisKind {
  if (axis === "category" || axis === "ordinal") return axis;
  let prev: number | null = null;
  let direction = 0;
  let parsed = 0;
  for (const label of categories) {
    if (label === "") continue;
    const t = parseIsoStrict(label);
    if (t === null) return "category";
    parsed++;
    if (prev !== null) {
      const step = Math.sign(t - prev);
      if (step !== 0) {
        if (direction === 0) direction = step;
        else if (direction !== step) return "category";
      }
    }
    prev = t;
  }
  return parsed > 0 ? "ordinal" : "category";
}

/**
 * §2.4 지원표의 "기본" — `auto` 를 종류 · 축 · 누적 여부로 푼다.
 * bar: 범주 창 · 순서 집계. line/area: 범주 창 · 순서 비누적 극값 · 순서 누적/expand 집계.
 * pie/radar/radial: others.
 */
export function defaultBudgetMode(
  kind: ChartType,
  axisKind: ChartAxisKind = "category",
  stacked = false,
): ChartBudgetMode {
  if (kind === "pie" || kind === "radar" || kind === "radial") return "others";
  // ADR-217 — 산점도는 x 가 연속이라 항상 순서 축 · 비누적 극값 (bucket 별 min/max 원본 점).
  if (kind === "scatter") return "extrema";
  if (axisKind === "category") return "window";
  if (kind === "bar") return "aggregate";
  return stacked ? "aggregate" : "extrema";
}

/** §2.4 지원표 — 종류가 받는 명시 overflow. ✗ 조합은 validator 가 거부한다. */
export function supportsBudgetMode(
  kind: ChartType,
  mode: ChartBudgetMode,
): boolean {
  switch (kind) {
    case "bar":
      return mode !== "extrema";
    case "line":
    case "area":
      return mode !== "others";
    case "pie":
    case "radar":
    case "radial":
      return mode === "others";
    case "scatter":
      // ADR-217 — 집계 (원본에 없는 좌표) · others 는 산점도의 뜻을 바꾼다 (HC9).
      return mode === "window" || mode === "extrema";
  }
}

// ── 변환 (transformed 층) ───────────────────────────────────────────────────

/** bucket 경계 `[start, end)` — 크기 `ceil(n / B)`, 마지막만 작을 수 있다 (§2.4). */
export function bucketBounds(n: number, B: number): Array<[number, number]> {
  const size = Math.ceil(n / Math.max(1, B));
  const out: Array<[number, number]> = [];
  for (let s = 0; s < n; s += size) out.push([s, Math.min(n, s + size)]);
  return out;
}

function statOf(
  values: number[],
  stat: ChartBudgetAggregate,
): number | undefined {
  if (values.length === 0) return undefined;
  if (stat === "sum") return values.reduce((a, b) => a + b, 0);
  if (stat === "mean") return values.reduce((a, b) => a + b, 0) / values.length;
  if (stat === "max") return Math.max(...values);
  return Math.min(...values);
}

/**
 * bucket 라벨 — 하나면 그대로, 여럿이면 `첫 ~ 끝`. 결측 (`""`) 범주가 경계에 오면 bucket 안의
 * 비어 있지 않은 첫/끝 라벨을 쓴다 (`" ~ B"` 같은 문자열 방지); 전부 비면 `""`.
 */
export function bucketLabel(
  categories: readonly string[],
  a: number,
  b: number,
): string {
  if (b - a === 1) return categories[a];
  let first = a;
  while (first < b && categories[first] === "") first++;
  let last = b - 1;
  while (last > first && categories[last] === "") last--;
  if (first >= b) return "";
  return first === last
    ? categories[first]
    : `${categories[first]} ~ ${categories[last]}`;
}

/**
 * §2.4 bucket 집계 — `B` 개 bucket, 시리즈마다 같은 경계, 값 = 명시 통계. 결측은 제외
 * (0 이 아니다), 음수는 그대로. `mean` 은 bucket 안 **범주 값** 의 평균이다 (범주 값은
 * 이미 행 합산이라 "행 평균" 이 아니다).
 */
export function aggregateBuckets(
  grid: SeriesGrid,
  B: number,
  stat: ChartBudgetAggregate,
): SeriesGrid {
  const bounds = bucketBounds(grid.categories.length, B);
  const categories = bounds.map(([a, b]) => bucketLabel(grid.categories, a, b));
  // ADR-216 (HC8) — 시간 위치는 라벨과 분리 보존: bucket `[t0, t1]` = 첫·끝 범주의 epoch, 대표 x = t0.
  const src = grid.positions;
  const positionRanges = src
    ? bounds.map(([a, b]) => [src[a], src[b - 1]] as const)
    : undefined;
  const series: SeriesData[] = grid.series.map((sd) => {
    const values = new Map<number, number>();
    bounds.forEach(([a, b], bi) => {
      const vals: number[] = [];
      for (let ci = a; ci < b; ci++) {
        const v = sd.values.get(ci);
        if (v !== undefined) vals.push(v);
      }
      const r = statOf(vals, stat);
      if (r !== undefined) values.set(bi, r);
    });
    return { ...sd, values };
  });
  return {
    categories,
    series,
    hasValues: series.some((sd) => sd.values.size > 0),
    ...(positionRanges
      ? { positions: positionRanges.map(([t0]) => t0), positionRanges }
      : {}),
  };
}

export interface ExtremaStep {
  B: number;
  U: number;
  /** 경로 점 `S × |U|` — `P` 축 판정값 */
  pathPoints: number;
  /** 요소 마크 `S × |U| × k` — `M` 축 판정값 (`k = 0` 이면 0, M 축 미적용) */
  marks: number;
}

export interface ExtremaSelection {
  /** 선택 index (오름차순) — 시리즈마다 이 index 의 원본 값을 그린다 */
  indices: number[];
  B: number;
  steps: ExtremaStep[];
  /** `B = 1` 에서도 넘쳤다 — 호출자는 bucket 집계로 fallback 한다 */
  fallback: boolean;
}

/**
 * §2.4 bucket 극값 선택 — 시리즈마다 bucket 안 min·max 의 범주 index (같으면 1개) + 결측
 * run 이 있으면 첫 결측 index (gap sentinel). 합집합 `U` 를 모든 시리즈가 원본 값으로
 * 그린다. **적응 B**: `S × |U| > P` 또는 (`k > 0`) `S × |U| × k > M` 이면 `B ← ceil(B / 2)`
 * 로 다시 고른다 — bucket 이 줄면 선택도 줄어 단조 감소, 입력이 같으면 두 leg 가 같은 B.
 * `B = 1` 에서도 넘치면 `fallback`.
 */
export function selectExtrema(
  grid: SeriesGrid,
  fitEff: number,
  k: number,
  budget: Pick<ChartBudgetMetrics, "markBudget" | "pointBudget">,
  /**
   * ADR-217 (HC9) — 점 계수. `dense` (기본 = 현행 line/area): 모든 시리즈가 모든 범주에 값을 가진
   * 것으로 `S × |U|`. `sparse` (산점도): 선택 index 안의 **실제 관측점** 수 (`Σ |values ∩ U|`) — 희소
   * 격자를 조밀 계수하면 600 점이 7,200 으로 세어져 집계로 떨어진다 (round 1 h1). sparse 는 gap
   * index 도 더하지 않는다 (희소에서 결측은 정보가 아니다).
   */
  count: "dense" | "sparse" = "dense",
): ExtremaSelection {
  const n = grid.categories.length;
  const S = Math.max(1, grid.series.length);
  const steps: ExtremaStep[] = [];
  let B = Math.max(1, fitEff);
  for (;;) {
    const U = new Set<number>();
    let pathPoints = 0;
    if (count === "sparse") {
      // 점 순회 한 번 (O(관측점)) — bucket 마다 시리즈를 도는 dense 경로는 S 가 크면 (6,000 시리즈)
      //   O(n × S) 라 B 반감 13 회에 초 단위가 든다.
      const size = Math.ceil(n / Math.max(1, B));
      for (const sd of grid.series) {
        const minAt = new Map<number, number>();
        const maxAt = new Map<number, number>();
        for (const [ci, v] of sd.values) {
          const bucket = Math.floor(ci / size);
          const mi = minAt.get(bucket);
          if (mi === undefined || v < sd.values.get(mi)!) minAt.set(bucket, ci);
          const ma = maxAt.get(bucket);
          if (ma === undefined || v > sd.values.get(ma)!) maxAt.set(bucket, ci);
        }
        const picked = new Set<number>();
        for (const ci of minAt.values()) picked.add(ci);
        for (const ci of maxAt.values()) picked.add(ci);
        pathPoints += picked.size;
        for (const ci of picked) U.add(ci);
      }
    } else {
      for (const [a, b] of bucketBounds(n, B)) {
        for (const sd of grid.series) {
          let minI = -1;
          let maxI = -1;
          let gapI = -1;
          for (let ci = a; ci < b; ci++) {
            const v = sd.values.get(ci);
            if (v === undefined) {
              if (gapI < 0) gapI = ci;
              continue;
            }
            if (minI < 0 || v < sd.values.get(minI)!) minI = ci;
            if (maxI < 0 || v > sd.values.get(maxI)!) maxI = ci;
          }
          if (minI >= 0) U.add(minI);
          if (maxI >= 0) U.add(maxI);
          if (gapI >= 0) U.add(gapI);
        }
      }
      pathPoints = S * U.size;
    }
    const marks = S * U.size * k;
    steps.push({ B, U: U.size, pathPoints, marks });
    const overP = pathPoints > budget.pointBudget;
    const overM = k > 0 && marks > budget.markBudget;
    const indices = [...U].sort((x, y) => x - y);
    if (!overP && !overM) return { indices, B, steps, fallback: false };
    if (B === 1) return { indices, B, steps, fallback: true };
    B = Math.ceil(B / 2);
  }
}

/** 선택 index 만 남긴 격자 (원본 라벨·원본 값, index 는 0 부터 다시). */
export function pickCategories(
  grid: SeriesGrid,
  keep: readonly number[],
): SeriesGrid {
  const categories = keep.map((ci) => grid.categories[ci]);
  const series = grid.series.map((sd) => {
    const values = new Map<number, number>();
    keep.forEach((ci, i) => {
      const v = sd.values.get(ci);
      if (v !== undefined) values.set(i, v);
    });
    return { ...sd, values };
  });
  return {
    categories,
    series,
    hasValues: series.some((sd) => sd.values.size > 0),
    ...pickPositions(grid, keep),
  };
}

/**
 * ADR-217 (HC9) — 희소 극값의 fallback: B=1 에서도 관측점이 P 를 넘으면 (시리즈 > P/2) 집계 대신
 * **시리즈별 stride 솎기** — 각 시리즈의 점을 x 순서로 `ceil(size / quota)` 간격 샘플 (quota =
 * `max(1, floor(P / S))`). 결과는 원본 점의 부분집합이며 index 는 0 부터 다시 (`pickCategories`).
 */
export function thinSeries(grid: SeriesGrid, pointBudget: number): SeriesGrid {
  const S = Math.max(1, grid.series.length);
  const quota = Math.max(1, Math.floor(pointBudget / S));
  const keep = new Set<number>();
  for (const sd of grid.series) {
    const indices = [...sd.values.keys()].sort((a, b) => a - b);
    if (indices.length <= quota) {
      for (const ci of indices) keep.add(ci);
      continue;
    }
    const stride = Math.ceil(indices.length / quota);
    for (let i = 0; i < indices.length; i += stride) keep.add(indices[i]);
  }
  let indices = [...keep].sort((a, b) => a - b);
  // 시리즈가 P 보다 많으면 (quota 1 로도 초과) 전체 x 순서에서 한 번 더 stride — 여전히 원본 점.
  if (indices.length > pointBudget) {
    const stride = Math.ceil(indices.length / pointBudget);
    indices = indices.filter((_, i) => i % stride === 0);
  }
  return pickCategories(grid, indices);
}

/** ADR-216 — 선택/창 index 를 따라 `positions` · `positionRanges` 를 같이 옮긴다 (없으면 없음). */
function pickPositions(
  grid: Pick<SeriesGrid, "positions" | "positionRanges">,
  keep: readonly number[],
): Pick<SeriesGrid, "positions" | "positionRanges"> {
  const out: {
    positions?: number[];
    positionRanges?: Array<readonly [number, number]>;
  } = {};
  if (grid.positions) out.positions = keep.map((ci) => grid.positions![ci]);
  if (grid.positionRanges)
    out.positionRanges = keep.map((ci) => grid.positionRanges![ci]);
  return out;
}

/** others synthetic 범주의 identity key — 원본 라벨 (예: "기타") 과 충돌하지 않는다. */
export const CHART_OTHERS_KEY = "__others__";

export interface OthersResult extends Omit<SeriesGrid, "othersIndex"> {
  /** synthetic 범주의 index (묶을 것이 없으면 null) */
  othersIndex: number | null;
  /** ranking key 내림차순의 원본 index (동률은 출현 순) */
  ranking: number[];
}

/**
 * §2.4 others — ranking key = 범주별 `Σ_series |value|`, 상위 `fitEff − 1` 을 남기고 나머지를
 * synthetic 범주 하나로 **시리즈별 sum** (원본 부호). `fitEff < 2` 면 others 없이 상위
 * `fitEff` 만. 남긴 범주는 원본 출현 순서, others 는 맨 뒤.
 */
export function groupOthers(
  grid: SeriesGrid,
  fitEff: number,
  label: string,
): OthersResult {
  const n = grid.categories.length;
  const key = (ci: number) =>
    grid.series.reduce((a, sd) => a + Math.abs(sd.values.get(ci) ?? 0), 0);
  const ranking = [...Array(n).keys()].sort((a, b) => key(b) - key(a) || a - b);
  if (n <= fitEff) return { ...grid, othersIndex: null, ranking };
  if (fitEff < 2) {
    const keep = ranking.slice(0, Math.max(1, fitEff)).sort((a, b) => a - b);
    return { ...pickCategories(grid, keep), othersIndex: null, ranking };
  }
  const keep = ranking.slice(0, fitEff - 1).sort((a, b) => a - b);
  const rest = ranking.slice(fitEff - 1);
  const base = pickCategories(grid, keep);
  const othersIndex = keep.length;
  const series = base.series.map((sd, si) => {
    let sum = 0;
    let any = false;
    for (const ci of rest) {
      const v = grid.series[si].values.get(ci);
      if (v !== undefined) {
        sum += v;
        any = true;
      }
    }
    const values = new Map(sd.values);
    if (any) values.set(othersIndex, sum);
    return { ...sd, values };
  });
  // others synthetic 범주는 epoch 이 없다 — 시간 스케일은 others 를 받지 않으므로 (지원표) 위치를 싣지 않는다.
  return {
    categories: [...base.categories, label],
    series,
    hasValues: series.some((sd) => sd.values.size > 0),
    othersIndex,
    ranking,
  };
}

/**
 * others 범주의 팔레트 index — 시리즈 팔레트가 아니라 `--chart-others` 토큰. 두 consumer
 * (Skia `seriesToken` · DOM `seriesVar`) 가 이 값을 보고 토큰을 고른다.
 */
export const CHART_OTHERS_COLOR_INDEX = -1;
/** rule 채널에 `others` 가 없을 때의 토큰 — 두 consumer 가 같은 상수를 본다. */
export const CHART_OTHERS_FALLBACK_TOKEN = "{color.neutral-subdued}";

/** 범주색 (`ci % palette`) — others 범주면 `CHART_OTHERS_COLOR_INDEX`. 범주색 자리 전부가 이것을 쓴다. */
export function categoryColorIndex(
  ci: number,
  palette: number,
  othersIndex: number | null | undefined,
): number {
  if (othersIndex !== null && othersIndex !== undefined && ci === othersIndex)
    return CHART_OTHERS_COLOR_INDEX;
  return ci % Math.max(1, palette);
}

export interface ChartWindow {
  /** 시작 범주 index (clamp 뒤) */
  start: number;
  /**
   * 끝 (exclusive). ADR-211 은 `min(n, start + fitEff)` 고정, ADR-216 부터 뷰 상태 (`windowEnd`) —
   * 불변식 `0 ≤ start < end ≤ n` · `end − start ≥ min(fitEff, n)` (`clampWindowRange`).
   */
  end: number;
}

export interface DisplayBudget {
  /** 슬롯 예산 */
  fit: number;
  /** 마크·점 예산으로 깎은 실제 슬롯 수 */
  fitEff: number;
  /** 슬롯당 시리즈당 요소 수 */
  k: number;
  series: number;
  /** input 범주 수 (넘침 판정의 n) */
  n: number;
  /** `n > fitEff` — 넘쳐서 처리가 필요한가 */
  overflow: boolean;
  axisKind: ChartAxisKind;
  /** 요청된 (또는 auto 로 풀린) 처리 */
  mode: ChartBudgetMode;
  /**
   * 실제로 적용된 변환 — 넘치지 않으면 null, 극값 fallback 이면 `"aggregate"` (요청 `mode` 는
   * `extrema` 그대로). 접미 · 진단 · UI 는 이것으로 판정한다.
   */
  applied: ChartBudgetMode | null;
  /** 집계 통계 (aggregate · 극값 fallback) */
  aggregate: ChartBudgetAggregate;
  /** 창 모드의 visible 구간 (다른 모드는 null — transformed = visible) */
  window: ChartWindow | null;
  /**
   * ADR-216 — 창이 fitEff 보다 넓어 visible 을 극값/집계로 다시 맞췄는가 (`[start, end)` 구간이 입력,
   * 211 §2.4 적응 B 그대로). 창 길이 ≤ fitEff 면 null.
   */
  windowReduced: "extrema" | "aggregate" | null;
  /** bucket 수 (aggregate · extrema 적용 시) */
  B: number | null;
  /** 극값 선택의 적응 단계 (extrema 적용 시) */
  extremaSteps: ExtremaStep[] | null;
  /** others synthetic 범주 index (others 적용 시) */
  othersIndex: number | null;
  diagnostics: ChartDiagnostic[];
}

export interface DisplayBudgetInput {
  kind: ChartType;
  geometry: ChartBudgetGeometry;
  series: number;
  stacked: boolean;
  /** input 범주 수 */
  n: number;
  k: number;
  metrics: ChartBudgetMetrics;
  axisKind: ChartAxisKind;
  overflow?: ChartBudgetOverflow;
  aggregate?: ChartBudgetAggregate;
  /** 창 시작 (Canvas 0 · DOM 뷰 상태). clamp 는 여기서. */
  windowStart?: number;
  /** ADR-216 — 창 끝 (exclusive, 뷰 상태). 미지정 = `start + fitEff` (211 과 같은 창). */
  windowEnd?: number;
}

/**
 * ADR-216 §2.3 — 창 `[start, end]` 의 불변식 `0 ≤ start < end ≤ n` · `end − start ≥ min(fitEff, n)`.
 * `anchor` 가 `start` (기본) 면 start 를 지키고 end 를 밀고, `end` 면 end 를 지키고 start 를 당긴다
 * (DOM 은 움직인 thumb 의 반대쪽을 anchor 로 준다). `end` 미지정 = `start + fitEff` (211 과 같은 창).
 * `n = 0` 이면 `[0, 0]`, `fitEff = 0` (plot-too-small) 이면 211 처럼 `[start, start)` 빈 창. resize 로
 * fitEff 가 커져 창이 최소보다 좁아지면 end 를 늘리고, n 에서 부족한 만큼 start 를 줄인다 (m4).
 */
export function clampWindowRange(
  start: number,
  end: number | undefined,
  n: number,
  fitEff: number,
  anchor: "start" | "end" = "start",
): ChartWindow {
  if (n <= 0) return { start: 0, end: 0 };
  const minWin = Math.max(0, Math.min(fitEff, n));
  let s = Number.isFinite(start) ? Math.floor(start) : 0;
  let e =
    end !== undefined && Number.isFinite(end) ? Math.floor(end) : s + fitEff;
  s = Math.min(Math.max(0, s), n);
  e = Math.min(Math.max(0, e), n);
  if (anchor === "end") {
    if (e < minWin) e = minWin;
    if (e - s < minWin) s = e - minWin;
    if (s < 0) {
      s = 0;
      e = minWin;
    }
    return { start: s, end: e };
  }
  if (e - s < minWin) e = s + minWin;
  if (e > n) {
    e = n;
    s = Math.max(0, n - minWin);
  }
  return { start: s, end: e };
}

/** §2.5 clamp — `clamp(start, 0, max(0, n − fitEff))`. 마지막 창도 길이가 같다 (211 — `clampWindowRange` 의 end 미지정과 같은 값). */
export function clampWindowStart(
  start: number,
  n: number,
  fitEff: number,
): number {
  const max = Math.max(0, n - fitEff);
  const s = Number.isFinite(start) ? Math.floor(start) : 0;
  return Math.min(Math.max(0, s), max);
}

/**
 * §3 — 예산 결정 하나. `fit` → `fitEff` → 모드 → 창 구간 · 진단. 변환 (집계 · 극값 ·
 * others) 자체는 `applyBudget` 이 이 결과를 받아 한다.
 * `fitEff = 0` 이면 `plot-too-small` (warning — 데이터 보존, scene 진단 경로).
 */
export function resolveDisplayBudget(input: DisplayBudgetInput): DisplayBudget {
  const { kind, geometry, series, stacked, n, k, metrics, axisKind } = input;
  const fit = slotFit(kind, geometry, series, stacked, metrics);
  const fitEff = resolveFitEff(kind, fit, series, k, metrics);
  const mode =
    input.overflow && input.overflow !== "auto"
      ? input.overflow
      : defaultBudgetMode(kind, axisKind, stacked);
  const diagnostics: ChartDiagnostic[] = [];
  if (n > 0 && fitEff === 0) {
    diagnostics.push({
      code: "budget.plotTooSmall",
      severity: "warning",
      message: `Plot is narrower than one slot (fit ${fit}, ${series} series)`,
      value: String(fit),
    });
  }
  // ADR-216 — `[start, end]` 뷰 상태 (end 미지정 = 211 의 고정 길이 창과 같은 값).
  const window: ChartWindow | null =
    mode === "window"
      ? clampWindowRange(input.windowStart ?? 0, input.windowEnd, n, fitEff)
      : null;
  return {
    fit,
    fitEff,
    k,
    series,
    n,
    overflow: n > fitEff,
    axisKind,
    mode,
    applied: null,
    aggregate: input.aggregate ?? "sum",
    window,
    windowReduced: null,
    B: null,
    extremaSteps: null,
    othersIndex: null,
    diagnostics,
  };
}

export interface AppliedBudget {
  budget: DisplayBudget;
  transformed: SeriesGrid;
  visible: SeriesGrid;
}

/**
 * §2.5 — 모드에 따라 input → transformed → visible. 창은 input 그대로 + 자르기, 집계는
 * bucket 통계 전체, 극값은 선택 index 의 원본 값 전체 (`B = 1` 에서도 넘치면
 * `too-many-series` + 집계 fallback), others 는 묶은 뒤 전체. 넘치지 않으면 (`n ≤ fitEff`)
 * 변환 0. pie 링 (누적 시리즈) 이 `S × 범주 > M` 이면 앞 `floor(M / 범주)` 시리즈만
 * (`too-many-series`).
 */
export function applyBudget(
  input: SeriesGrid,
  budget: DisplayBudget,
  options: {
    kind: ChartType;
    stacked: boolean;
    othersLabel: string;
    metrics: Pick<ChartBudgetMetrics, "markBudget" | "pointBudget">;
  },
): AppliedBudget {
  const diagnostics = [...budget.diagnostics];
  let transformed = input;
  let applied: ChartBudgetMode | null = null;
  let B: number | null = null;
  let extremaSteps: ExtremaStep[] | null = null;
  let othersIndex: number | null = null;
  const tooManySeries = (value: string, message: string): void => {
    diagnostics.push({
      code: "budget.tooManySeries",
      severity: "warning",
      message,
      value,
    });
  };
  const thinned = (value: string): void => {
    diagnostics.push({
      code: "budget.thinned",
      severity: "warning",
      message: `${value} series exceed the point budget even at one bucket — every series thinned to a stride sample of its own points`,
      value,
    });
  };
  if (budget.overflow && budget.fitEff > 0) {
    if (budget.mode === "window") {
      applied = "window";
    } else if (budget.mode === "aggregate") {
      applied = "aggregate";
      B = budget.fitEff;
      transformed = aggregateBuckets(input, B, budget.aggregate);
    } else if (budget.mode === "extrema") {
      const picked = selectExtrema(
        input,
        budget.fitEff,
        budget.k,
        options.metrics,
        options.kind === "scatter" ? "sparse" : "dense",
      );
      extremaSteps = picked.steps;
      if (picked.fallback && options.kind === "scatter") {
        // ADR-217 (HC9) — 산점도는 집계로 떨어지지 않는다: 원본 점을 솎아 P 안에 넣고 알린다.
        applied = "extrema";
        B = picked.B;
        transformed = thinSeries(input, options.metrics.pointBudget);
        thinned(String(input.series.length));
      } else if (picked.fallback) {
        tooManySeries(
          String(budget.series),
          `${budget.series} series exceed the point budget even at one bucket — aggregated (${budget.aggregate})`,
        );
        applied = "aggregate";
        B = budget.fitEff;
        transformed = aggregateBuckets(input, B, budget.aggregate);
      } else {
        applied = "extrema";
        B = picked.B;
        transformed = pickCategories(input, picked.indices);
      }
    } else if (budget.mode === "others") {
      const grouped = groupOthers(input, budget.fitEff, options.othersLabel);
      applied = grouped.othersIndex !== null ? "others" : null;
      othersIndex = grouped.othersIndex;
      transformed = {
        categories: grouped.categories,
        series: grouped.series,
        hasValues: grouped.hasValues,
        ...(othersIndex !== null ? { othersIndex } : {}),
      };
    }
  }
  // pie 의 동심 링 = 누적 시리즈 수 — 범주 fit 과 무관하고 비용만 `S × 범주 ≤ M` 으로 제한.
  if (
    options.kind === "pie" &&
    options.stacked &&
    transformed.series.length > 1
  ) {
    const slices = Math.max(1, transformed.categories.length);
    const maxRings = Math.max(
      1,
      Math.floor(options.metrics.markBudget / slices),
    );
    if (transformed.series.length > maxRings) {
      tooManySeries(
        String(transformed.series.length),
        `${transformed.series.length} pie rings × ${slices} slices exceed the mark budget — showing the first ${maxRings}`,
      );
      transformed = {
        ...transformed,
        series: transformed.series.slice(0, maxRings),
      };
    }
  }
  let visible = budget.window
    ? applyWindow(transformed, budget.window)
    : transformed;
  // ADR-216 §2.3 — 넓힌 창: `[start, end)` 조각이 fitEff 를 넘으면 그 조각을 입력으로 극값 (line/area
  //   비누적) 또는 집계 (bar · 누적) 로 fitEff 슬롯에 맞춘다. 예산 (M · P) 은 창 크기와 무관하게 유지.
  let windowReduced: DisplayBudget["windowReduced"] = null;
  if (
    budget.window &&
    budget.fitEff > 0 &&
    visible.categories.length > budget.fitEff
  ) {
    const reduce = defaultBudgetMode(options.kind, "ordinal", options.stacked);
    if (reduce === "extrema") {
      const picked = selectExtrema(
        visible,
        budget.fitEff,
        budget.k,
        options.metrics,
        options.kind === "scatter" ? "sparse" : "dense",
      );
      extremaSteps = picked.steps;
      if (picked.fallback && options.kind === "scatter") {
        windowReduced = "extrema";
        B = picked.B;
        visible = thinSeries(visible, options.metrics.pointBudget);
        thinned(String(visible.series.length));
      } else if (picked.fallback) {
        windowReduced = "aggregate";
        B = budget.fitEff;
        visible = aggregateBuckets(visible, B, budget.aggregate);
      } else {
        windowReduced = "extrema";
        B = picked.B;
        visible = pickCategories(visible, picked.indices);
      }
    } else {
      windowReduced = "aggregate";
      B = budget.fitEff;
      visible = aggregateBuckets(visible, B, budget.aggregate);
    }
  }
  return {
    budget: {
      ...budget,
      applied,
      windowReduced,
      B,
      extremaSteps,
      othersIndex,
      diagnostics,
    },
    transformed,
    visible,
  };
}

/**
 * 창 자르기 — transformed → visible. 범주 index 를 0 부터 다시 매기고 시리즈 값도 옮긴다
 * (시리즈 목록·팔레트 인덱스는 그대로 — 범례는 input 에서 나온다).
 */
export function applyWindow(grid: SeriesGrid, window: ChartWindow): SeriesGrid {
  const { start, end } = window;
  if (start === 0 && end >= grid.categories.length) return grid;
  const categories = grid.categories.slice(start, end);
  const series: SeriesData[] = grid.series.map((sd) => {
    const values = new Map<number, number>();
    for (let ci = start; ci < end; ci++) {
      const v = sd.values.get(ci);
      if (v !== undefined) values.set(ci - start, v);
    }
    return { ...sd, values };
  });
  return {
    categories,
    series,
    hasValues: series.some((sd) => sd.values.size > 0),
    ...(grid.positions ? { positions: grid.positions.slice(start, end) } : {}),
    ...(grid.positionRanges
      ? { positionRanges: grid.positionRanges.slice(start, end) }
      : {}),
  };
}

/**
 * 행 상한 `R` — 두 leg 가 spec 안에서 똑같이 자른다 (Canvas 전용 slice 를 두지 않는다,
 * round 1 m4). 초과분은 진단 `rows-truncated` 로 알린다 (사용자-가시 안내).
 */
export function capRows<T>(
  rows: readonly T[],
  rowCap: number,
): { rows: readonly T[]; diagnostic: ChartDiagnostic | null } {
  if (rows.length <= rowCap) return { rows, diagnostic: null };
  return {
    rows: rows.slice(0, rowCap),
    diagnostic: {
      code: "budget.rowsTruncated",
      severity: "warning",
      message: `Only the first ${rowCap} of ${rows.length} rows are charted`,
      value: String(rows.length),
    },
  };
}
