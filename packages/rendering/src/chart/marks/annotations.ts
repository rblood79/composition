/**
 * ADR-306 Phase 6 — 주석 (`annotations`). **두 consumer 가 같이 부른다** (Canvas `computeChartScene` ·
 * DOM `RechartsChart`, candlestick 은 family scene). 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT —
 * `src/core/annotations.tsx` `AnnotationsUnder` · `AnnotationsOver` · `annotationYs` · `forecastX`) 을
 * 따른다. 가로 기준선 (`line`) 은 `referenceLines` (ADR-217) 가 맡는다.
 *
 * 편차: 이름표의 바탕 상자 (ztd `Tag` 의 panel 색) 는 그리지 않는다 (Phase 4 편차 3 과 같은 이유 — 글자만).
 * 구간 · 예측 · 주말 음영의 ztd `ink` 0.05 는 paint 역할 neutral 0.12 로 (역할 밖 색을 두지 않는다).
 */
import { toScreen } from "../curves";
import type { AxialPoint } from "../curves";
import { approxTextWidth, r2 } from "../scales";
import type { BandScale, LinearScale } from "../scales";
import { parseIsoStrict } from "../budget";
import { parseTime } from "../timeFormat";
import { referenceValues } from "../series";
import type { StackMode } from "../series";
import type { ResolvedChartPresentation } from "../presentation";
import type {
  ChartAnnotation,
  ChartOrientation,
  ChartProps,
  LineMark,
  Mark,
  PathMark,
  Rect,
  TextMark,
} from "../types";
import { CHART_ANNOTATIONS_MAX, CHART_ANNOTATION_TYPES } from "../types";
import { linearFit } from "./fit";
import { circlePath } from "./dots";

/** 저장된 칸을 읽을 수 있는 주석으로 — 종류가 없거나 모르는 칸은 버리고 최대 `CHART_ANNOTATIONS_MAX`. */
export function resolveAnnotations(raw: unknown): ChartAnnotation[] {
  if (!Array.isArray(raw)) return [];
  const out: ChartAnnotation[] = [];
  for (const item of raw) {
    if (out.length >= CHART_ANNOTATIONS_MAX) break;
    if (!item || typeof item !== "object") continue;
    const a = item as ChartAnnotation;
    if (!CHART_ANNOTATION_TYPES.includes(a.type)) continue;
    out.push(a);
  }
  return out;
}

const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v);
  return NaN;
};
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v !== ""
    ? v
    : typeof v === "number"
      ? String(v)
      : undefined;

/** 값 축 범위에 넣을 값 — 값 구간 (`band` 의 y · yEnd). 데이터 밖이어도 그림 안에 들어오게 (ztd 와 같음). */
export function annotationValues(list: readonly ChartAnnotation[]): number[] {
  const out: number[] = [];
  for (const a of list)
    if (a.type === "band" && str(a.x) === undefined) {
      const lo = num(a.y);
      const hi = num(a.yEnd);
      if (Number.isFinite(lo) && Number.isFinite(hi)) out.push(lo, hi);
    }
  return out;
}

/** 주석 · 손익 색을 그리는 시리즈 종류 (candlestick 은 family 가 따로 읽는다). */
const ANNOTATED: ReadonlySet<string> = new Set(["line", "area", "bar"]);

/**
 * 값 축 범위에 넣을 값 전부 — 기준선 (ADR-217) + 값 구간 주석 + 손익 색 기준값 (누적이 아닐 때). layout ·
 * model · runtime 이 같이 부른다 (Canvas 와 DOM 의 축이 갈리지 않게).
 */
export function valueIncludes(
  presentation: Pick<ResolvedChartPresentation, "referenceLines">,
  props: Pick<
    ChartProps,
    "chartType" | "annotations" | "signColors" | "baseline"
  >,
  stackMode: StackMode,
): readonly number[] {
  const base = referenceValues(presentation);
  if (!ANNOTATED.has(props.chartType)) return base;
  const extra = annotationValues(resolveAnnotations(props.annotations));
  if (
    props.signColors === true &&
    stackMode === "none" &&
    props.chartType !== "bar"
  ) {
    const b = num(props.baseline);
    extra.push(Number.isFinite(b) ? b : 0);
  }
  return extra.length === 0 ? base : [...base, ...extra];
}

/** 손익 색 기준값 (비면 0). */
export function signBaseline(props: Pick<ChartProps, "baseline">): number {
  const b = num(props.baseline);
  return Number.isFinite(b) ? b : 0;
}

/** 예측이 시작하는 x (첫 `forecast` 주석의 `x`). */
export function forecastFrom(
  list: readonly ChartAnnotation[],
): string | undefined {
  return str(list.find((a) => a.type === "forecast")?.x);
}

/** 범주 축 위치 — 주석의 x 값을 그림 좌표로. */
export interface AnnotationAxis {
  /** x 값 → 범주 축 좌표 (범주 이름이 같으면 그 칸 중앙, 시간 축이면 날짜로). 못 찾으면 null. */
  at(v: string): number | null;
  /** 칸 폭의 절반 — x 구간을 양 끝 칸 가장자리까지 넓힌다 (범주). 시간 · 숫자 축은 0. */
  half: number;
  /** 시간 축 — epoch 범위 · 점 수 · epoch → 좌표 (주말 음영). */
  time?: { t0: number; t1: number; n: number; at: (t: number) => number };
  /** 범주 축 위의 그림 범위 [작은 쪽, 큰 쪽]. */
  lo: number;
  hi: number;
}

/**
 * 범주 축 위치 helper — scene 과 DOM 이 같은 band · 시간 스케일로 만든다. `positions` 가 있고
 * `timeScale` 이 있으면 시간 축 (범주 이름이 안 맞으면 날짜로 읽는다).
 */
export function annotationAxis(input: {
  categories: readonly string[];
  band: BandScale;
  range: readonly [number, number];
  positions?: readonly number[];
  timeScale?: LinearScale | null;
  props: Pick<ChartProps, "dimensionFormat">;
}): AnnotationAxis {
  const { categories, band, positions, timeScale } = input;
  const center = (i: number) => band.at(i) + band.bandwidth / 2;
  const isTime = !!(timeScale && positions && positions.length > 0);
  const half = isTime || !(band.step > 0) ? 0 : band.step / 2;
  const at = (v: string): number | null => {
    const i = categories.indexOf(v);
    if (i >= 0) return center(i);
    if (isTime) {
      const t = input.props.dimensionFormat
        ? parseTime(input.props.dimensionFormat, v)
        : parseIsoStrict(v);
      return t === null ? null : timeScale!(t);
    }
    return null;
  };
  const lo = Math.min(input.range[0], input.range[1]);
  const hi = Math.max(input.range[0], input.range[1]);
  const last = (positions?.length ?? 0) - 1;
  return {
    at,
    half,
    lo,
    hi,
    ...(isTime && last > 0
      ? {
          time: {
            t0: positions![0],
            t1: positions![last],
            n: last + 1,
            at: (t: number) => timeScale!(t),
          },
        }
      : {}),
  };
}

export interface AnnotationInput {
  list: readonly ChartAnnotation[];
  axis: AnnotationAxis;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  fontSize: number;
  /** 추세선이 맞출 강조 시리즈의 점 (범주 축 · 값 축 좌표). */
  trendPoints?: readonly AxialPoint[];
  /** 막대 · 봉 — 예측 구간을 칸 왼쪽 끝부터 (ztd `edge`). */
  edge?: boolean;
}

export interface AnnotationMarks {
  /** 데이터 마크 아래 — 구간 · 예측 · 주말 음영. */
  under: Mark[];
  /** 데이터 마크 위 — 사건 · 예측 경계 · 추세선 · 이름. */
  over: Mark[];
}

const EMPTY: AnnotationMarks = { under: [], over: [] };

/** 예측이 시작하는 범주 축 좌표 (그림 안으로 당긴다). 없거나 그림 끝 밖이면 null — 선의 파선 나누기도 이걸 쓴다. */
export function forecastAt(
  axis: AnnotationAxis,
  from: string | undefined,
  edge = false,
): number | null {
  const x = from === undefined ? null : axis.at(from);
  if (x === null || x > axis.hi) return null;
  return Math.max(axis.lo, x - (edge ? axis.half : 0));
}

export function buildAnnotationMarks(input: AnnotationInput): AnnotationMarks {
  const { list, axis, value, plot, orientation, fontSize } = input;
  if (list.length === 0) return EMPTY;
  const horizontal = orientation === "horizontal";
  // 값 축의 그림 범위 (across).
  const aLo = horizontal ? plot.x : plot.y;
  const aHi = horizontal ? plot.x + plot.w : plot.y + plot.h;
  // 값 축의 「위」 (큰 값 쪽 끝) — 세로면 plot 위, 가로면 plot 오른쪽.
  const top = horizontal ? aHi : aLo;
  const bottom = horizontal ? aLo : aHi;
  const rect = (a0: number, a1: number, c0: number, c1: number): Rect =>
    horizontal
      ? { x: r2(c0), y: r2(a0), w: r2(c1 - c0), h: r2(a1 - a0) }
      : { x: r2(a0), y: r2(c0), w: r2(a1 - a0), h: r2(c1 - c0) };
  const line = (
    p: AxialPoint,
    q: AxialPoint,
    extra: Partial<LineMark>,
  ): LineMark => {
    const a = toScreen(orientation, p);
    const b = toScreen(orientation, q);
    return {
      kind: "line",
      x1: r2(a.x),
      y1: r2(a.y),
      x2: r2(b.x),
      y2: r2(b.y),
      role: "reference",
      ...extra,
    };
  };
  const text = (
    p: AxialPoint,
    t: string,
    anchor: TextMark["anchor"],
  ): TextMark => {
    const s = toScreen(orientation, p);
    return {
      kind: "text",
      x: r2(s.x),
      y: r2(s.y),
      text: t,
      anchor,
      baseline: "middle",
      role: "reference",
    };
  };
  const clampA = (x: number) => Math.max(axis.lo, Math.min(axis.hi, x));
  const clampC = (c: number) =>
    Math.max(Math.min(aLo, aHi), Math.min(Math.max(aLo, aHi), c));
  // 이름표 한 줄 높이 · 값 축 「위」 에서 안쪽으로 한 칸.
  const lineH = fontSize * 1.4;
  const inward = (c: number, k: number) => (horizontal ? c - k : c + k); // 세로: 위 → 아래로, 가로: 오른쪽 → 왼쪽으로
  const under: Mark[] = [];
  const over: Mark[] = [];
  const shade = (a0: number, a1: number) => {
    const xa = clampA(a0);
    const xb = clampA(a1);
    if (xb - xa < 0.5) return;
    under.push({
      kind: "rect",
      ...rect(xa, xb, Math.min(top, bottom), Math.max(top, bottom)),
      seriesIndex: 0,
      fillPaint: "neutral",
      fillOpacity: 0.12,
    });
  };
  const xRange = (a?: string, b?: string): [number, number] | null => {
    if (a === undefined || b === undefined) return null;
    const pa = axis.at(a);
    const pb = axis.at(b);
    if (pa === null || pb === null) return null;
    return [Math.min(pa, pb) - axis.half, Math.max(pa, pb) + axis.half];
  };
  const rows: number[] = []; // 사건 이름표 줄마다 오른쪽 끝 (겹치면 아랫줄)
  list.forEach((a) => {
    const x = str(a.x);
    const xEnd = str(a.xEnd);
    if (a.type === "band" && x === undefined) {
      // 값 구간 — accent 0.1 면 + 양 끝 파선.
      const ya = value(num(a.y));
      const yb = value(num(a.yEnd));
      if (!Number.isFinite(ya) || !Number.isFinite(yb)) return;
      const c0 = clampC(Math.min(ya, yb));
      const c1 = clampC(Math.max(ya, yb));
      under.push({
        kind: "rect",
        ...rect(axis.lo, axis.hi, c0, c1),
        seriesIndex: 0,
        fillPaint: "accent",
        fillOpacity: 0.1,
      });
      for (const c of [c0, c1])
        under.push(
          line(
            { along: axis.lo, across: c },
            { along: axis.hi, across: c },
            { paint: "accent", opacity: 0.45, dash: [3, 3] },
          ),
        );
      if (a.label)
        over.push(
          text(
            {
              along: Math.min(axis.lo, axis.hi - 40) + 4,
              across: inward(horizontal ? c1 : c0, lineH * 0.6),
            },
            a.label,
            "start",
          ),
        );
    } else if (a.type === "band") {
      // 범주 · 날짜 구간 — neutral 음영.
      const r = xRange(x, xEnd ?? x);
      if (!r) return;
      shade(r[0], r[1]);
      if (a.label)
        over.push(
          text(
            {
              along: Math.min(clampA(r[0]), axis.hi - 40) + 4,
              across: inward(top, lineH * 0.6),
            },
            a.label,
            "start",
          ),
        );
    } else if (a.type === "forecast") {
      const xf = forecastAt(axis, x, input.edge);
      if (xf === null) return;
      shade(xf, axis.hi);
      over.push(
        line(
          { along: xf, across: top },
          { along: xf, across: bottom },
          { role: "axis", dash: [2, 3] },
        ),
        text(
          {
            along: Math.min(xf + 4, axis.hi - 50),
            across: inward(top, lineH * 0.5),
          },
          a.label || "Forecast",
          "start",
        ),
      );
    } else if (a.type === "weekends" && axis.time) {
      // 토요일 0시 ~ 월요일 0시 (UTC — 시간 축과 같다). 400 일 넘으면 칸이 잘아서 그리지 않는다 (ztd).
      const { t0, t1, n } = axis.time;
      if (t1 - t0 > 86400000 * 400) return;
      const pad = Math.min(43200000, (t1 - t0) / Math.max(1, n - 1) / 2);
      const d = new Date(t0);
      d.setUTCHours(0, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 1) % 7));
      for (let k = 0; d.getTime() - pad <= t1 && k < 60; k++) {
        const sat = d.getTime();
        d.setUTCDate(d.getUTCDate() + 2);
        shade(axis.time.at(sat - pad), axis.time.at(d.getTime() - pad));
        d.setUTCDate(d.getUTCDate() + 5);
      }
    } else if (a.type === "event" && a.label && x !== undefined) {
      const xe = axis.at(x);
      if (xe === null || xe < axis.lo - 1 || xe > axis.hi + 1) return;
      // 가로 방향: 사건 선은 가로줄 — 이름은 그 줄 바로 위, 오른쪽 끝 (줄 나누기 없음, 판독 MEDIUM-3).
      const w = approxTextWidth(a.label, fontSize) + 8;
      const left = horizontal
        ? xe - lineH * 0.6
        : Math.max(axis.lo, Math.min(xe - w / 2, axis.hi - w));
      let row = 0;
      if (!horizontal) {
        row = rows.findIndex((end) => end < left - 4);
        if (row < 0) row = rows.length;
        rows[row] = left + w;
      }
      const labelAt = inward(top, lineH * (0.5 + row));
      over.push(
        line(
          { along: xe, across: inward(labelAt, lineH * 0.5) },
          { along: xe, across: bottom },
          { role: "axis", opacity: 0.45, dash: [2, 3] },
        ),
      );
      const dot = toScreen(orientation, { along: xe, across: bottom });
      const r = 2.5;
      over.push({
        kind: "path",
        d: circlePath(r2(dot.x), r2(dot.y), r),
        bbox: { x: dot.x - r, y: dot.y - r, w: r * 2, h: r * 2 },
        fillRole: "axis",
      } satisfies PathMark);
      over.push(
        horizontal
          ? text({ along: left, across: top - 4 }, a.label, "end")
          : text({ along: left + 4, across: labelAt }, a.label, "start"),
      );
    } else if (a.type === "trend" && input.trendPoints) {
      const pts = input.trendPoints
        .map((p) => ({ x: p.along, y: p.across }))
        .filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));
      const fit = linearFit(pts);
      if (!fit || pts.length < 2) return;
      const xa = pts[0].x;
      const xb = pts[pts.length - 1].x;
      over.push(
        line(
          { along: xa, across: fit.at(xa) },
          { along: xb, across: fit.at(xb) },
          { width: 1.5, dash: [6, 4] },
        ),
        text(
          { along: xb - 2, across: inward(fit.at(xb), -lineH * 0.7) },
          a.label || "Trend",
          "end",
        ),
      );
    }
  });
  // 이름표가 그림 상자 밖으로 뻗지 않게 — 넘치면 반대쪽에 붙인다 (가로 방향은 글자가 값 축을 따라 뻗는다 —
  //   판독 MEDIUM-3).
  const xLo = plot.x;
  const xHi = plot.x + plot.w;
  for (let i = 0; i < over.length; i++) {
    const m = over[i];
    if (m.kind !== "text") continue;
    const w = approxTextWidth(m.text, fontSize);
    if (m.anchor === "start" && m.x + w > xHi)
      over[i] = { ...m, x: r2(xHi - 2), anchor: "end" };
    else if (m.anchor === "end" && m.x - w < xLo)
      over[i] = { ...m, x: r2(xLo + 2), anchor: "start" };
  }
  return { under, over };
}
