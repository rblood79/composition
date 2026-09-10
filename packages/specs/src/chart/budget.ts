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
    "minSlot" | "minPointGap" | "minArc" | "minAxisGap" | "minRing"
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
  return Math.max(0, eff);
}

/** §2.4 지원표의 "기본" — `auto` 를 종류에 따라 푼다. 축 종류 (`ordinal`) 분기는 P2. */
export function defaultBudgetMode(kind: ChartType): ChartBudgetMode {
  return kind === "bar" || kind === "line" || kind === "area"
    ? "window"
    : "others";
}

export interface ChartWindow {
  /** 시작 범주 index (clamp 뒤) */
  start: number;
  /** 끝 (exclusive) — `min(n, start + fitEff)` */
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
  /** transformed 범주 수 (창의 입력 n) */
  n: number;
  /** `n > fitEff` — 넘쳐서 처리가 필요한가 */
  overflow: boolean;
  mode: ChartBudgetMode;
  /** 창 모드의 visible 구간 (다른 모드는 null — transformed = visible) */
  window: ChartWindow | null;
  diagnostics: ChartDiagnostic[];
}

export interface DisplayBudgetInput {
  kind: ChartType;
  geometry: ChartBudgetGeometry;
  series: number;
  stacked: boolean;
  /** transformed 범주 수 */
  n: number;
  k: number;
  metrics: ChartBudgetMetrics;
  overflow?: ChartBudgetOverflow;
  /** 창 시작 (Canvas 0 · DOM 뷰 상태). clamp 는 여기서. */
  windowStart?: number;
}

/** §2.5 clamp — `clamp(start, 0, max(0, n − fitEff))`. 마지막 창도 길이가 같다. */
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
 * §3 — 예산 결정 하나. `fit` → `fitEff` → 모드 → 창 구간 · 진단.
 * `fitEff = 0` 이면 `plot-too-small` (warning — 데이터 보존, scene 진단 경로).
 */
export function resolveDisplayBudget(input: DisplayBudgetInput): DisplayBudget {
  const { kind, geometry, series, stacked, n, k, metrics } = input;
  const fit = slotFit(kind, geometry, series, stacked, metrics);
  const fitEff = resolveFitEff(kind, fit, series, k, metrics);
  const mode =
    input.overflow && input.overflow !== "auto"
      ? input.overflow
      : defaultBudgetMode(kind);
  const diagnostics: ChartDiagnostic[] = [];
  // 진단은 예산이 실제로 그림을 깎는 모드에서만 — P1 은 창뿐이다. P2 가 others/집계/극값을
  //   적용하면 조건을 넓힌다 (진단과 화면이 다른 말을 하지 않게).
  if (n > 0 && fitEff === 0 && mode === "window") {
    diagnostics.push({
      code: "budget.plotTooSmall",
      severity: "warning",
      message: `Plot is narrower than one slot (fit ${fit}, ${series} series)`,
      value: String(fit),
    });
  }
  const window: ChartWindow | null =
    mode === "window"
      ? (() => {
          const start = clampWindowStart(input.windowStart ?? 0, n, fitEff);
          return { start, end: Math.min(n, start + fitEff) };
        })()
      : null;
  return {
    fit,
    fitEff,
    k,
    series,
    n,
    overflow: n > fitEff,
    mode,
    window,
    diagnostics,
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
