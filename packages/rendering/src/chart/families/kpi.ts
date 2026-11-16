/**
 * ADR-306 — kpi family (gauge · bullet · dumbbell). 통계 없음 · 격자 없음 (breakdown §2.2 · §8 Phase 2).
 *
 * 종류의 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT — `src/charts/radial.tsx` `GaugeChart` ·
 * `bullet.tsx` · `dumbbell.tsx`) 을 따른다: gauge 는 첫 행의 값을 `[valueMin, valueMax]` 위 비율로
 * (자동 domain 이 아니다), bullet 은 행마다 `niceDomain(0, max(값 · 목표 · 구간), 4)`, dumbbell 은
 * `fitDomain(min, max, 4, { zero, pad: 0.08 })` 과 이후 값 정렬. 배치 수치 (반지름 · 두께 · 줄 높이) 는
 * ztd 의 비율을 그대로 쓰고 글자 크기만 rule metric (`fontSize`) 에 맞춘다.
 *
 * 단계는 검증 → 모델 (`gaugeModel` · `bulletModel` · `dumbbellModel` — 크기 독립, 테스트가 직접 잰다)
 * → 예산 (줄 수) → 기하 (크기 의존) 순서다.
 */
import { highlightSet } from "../highlight";
import { placeLegend } from "../legend";
import { chartFrame } from "../frame";
import { circlePath } from "../marks/dots";
import { arcSlicePath } from "../marks/pie";
import { polarPoint } from "../polar";
import { approxTextWidth, linearScale, r2, toFiniteNumber } from "../scales";
import {
  CHART_INVALID_SETTINGS_TEXT,
  CHART_NO_DATA_TEXT,
  chartEmptyScene,
} from "../sceneStates";
import type {
  ChartMetrics,
  ChartPaintRole,
  ChartProps,
  ChartRow,
  ChartScene,
  ChartShape,
  ChartSize,
  ChartSort,
  ChartTarget,
  FamilyChartType,
  LineMark,
  Mark,
  Rect,
  TextMark,
} from "../types";
import type { ChartFamily } from "./types";
import {
  fieldKey,
  familyInput,
  readLabel,
  readNumber,
  requireField,
  type FamilyInput,
} from "./fields";
import { fitDomain, niceDomain, ticksFor } from "./niceScale";
import { withRowPolicy } from "./rowPolicy";
import {
  chartSeriesFill,
  chartSeriesItems,
  chartSeriesName,
  chartSeriesSwatch,
  type ChartSeriesItem,
} from "../seriesItems";

// ── gauge ──────────────────────────────────────────────────────────────────

export const GAUGE_SHAPES: readonly ChartShape[] = [
  "arc",
  "semi",
  "ring",
  "ticks",
];

export interface GaugeModel {
  /** 값을 읽은 원본 행 (첫 행) */
  row: number;
  value: number;
  /** NaN = 목표 없음 */
  target: number;
  min: number;
  max: number;
  /** 값의 비율 `[0, 1]` (범위 밖은 끝에 붙는다) */
  frac: number;
  /** 목표의 비율 (NaN = 없음) */
  targetFrac: number;
  /** `(min, max)` 안의 구간 경계 */
  bands: number[];
  shape: ChartShape;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** 검증 + 모델. 설정 오류면 null (진단은 `input` 에). 행이 없으면 `"empty"`. */
export function gaugeModel(
  props: ChartProps,
  rows: readonly ChartRow[],
  input: FamilyInput = familyInput(props),
): GaugeModel | "empty" | null {
  const metric = requireField(input, "Value", props.metric);
  const goal = fieldKey(props.goalField);
  const min = props.valueMin ?? 0;
  const max = props.valueMax ?? 100;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min)
    input.error(
      "valueRange.invalid",
      "valueMax must be greater than valueMin",
      `${min}..${max}`,
    );
  const shape: ChartShape = GAUGE_SHAPES.includes(props.shape as ChartShape)
    ? (props.shape as ChartShape)
    : "arc";
  // 패널의 목록 칸은 글자로 쓴다 (`string-array`) — 숫자 글자는 숫자로 읽고, 아닌 값은 진단.
  const rawBands: readonly unknown[] = Array.isArray(props.bands)
    ? props.bands
    : props.bands === undefined
      ? []
      : [props.bands];
  const parsedBands = rawBands.map((b) => toFiniteNumber(b));
  if (parsedBands.some((b) => b === null))
    input.error("bands.invalid", "bands must be numbers");
  if (!input.ok || metric === null) return null;
  if (rows.length === 0) return "empty";
  const value = readNumber(rows[0], metric);
  if (!Number.isFinite(value)) return "empty";
  const target = goal === null ? NaN : readNumber(rows[0], goal);
  const span = max - min;
  return {
    row: 0,
    value,
    target,
    min,
    max,
    frac: clamp01((value - min) / span),
    targetFrac: Number.isFinite(target) ? clamp01((target - min) / span) : NaN,
    bands: parsedBands
      .filter((b): b is number => b !== null && b > min && b < max)
      .sort((a, b) => a - b),
    shape,
  };
}

/** gauge 의 호 기하 — 12시 = 0°, 시계 방향 (pie 규약). */
export interface GaugeGeometry {
  cx: number;
  cy: number;
  radius: number;
  thickness: number;
  /** 시작 각도 (도) */
  start: number;
  /** 호가 도는 각도 (도) */
  sweep: number;
}

export function gaugeGeometry(
  shape: ChartShape,
  outer: Rect,
  fontSize: number,
): GaugeGeometry {
  const sweep = shape === "ring" ? 360 : shape === "semi" ? 180 : 240;
  const start = shape === "ring" ? 0 : -sweep / 2;
  // min · max 글자 자리 (ring 은 없다).
  const labelRoom = shape === "ring" ? 0 : fontSize * 2;
  const room = Math.max(0, outer.h - labelRoom);
  // 호의 세로 길이 = 반지름 × (위 1 + 아래 −cos(sweep/2)) — semi 1 · arc 1.5 · ring 2.
  const down =
    shape === "ring"
      ? 1
      : Math.max(0, -Math.cos(((sweep / 2) * Math.PI) / 180));
  const radius = Math.max(0, Math.min(room / (1 + down), outer.w / 2));
  const cx = outer.x + outer.w / 2;
  const cy =
    shape === "ring"
      ? outer.y + outer.h / 2
      : outer.y + (room - radius * (1 + down)) / 2 + radius;
  const thickness = Math.max(
    Math.min(radius / 2, 8),
    Math.min(shape === "ring" ? 16 : 20, radius * 0.17),
  );
  return {
    cx: r2(cx),
    cy: r2(cy),
    radius: r2(radius),
    thickness: r2(thickness),
    start,
    sweep,
  };
}

function gaugeScene(
  props: ChartProps,
  rows: readonly ChartRow[],
  size: ChartSize,
  metrics: ChartMetrics,
): ChartScene {
  const frame = chartFrame(size, metrics);
  const { outer, fontSize } = frame;
  const input = familyInput(props);
  const model = gaugeModel(props, rows, input);
  if (model === null)
    return chartEmptyScene(
      frame.size,
      outer,
      CHART_INVALID_SETTINGS_TEXT,
      input.diagnostics,
    );
  if (model === "empty" || outer.w <= 0 || outer.h <= 0)
    return chartEmptyScene(
      frame.size,
      outer,
      CHART_NO_DATA_TEXT,
      input.diagnostics,
    );
  const g = gaugeGeometry(model.shape, outer, fontSize);
  if (g.radius <= 0)
    return chartEmptyScene(
      frame.size,
      outer,
      CHART_NO_DATA_TEXT,
      input.diagnostics,
    );
  const { cx, cy, radius, thickness, start, sweep } = g;
  const inner = Math.max(0, radius - thickness);
  const at = (frac: number) => start + sweep * frac;
  const marks: Mark[] = [];
  const box: Rect = {
    x: r2(cx - radius),
    y: r2(cy - radius),
    w: r2(radius * 2),
    h: r2(radius * 2),
  };

  if (model.shape === "ticks") {
    // 눈금 호 — 값까지 켜진다 (ztd `TickArc`). 개수는 호 길이 / 8px 를 24 ~ 64 로.
    const length = thickness * 1.3;
    const arcLength = ((radius - length / 2) * sweep * Math.PI) / 180;
    const count = Math.max(
      2,
      Math.round(Math.max(24, Math.min(64, arcLength / 8))),
    );
    const gap = arcLength / (count - 1);
    const width = r2(Math.max(1.6, Math.min(3.4, gap * 0.42)));
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const a = polarPoint(cx, cy, radius - length, at(t));
      const b = polarPoint(cx, cy, radius - 1, at(t));
      const lit = model.frac > 0.002 && t <= model.frac + 1e-6;
      marks.push({
        kind: "line",
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        role: "grid",
        width,
        ...(lit ? { paint: "accent" as const } : {}),
      });
    }
  } else {
    // 트랙 = 전체 범위 (radial 트랙과 같은 `fillRole: grid`), 값 = accent 호.
    marks.push({
      kind: "path",
      d: arcSlicePath(cx, cy, radius, inner, start, sweep),
      bbox: box,
      fillRole: "grid",
      fillRule: "evenodd",
    });
    for (const band of model.bands) {
      const f = (band - model.min) / (model.max - model.min);
      const a = polarPoint(cx, cy, inner - 3, at(f));
      const b = polarPoint(cx, cy, radius + 2, at(f));
      marks.push({
        kind: "line",
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        role: "axis",
        width: 2,
      });
    }
    if (model.frac > 0.002)
      marks.push({
        kind: "path",
        d: arcSlicePath(cx, cy, radius, inner, start, sweep * model.frac),
        bbox: box,
        fillPaint: "accent",
        fillRule: "evenodd",
      });
  }
  if (Number.isFinite(model.targetFrac)) {
    const a = polarPoint(cx, cy, inner - 4, at(model.targetFrac));
    const b = polarPoint(cx, cy, radius + 4, at(model.targetFrac));
    marks.push({
      kind: "line",
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      role: "reference",
      width: 2.5,
    });
    if (props.showValueLabels && model.shape !== "ring") {
      const p = polarPoint(
        cx,
        cy,
        radius + fontSize * 1.3,
        at(model.targetFrac),
      );
      const s = Math.sin((at(model.targetFrac) * Math.PI) / 180);
      marks.push({
        kind: "text",
        x: p.x,
        y: p.y,
        text: input.formatValue(model.target),
        anchor: s > 0.2 ? "start" : s < -0.2 ? "end" : "middle",
        baseline: "middle",
        role: "reference",
      });
    }
  }

  // 가운데 숫자 (+ 설명), 끝 글자 min · max.
  const big = Math.max(18, Math.min(42, radius * 0.42));
  const scale = r2(big / fontSize);
  const label = props.centerLabel ?? "";
  const valueY =
    model.shape === "semi"
      ? cy - big * 0.55
      : model.shape === "ring"
        ? cy - (label ? big * 0.18 : 0)
        : cy - (label ? big * 0.18 : 0);
  marks.push({
    kind: "text",
    x: cx,
    y: r2(valueY),
    text: input.formatValue(model.value),
    anchor: "middle",
    baseline: "middle",
    role: "value",
    fontScale: scale,
  });
  if (label)
    marks.push({
      kind: "text",
      x: cx,
      y: r2(model.shape === "semi" ? cy - fontSize * 0.6 : cy + big * 0.5),
      text: label,
      anchor: "middle",
      baseline: "middle",
      role: "tick",
    });
  if (model.shape !== "ring") {
    const a = polarPoint(cx, cy, radius - thickness / 2, start);
    const b = polarPoint(cx, cy, radius - thickness / 2, start + sweep);
    const off = model.shape === "semi" ? fontSize : thickness / 2 + fontSize;
    marks.push(
      {
        kind: "text",
        x: a.x,
        y: r2(a.y + off),
        text: input.formatValue(model.min),
        anchor: "middle",
        baseline: "middle",
        role: "tick",
      },
      {
        kind: "text",
        x: b.x,
        y: r2(b.y + off),
        text: input.formatValue(model.max),
        anchor: "middle",
        baseline: "middle",
        role: "tick",
      },
    );
  }

  const name = label || (fieldKey(props.metric) ?? "Value");
  const entries: ChartTarget["entries"][number][] = [
    { label: "Current", text: input.formatValue(model.value), paint: "accent" },
  ];
  if (Number.isFinite(model.target)) {
    entries.push({ label: "Target", text: input.formatValue(model.target) });
    if (model.target)
      entries.push({
        label: "Achieved",
        text: `${r2((model.value / model.target) * 100)}%`,
      });
  }
  entries.push({
    label: "Range",
    text: `${input.formatValue(model.min)} – ${input.formatValue(model.max)}`,
  });
  return {
    size: frame.size,
    plot: outer,
    marks,
    axes: [],
    legend: null,
    tooltip: null,
    empty: false,
    targets: props.showTooltip
      ? [
          {
            id: "value",
            x: cx,
            y: r2(cy - radius),
            r: radius,
            rows: [model.row],
            title: name,
            entries,
          },
        ]
      : [],
    ...(input.diagnostics.length > 0 ? { diagnostics: input.diagnostics } : {}),
  };
}

// ── bullet ─────────────────────────────────────────────────────────────────

export interface BulletRowModel {
  row: number;
  label: string;
  /** NaN = 값 없음 (0 으로 읽히지 않게 길이 0 · 글자 「-」) */
  value: number;
  target: number;
  ranges: number[];
  /** 행의 축 상한 — `niceDomain(0, max(값 · 목표 · 구간), 4)[1]` */
  max: number;
}

export interface BulletModel {
  rows: BulletRowModel[];
  /** 모든 행 (잘리기 전) 의 상한 최댓값 — `independent: false` 의 공용 축 */
  globalMax: number;
  independent: boolean;
}

export function bulletModel(
  props: ChartProps,
  rows: readonly ChartRow[],
  input: FamilyInput = familyInput(props),
): BulletModel | null {
  const dimension = requireField(input, "Category", props.dimension);
  const metric = requireField(input, "Value", props.metric);
  const goal = fieldKey(props.goalField);
  const rangeRefs = props.rangeFields ?? [];
  if (
    !Array.isArray(rangeRefs) ||
    rangeRefs.some((ref) => typeof ref !== "string")
  )
    input.error("rangeFields.invalid", "rangeFields must be field names");
  if (!input.ok || dimension === null || metric === null) return null;
  const rangeKeys = rangeRefs
    .map((ref) => fieldKey(ref))
    .filter((k): k is string => k !== null);
  const out: BulletRowModel[] = rows.map((row, i) => {
    const value = readNumber(row, metric);
    const target = goal === null ? NaN : readNumber(row, goal);
    const ranges = rangeKeys
      .map((key) => readNumber(row, key))
      .filter(Number.isFinite);
    const top = Math.max(
      Number.isFinite(value) ? value : 0,
      Number.isFinite(target) ? target : 0,
      ...ranges,
    );
    return {
      row: i,
      label: readLabel(row, dimension),
      value,
      target,
      ranges,
      max: niceDomain(0, top, 4)[1],
    };
  });
  return {
    rows: out,
    globalMax: Math.max(1, ...out.map((r) => r.max)),
    independent: props.independent !== false,
  };
}

/** 구간 띠의 불투명도 단계 — 구간이 많을수록 진하게 (ztd 의 중립 3 단). */
const RANGE_OPACITY = [0.18, 0.32, 0.5];

function bulletScene(
  props: ChartProps,
  rows: readonly ChartRow[],
  size: ChartSize,
  metrics: ChartMetrics,
): ChartScene {
  const frame = chartFrame(size, metrics);
  const { outer, fontSize } = frame;
  const input = familyInput(props);
  const capped =
    rows.length > metrics.rowCap ? rows.slice(0, metrics.rowCap) : rows;
  const model = bulletModel(props, capped, input);
  if (model === null)
    return chartEmptyScene(
      frame.size,
      outer,
      CHART_INVALID_SETTINGS_TEXT,
      input.diagnostics,
    );
  if (rows.length > metrics.rowCap)
    input.warning(
      "budget.rowsTruncated",
      `showing the first ${metrics.rowCap} rows`,
      String(rows.length),
    );
  if (model.rows.length === 0 || outer.w <= 0 || outer.h <= 0)
    return chartEmptyScene(
      frame.size,
      outer,
      CHART_NO_DATA_TEXT,
      input.diagnostics,
    );

  const axisH = model.independent ? 0 : fontSize + 6;
  // 예산 — 줄 하나가 글자 1.6 줄보다 낮아지면 앞 줄만 (공용 축은 잘리기 전 전체의 최댓값).
  const minRow = Math.max(16, fontSize * 1.6);
  const fit = Math.max(0, Math.floor((outer.h - axisH) / minRow));
  const shown = model.rows.slice(0, fit);
  if (shown.length < model.rows.length)
    input.warning(
      "budget.rowsTruncated",
      `showing ${shown.length} of ${model.rows.length} rows`,
      String(model.rows.length),
    );
  if (shown.length === 0)
    return {
      size: frame.size,
      plot: outer,
      marks: [],
      axes: [],
      legend: null,
      tooltip: null,
      empty: false,
      diagnostics: input.diagnostics,
    };

  const labelW = Math.min(
    outer.w * 0.34,
    Math.max(...shown.map((r) => approxTextWidth(r.label, fontSize)), 30) + 10,
  );
  const valW =
    Math.max(
      ...shown.map((r) =>
        approxTextWidth(input.formatValue(r.value), fontSize),
      ),
      20,
    ) + 12;
  const x0 = r2(outer.x + labelW + 6);
  const x1 = r2(Math.max(x0, outer.x + outer.w - valW));
  const band = (outer.h - axisH) / shown.length;
  const barH = Math.max(6, Math.min(12, band * 0.26));
  const rangeH = Math.max(12, Math.min(26, band * 0.58));
  const marks: Mark[] = [];
  const labels: TextMark[] = [];
  const targets: ChartTarget[] = [];
  // ADR-306 Phase 6 — `highlight` 를 주면 그 행만 accent, 나머지 neutral (ztd bullet — 값 / 목표, 기본 min).
  const picked = highlightSet(
    props.highlight,
    shown.map((r) => r.label),
    shown.map((r) => (r.target ? r.value / r.target : NaN)),
  );
  shown.forEach((r, k) => {
    const sx = linearScale(
      [0, model.independent ? r.max : model.globalMax],
      [x0, x1],
    );
    const cy = outer.y + band * k + band / 2;
    const edges = [0, ...r.ranges, r.max].filter(
      (v, j, a) => j === 0 || v > a[j - 1],
    );
    for (let j = 0; j < edges.length - 1; j++) {
      const shade = Math.min(
        RANGE_OPACITY.length - 1,
        Math.round(
          (j / Math.max(1, edges.length - 2)) * (RANGE_OPACITY.length - 1),
        ),
      );
      const left = sx(edges[j]);
      marks.push({
        kind: "rect",
        x: r2(left),
        y: r2(cy - rangeH / 2),
        w: r2(sx(edges[j + 1]) - left),
        h: r2(rangeH),
        seriesIndex: 0,
        fillPaint: "neutral",
        fillOpacity: RANGE_OPACITY[shade],
      });
    }
    const end = Number.isFinite(r.value) ? Math.max(x0, sx(r.value)) : x0;
    marks.push({
      kind: "rect",
      x: x0,
      y: r2(cy - barH / 2),
      w: r2(end - x0),
      h: r2(barH),
      seriesIndex: 0,
      fillPaint: picked && !picked.has(k) ? "neutral" : "accent",
    });
    if (Number.isFinite(r.target)) {
      const tx = r2(sx(r.target));
      marks.push({
        kind: "line",
        x1: tx,
        y1: r2(cy - rangeH / 2 - 2),
        x2: tx,
        y2: r2(cy + rangeH / 2 + 2),
        role: "reference",
        width: 2.5,
      });
    }
    labels.push(
      {
        kind: "text",
        x: r2(outer.x + labelW),
        y: r2(cy),
        text: r.label,
        anchor: "end",
        baseline: "middle",
        role: "legend",
      },
      {
        kind: "text",
        x: r2(outer.x + outer.w),
        y: r2(cy),
        text: input.formatValue(r.value),
        anchor: "end",
        baseline: "middle",
        role: "value",
      },
    );
    const entries: ChartTarget["entries"][number][] = [
      { label: "Actual", text: input.formatValue(r.value), paint: "accent" },
    ];
    if (Number.isFinite(r.target)) {
      entries.push({ label: "Target", text: input.formatValue(r.target) });
      if (r.target && Number.isFinite(r.value))
        entries.push({
          label: "Achieved",
          text: `${r2((r.value / r.target) * 100)}%`,
        });
    }
    targets.push({
      id: `row-${r.row}`,
      x: r2(end),
      y: r2(cy - rangeH / 2),
      rect: { x: outer.x, y: r2(cy - band / 2), w: outer.w, h: r2(band) },
      rows: [r.row],
      title: r.label,
      entries,
    });
  });
  const axisTicks: TextMark[] = [];
  if (!model.independent) {
    const sx = linearScale([0, model.globalMax], [x0, x1]);
    for (const t of ticksFor(0, model.globalMax, 4))
      axisTicks.push({
        kind: "text",
        x: r2(sx(t)),
        y: r2(outer.y + outer.h - axisH / 2),
        text: input.formatValue(t),
        anchor: "middle",
        baseline: "middle",
        role: "tick",
      });
  }
  return {
    size: frame.size,
    plot: outer,
    marks: [...marks, ...labels],
    axes: axisTicks.length
      ? [{ axis: "x", line: null, grid: [], ticks: axisTicks }]
      : [],
    legend: null,
    tooltip: null,
    empty: false,
    targets: props.showTooltip ? targets : [],
    ...(input.diagnostics.length > 0 ? { diagnostics: input.diagnostics } : {}),
  };
}

// ── dumbbell ───────────────────────────────────────────────────────────────

export interface DumbbellRowModel {
  row: number;
  label: string;
  start: number;
  end: number;
}

export interface DumbbellModel {
  rows: DumbbellRowModel[];
  domain: [number, number];
  startName: string;
  endName: string;
}

const SORTS: readonly ChartSort[] = ["none", "ascending", "descending"];

export function dumbbellModel(
  props: ChartProps,
  rows: readonly ChartRow[],
  input: FamilyInput = familyInput(props),
): DumbbellModel | null {
  const dimension = requireField(input, "Category", props.dimension);
  const start = requireField(input, "Start", props.startField);
  const end = requireField(input, "End", props.endField);
  if (!input.ok || dimension === null || start === null || end === null)
    return null;
  const sort: ChartSort = SORTS.includes(props.sort as ChartSort)
    ? (props.sort as ChartSort)
    : "descending";
  let out = rows
    .map((row, i) => ({
      row: i,
      label: readLabel(row, dimension),
      start: readNumber(row, start),
      end: readNumber(row, end),
    }))
    .filter((r) => Number.isFinite(r.start) && Number.isFinite(r.end));
  if (sort !== "none")
    out = [...out].sort((a, b) =>
      sort === "descending" ? b.end - a.end : a.end - b.end,
    );
  let lo = Infinity;
  let hi = -Infinity;
  for (const r of out) {
    lo = Math.min(lo, r.start, r.end);
    hi = Math.max(hi, r.start, r.end);
  }
  const domain = out.length
    ? fitDomain(lo, hi, 4, { zero: props.includeZero === true, pad: 0.08 })
    : ([0, 1] as [number, number]);
  return { rows: out, domain, startName: start, endName: end };
}

/** 범례 견본 — 역할 칠 또는 (표에서 색을 정했으면) 팔레트 자리. */
const legendSwatch = (
  item: ChartSeriesItem | undefined,
  paint: ChartPaintRole,
): { colorIndex: number; fillPaint?: ChartPaintRole } =>
  item?.colored
    ? { colorIndex: item.seriesIndex }
    : { colorIndex: 0, fillPaint: paint };

function dumbbellScene(
  props: ChartProps,
  rows: readonly ChartRow[],
  size: ChartSize,
  metrics: ChartMetrics,
): ChartScene {
  const frame = chartFrame(size, metrics);
  const { fontSize } = frame;
  let { outer } = frame;
  const input = familyInput(props);
  const capped =
    rows.length > metrics.rowCap ? rows.slice(0, metrics.rowCap) : rows;
  const model = dumbbellModel(props, capped, input);
  // ADR-312 Phase 4 — 앞 · 뒤 값의 표시 이름 · 색 (시리즈 표시 표 — `["field", key]`). 색을 정하지 않은 쪽은
  //   역할 칠 (앞 neutral · 뒤 accent) 그대로.
  const series = chartSeriesItems(props, capped, metrics.seriesCount, {
    diagnostics: input.diagnostics,
  });
  const startItem = series.find((item) => item.key === model?.startName);
  const endItem = series.find((item) => item.key === model?.endName);
  const startName = startItem ? chartSeriesName(startItem) : model?.startName;
  const endName = endItem ? chartSeriesName(endItem) : model?.endName;
  if (model === null)
    return chartEmptyScene(
      frame.size,
      outer,
      CHART_INVALID_SETTINGS_TEXT,
      input.diagnostics,
    );
  if (rows.length > metrics.rowCap)
    input.warning(
      "budget.rowsTruncated",
      `showing the first ${metrics.rowCap} rows`,
      String(rows.length),
    );
  if (model.rows.length === 0 || outer.w <= 0 || outer.h <= 0)
    return chartEmptyScene(
      frame.size,
      outer,
      CHART_NO_DATA_TEXT,
      input.diagnostics,
    );

  // 범례 — 이전 (neutral) · 이후 (accent) 견본을 범례 자리 (`legendPosition`) 에 놓고 남은 영역에 그린다.
  //   위 여백은 눈금선 끝 몫만.
  const placed = props.showLegend
    ? placeLegend({
        entries: [
          {
            item: startItem,
            entry: {
              label: startName!,
              ...legendSwatch(startItem, "neutral"),
            },
          },
          {
            item: endItem,
            entry: { label: endName!, ...legendSwatch(endItem, "accent") },
          },
        ]
          .sort((a, b) => series.indexOf(a.item!) - series.indexOf(b.item!))
          .map(({ entry }) => entry),
        outer,
        position: props.legendPosition,
        fontSize,
      })
    : { legend: null, plot: outer };
  outer = placed.plot;
  // 범례 쪽 가장자리는 자기 여백 없이 — 범례 ↔ 그림 간격은 `LEGEND_CHART_GAP` (16) 하나 (사용자 결정 2026-11-16).
  //   위: 눈금선 위끝 (top − 4) 이 영역 경계, 아래: 눈금 글자 아래끝이 영역 경계.
  const legendSide = placed.legend?.position;
  const top = legendSide === "top" ? 4 : fontSize * 0.5;
  const bottom = fontSize + (legendSide === "bottom" ? 3.5 : 7);
  const minRow = Math.max(14, fontSize * 1.4);
  const fit = Math.max(0, Math.floor((outer.h - top - bottom) / minRow));
  const shown = model.rows.slice(0, fit);
  if (shown.length < model.rows.length)
    input.warning(
      "budget.rowsTruncated",
      `showing ${shown.length} of ${model.rows.length} rows`,
      String(model.rows.length),
    );
  if (shown.length === 0)
    return {
      size: frame.size,
      plot: outer,
      marks: [],
      axes: [],
      legend: null,
      tooltip: null,
      empty: false,
      diagnostics: input.diagnostics,
    };

  // 왼쪽 범례면 행 이름 왼끝이 영역 경계 (앞 여백 10 없음 — 범례 ↔ 그림 = `LEGEND_CHART_GAP`).
  const labelW = Math.min(
    outer.w * 0.3,
    Math.max(...shown.map((r) => approxTextWidth(r.label, fontSize)), 24) +
      (legendSide === "left" ? 0 : 10),
  );
  const valPad = props.showValueLabels
    ? Math.max(
        ...shown.map((r) =>
          approxTextWidth(input.formatValue(r.end), fontSize),
        ),
        10,
      ) + 14
    : 8;
  const left = outer.x + labelW + 10;
  const band = (outer.h - top - bottom) / shown.length;
  const yOf = (k: number) => outer.y + top + band * k + band / 2;
  const radius = Math.max(3, Math.min(5.5, band * 0.22));
  const tickValues = ticksFor(
    model.domain[0],
    model.domain[1],
    Math.max(2, Math.round(outer.w / 120)),
  );
  const right = Math.max(
    left,
    legendSide === "right"
      ? dumbbellRightEdge({
          left,
          edge: outer.x + outer.w,
          domain: model.domain,
          ends: shown.map((r) => ({
            value: Math.max(r.start, r.end),
            extra:
              props.showValueLabels && r.end >= r.start
                ? 10 + approxTextWidth(input.formatValue(r.end), fontSize)
                : radius,
          })),
          ticks: tickValues.map((t) => ({
            value: t,
            extra: approxTextWidth(input.formatValue(t), fontSize) / 2,
          })),
        })
      : outer.x + outer.w - valPad,
  );
  const x = linearScale(model.domain, [left, right]);

  const grid: LineMark[] = [];
  const ticks: TextMark[] = [];
  for (const t of tickValues) {
    const tx = r2(x(t));
    grid.push({
      kind: "line",
      x1: tx,
      y1: r2(outer.y + top - 4),
      x2: tx,
      y2: r2(outer.y + outer.h - bottom),
      role: "grid",
    });
    ticks.push({
      kind: "text",
      x: tx,
      y: r2(outer.y + outer.h - bottom + 3.5 + fontSize / 2),
      text: input.formatValue(t),
      anchor: "middle",
      baseline: "middle",
      role: "tick",
    });
  }
  const marks: Mark[] = [];
  const labels: TextMark[] = [];
  const targets: ChartTarget[] = [];
  // ADR-306 Phase 6 — `highlight` 를 주면 그 행의 끝점 · 연결선만 accent (ztd dumbbell — 차이, 기본 max).
  const picked = highlightSet(
    props.highlight,
    shown.map((r) => r.label),
    shown.map((r) => r.end - r.start),
  );
  shown.forEach((r, k) => {
    const cy = r2(yOf(k));
    const xa = r2(x(r.start));
    const xb = r2(x(r.end));
    marks.push(
      {
        kind: "line",
        x1: xa,
        y1: cy,
        x2: xb,
        y2: cy,
        role: "grid",
        paint: picked?.has(k) ? "accent" : "neutral",
        width: 4,
      },
      {
        kind: "path",
        d: circlePath(xa, cy, radius * 0.82),
        bbox: {
          x: r2(xa - radius),
          y: r2(cy - radius),
          w: r2(radius * 2),
          h: r2(radius * 2),
        },
        ...chartSeriesFill(startItem, "neutral"),
      },
      {
        kind: "path",
        d: circlePath(xb, cy, radius),
        bbox: {
          x: r2(xb - radius),
          y: r2(cy - radius),
          w: r2(radius * 2),
          h: r2(radius * 2),
        },
        ...(picked && !picked.has(k)
          ? { fillPaint: "neutral" as const }
          : chartSeriesFill(endItem, "accent")),
      },
    );
    labels.push({
      kind: "text",
      x: r2(outer.x + labelW),
      y: cy,
      text: r.label,
      anchor: "end",
      baseline: "middle",
      role: "legend",
    });
    if (props.showValueLabels) {
      const rightward = xb >= xa;
      labels.push({
        kind: "text",
        x: r2(rightward ? xb + 10 : xb - 10),
        y: cy,
        text: input.formatValue(r.end),
        anchor: rightward ? "start" : "end",
        baseline: "middle",
        role: "value",
      });
    }
    const diff = r.end - r.start;
    targets.push({
      id: `row-${r.row}`,
      x: r2(Math.max(xa, xb)),
      y: r2(cy - radius),
      rect: { x: outer.x, y: r2(cy - band / 2), w: outer.w, h: r2(band) },
      rows: [r.row],
      title: r.label,
      entries: [
        {
          label: startName!,
          text: input.formatValue(r.start),
          ...chartSeriesSwatch(startItem, "neutral"),
        },
        {
          label: endName!,
          text: input.formatValue(r.end),
          ...chartSeriesSwatch(endItem, "accent"),
        },
        {
          label: "Difference",
          text: `${diff >= 0 ? "+" : "−"}${input.formatValue(Math.abs(diff))}`,
        },
      ],
    });
  });

  // 범례 — 이전 (중립) · 이후 (accent), 이름은 필드 이름.
  return {
    size: frame.size,
    plot: outer,
    marks: [...marks, ...labels],
    axes: [{ axis: "x", line: null, grid, ticks }],
    legend: placed.legend,
    tooltip: null,
    empty: false,
    targets: props.showTooltip ? targets : [],
    ...(input.diagnostics.length > 0 ? { diagnostics: input.diagnostics } : {}),
  };
}

/**
 * 오른쪽 범례일 때 dumbbell 값 축의 오른쪽 끝 — 가장 오른쪽으로 나가는 것 (끝 점 · 값 이름표 · 눈금 글자 반) 이 영역
 * 끝 (`edge`) 에 정확히 닿는 값. 각 항목은 `left + f · (right − left) + extra ≤ edge` (f = 값의 축 비율) 이다.
 */
function dumbbellRightEdge(o: {
  left: number;
  edge: number;
  domain: readonly [number, number];
  ends: readonly { value: number; extra: number }[];
  ticks: readonly { value: number; extra: number }[];
}): number {
  // 축 끝 (nice 범위의 끝) 에는 그려지는 것이 없을 수 있어 `edge` 로 자르지 않는다 — 그려진 것의 끝이 경계에 닿는다.
  const span = o.domain[1] - o.domain[0] || 1;
  let right = Infinity;
  for (const { value, extra } of [...o.ends, ...o.ticks]) {
    const f = (value - o.domain[0]) / span;
    if (f > 0) right = Math.min(right, o.left + (o.edge - o.left - extra) / f);
  }
  return Number.isFinite(right) ? right : o.edge;
}

// ── family ─────────────────────────────────────────────────────────────────

/** 새 차트의 기본 행 — ztd `spec/samples.ts` 의 gauge · bullet · dumbbell 표본. */
const SAMPLES: Record<"gauge" | "bullet" | "dumbbell", readonly ChartRow[]> = {
  gauge: [{ label: "Goal reached", value: 73, target: 85 }],
  bullet: [
    { kpi: "Revenue", actual: 27.4, target: 30, poor: 18, ok: 25, good: 34 },
    { kpi: "Profit", actual: 4.1, target: 3.6, poor: 2, ok: 3, good: 5 },
    {
      kpi: "New customers",
      actual: 12.8,
      target: 15,
      poor: 8,
      ok: 12,
      good: 18,
    },
    {
      kpi: "Satisfaction",
      actual: 4.3,
      target: 4.5,
      poor: 3.5,
      ok: 4,
      good: 5,
    },
  ],
  dumbbell: [
    { region: "Seoul", before: 3.2, after: 4.6 },
    { region: "Gyeonggi", before: 2.8, after: 3.9 },
    { region: "Busan", before: 2.1, after: 2.6 },
    { region: "Daegu", before: 1.9, after: 2.2 },
    { region: "Incheon", before: 2.3, after: 3.1 },
    { region: "Gwangju", before: 1.6, after: 1.8 },
    { region: "Daejeon", before: 1.7, after: 2.4 },
  ],
};

const SAMPLE_PROPS: Record<
  "gauge" | "bullet" | "dumbbell",
  Partial<ChartProps>
> = {
  gauge: {
    dimension: "label",
    metric: "value",
    goalField: "target",
    centerLabel: "Goal reached",
    valueMin: 0,
    valueMax: 100,
    shape: "arc",
  },
  bullet: {
    dimension: "kpi",
    metric: "actual",
    goalField: "target",
    rangeFields: ["poor", "ok", "good"],
  },
  dumbbell: {
    dimension: "region",
    startField: "before",
    endField: "after",
    showValueLabels: true,
  },
};

const KPI_TYPES = ["gauge", "bullet", "dumbbell"] as const;
type KpiType = (typeof KPI_TYPES)[number];
const isKpi = (type: FamilyChartType): type is KpiType =>
  (KPI_TYPES as readonly string[]).includes(type);

export const kpiFamily: ChartFamily = {
  id: "kpi",
  buildScene: withRowPolicy((props, rows, size, metrics) => {
    switch (props.chartType) {
      case "gauge":
        return gaugeScene(props, rows, size, metrics);
      case "bullet":
        return bulletScene(props, rows, size, metrics);
      case "dumbbell":
        return dumbbellScene(props, rows, size, metrics);
      default:
        return chartEmptyScene(
          chartFrame(size, metrics).size,
          chartFrame(size, metrics).outer,
          CHART_INVALID_SETTINGS_TEXT,
          [
            {
              code: "chartType.unsupported",
              severity: "error",
              message: `kpi family does not draw ${String(props.chartType)}`,
              value: String(props.chartType),
            },
          ],
        );
    }
  }),
  sample(type) {
    return isKpi(type) ? SAMPLES[type].map((row) => ({ ...row })) : [];
  },
  sampleProps(type) {
    return isKpi(type) ? { ...SAMPLE_PROPS[type] } : {};
  },
};
