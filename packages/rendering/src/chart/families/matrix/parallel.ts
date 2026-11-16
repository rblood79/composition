/**
 * ADR-306 Phase 4 — parallel (breakdown §2.2 #32). 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT —
 * `src/charts/parallel.tsx` · `traceGapped`) 을 따른다: 값 필드마다 세운 축 (`fitDomain` pad 0.02 · 0
 * 미포함), `invertFields` 는 작은 값이 위, 값이 없는 축에서 선을 끊는다, 첫 행 강조 (accent · 위에 그림),
 * 나머지는 중립. 축 이름은 값 필드 이름 (시리즈 표의 label — ztd `dimensionLabels` 대응 · §3).
 */
import { highlightIndex } from "../../highlight";
import { approxTextWidth, linearScale, r2 } from "../../scales";
import type { ChartTarget, Mark, TextMark } from "../../types";
import {
  finiteExtent,
  invalidScene,
  noDataScene,
  sceneOf,
  type CategoryContext,
} from "../category/common";
import { fieldKey, readLabel, readNumber } from "../fields";
import { fitDomain } from "../niceScale";
import { fitText } from "../shapes";
import { chartSeriesByKey, chartSeriesItems } from "../../seriesItems";

/** 그리는 선 상한 (ztd 는 1,500 을 넘으면 canvas — 여기서는 앞 행만). */
export const PARALLEL_MAX_LINES = 1500;

export interface ParallelModel {
  dims: string[];
  names: string[];
  lines: { row: number; label: string; vals: number[] }[];
  domains: [number, number][];
  inverted: boolean[];
}

export function parallelModel(ctx: CategoryContext): ParallelModel | null {
  const { props, rows, input } = ctx;
  const refs = Array.isArray(props.valueFields) ? props.valueFields : [];
  const pairs = refs
    .map((ref) => ({ ref, key: fieldKey(ref) }))
    .filter((p): p is { ref: string; key: string } => p.key !== null);
  const dims = pairs.map((p) => p.key);
  if (dims.length < 2)
    input.error(
      "role.missing",
      "Value Columns needs 2 or more fields",
      "Value Columns",
    );
  if (!input.ok) return null;
  const labelKey = fieldKey(props.labelField);
  const invert = new Set(
    (Array.isArray(props.invertFields) ? props.invertFields : [])
      .map((ref) => fieldKey(ref))
      .filter((k): k is string => k !== null),
  );
  const lines = rows.map((row, i) => ({
    row: i,
    label: labelKey === null ? "" : readLabel(row, labelKey),
    vals: dims.map((k) => readNumber(row, k)),
  }));
  // 축 이름 = 시리즈 표시 표 (`seriesConfig`) 의 이름, 없으면 필드 이름. ADR-312 Phase 4 — identity 는 시리즈
  //   경로와 같은 `["field", key]` (전에는 원 key · 참조와 비교해 패널이 쓴 항목과 맞지 않았다). 축 순서는 값 열
  //   목록, 선 색은 행마다라 표의 순서 · 색은 읽지 않는다.
  const series = chartSeriesByKey(
    chartSeriesItems(props, rows, ctx.metrics.seriesCount, {
      diagnostics: input.diagnostics,
    }),
  );
  return {
    dims,
    names: pairs.map(({ key }) => series.get(key)?.label || key),
    lines,
    domains: dims.map((_, j) => {
      const [lo, hi] = finiteExtent(lines.map((l) => l.vals[j]));
      return fitDomain(lo, hi, 4, { zero: false, pad: 0.02 });
    }),
    inverted: dims.map((k) => invert.has(k)),
  };
}

export function parallelScene(ctx: CategoryContext) {
  const model = parallelModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.lines.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const lines = model.lines.slice(0, PARALLEL_MAX_LINES);
  if (lines.length < model.lines.length)
    input.warning(
      "budget.rowsTruncated",
      `showing ${lines.length} of ${model.lines.length} rows`,
      String(model.lines.length),
    );
  const nd = model.dims.length;
  // ADR-306 Phase 6 — `highlight`: 선 이름 (`labelField`) · 첫 축 값 (비면 첫 행 — ztd 기본 first).
  const hiK = highlightIndex(
    props.highlight,
    lines.map((l) => l.label),
    lines.map((l) => l.vals[0] ?? NaN),
    0,
  );
  const hiLine = hiK >= 0 ? lines[hiK] : undefined;
  const showLabels = props.showValueLabels !== false && lines.length <= 60;
  const labelR =
    showLabels && hiLine?.label
      ? Math.min(outer.w * 0.18, approxTextWidth(hiLine.label, fontSize) + 14)
      : 0;
  const nameW = model.names.map((k) => approxTextWidth(k, fontSize));
  const x0 =
    outer.x + Math.max(24, Math.min(outer.w * 0.15, (nameW[0] ?? 0) / 2 + 4));
  const x1 =
    outer.x +
    outer.w -
    Math.max(
      24,
      labelR,
      Math.min(outer.w * 0.15, (nameW[nd - 1] ?? 0) / 2 + 4),
    );
  const gapX = nd > 1 ? (x1 - x0) / (nd - 1) : 128;
  const stagger = nd > 2 && nameW.some((w) => w > gapX - 8);
  const bottom = outer.y + outer.h - (fontSize + 6);
  // 축 이름 줄이 그림 높이를 다 먹으면 (Library 칸 140 × 78) 이름을 빼고 선을 그린다 — 이름은 툴팁에
  //   남는다 (ADR-306 Phase 5 live 에서 발견: 이름 줄 때문에 선이 하나도 그려지지 않았다).
  const namedTop = outer.y + (stagger ? fontSize * 4 : fontSize * 2.7);
  const showNames = bottom - namedTop >= fontSize * 2;
  const top = showNames ? namedTop : outer.y + 4;
  if (bottom - top < 8 || x1 - x0 < 8) return sceneOf(ctx, { marks: [] });
  const axX = (j: number) =>
    nd > 1 ? x0 + (j * (x1 - x0)) / (nd - 1) : (x0 + x1) / 2;
  const scales = model.domains.map((dm, j) =>
    linearScale(dm, model.inverted[j] ? [top, bottom] : [bottom, top]),
  );
  const bbox = { x: r2(x0), y: r2(top), w: r2(x1 - x0), h: r2(bottom - top) };
  const pathOf = (ys: readonly number[]) => {
    let d = "";
    let pen = false;
    ys.forEach((yy, j) => {
      if (!Number.isFinite(yy)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${r2(axX(j))},${r2(yy)}`;
      pen = true;
    });
    return d;
  };
  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  const ysOf = (vals: readonly number[]) =>
    vals.map((v, j) => (Number.isFinite(v) ? scales[j](v) : NaN));
  // 강조 선은 마지막에 (위에 그린다).
  const order = [
    ...lines.filter((l) => l !== hiLine),
    ...(hiLine ? [hiLine] : []),
  ];
  for (const l of order) {
    const hi = l === hiLine;
    const ys = ysOf(l.vals);
    const d = pathOf(ys);
    if (d)
      marks.push({
        kind: "path",
        d,
        bbox,
        strokeWidth: hi ? 2.6 : 1.3,
        strokePaint: hi ? "accent" : "neutral",
      });
  }
  lines.forEach((l) => {
    const ys = ysOf(l.vals);
    const mid = Math.floor((nd - 1) / 2);
    const ty = Number.isFinite(ys[mid]) ? ys[mid] : (top + bottom) / 2;
    targets.push({
      id: `line-${l.row}`,
      x: r2(axX(mid)),
      y: r2(ty),
      r: 8,
      rows: [l.row],
      title: l.label || `#${l.row + 1}`,
      entries: model.names.map((name, j) => ({
        label: name,
        text: fx(l.vals[j]),
        ...(l === hiLine ? { paint: "accent" as const } : {}),
      })),
    });
  });
  // 축 끝 값은 축 사이 간격에 들고 그림이 글자 10 줄보다 높을 때만 (작은 상자에서 이웃 값과 겹친다).
  const endWidth = Math.max(
    ...model.domains.flatMap(([lo, hiV]) =>
      [lo, hiV].map((v) => approxTextWidth(fx(v), fontSize)),
    ),
  );
  const endValues = gapX >= endWidth + 8 && outer.h >= fontSize * 10;
  model.dims.forEach((_, j) => {
    const xx = axX(j);
    const [lo, hiV] = model.domains[j];
    const inv = model.inverted[j];
    const room = stagger
      ? Math.min(2 * gapX, 2 * Math.min(xx - outer.x, outer.x + outer.w - xx)) -
        8
      : gapX - 8;
    marks.push({
      kind: "line",
      x1: r2(xx),
      y1: r2(top),
      x2: r2(xx),
      y2: r2(bottom),
      role: "axis",
    });
    if (showNames)
      texts.push({
        kind: "text",
        x: r2(xx),
        y: r2(outer.y + (stagger && j % 2 ? fontSize * 2.2 : fontSize * 0.7)),
        text: fitText(model.names[j], room, fontSize),
        anchor: "middle",
        baseline: "middle",
        role: "legend",
      });
    if (endValues)
      texts.push(
        {
          kind: "text",
          x: r2(xx + 4),
          y: r2(top - fontSize * 0.8),
          text: fx(inv ? lo : hiV),
          anchor: "start",
          baseline: "middle",
          role: "tick",
        },
        {
          kind: "text",
          x: r2(xx + 4),
          y: r2(bottom + fontSize * 0.8),
          text: fx(inv ? hiV : lo),
          anchor: "start",
          baseline: "middle",
          role: "tick",
        },
      );
  });
  if (showLabels && hiLine?.label) {
    const ys = ysOf(hiLine.vals);
    const last = ys[nd - 1];
    if (Number.isFinite(last))
      texts.push({
        kind: "text",
        x: r2(x1 + 8),
        y: r2(last),
        text: fitText(hiLine.label, labelR - 10, fontSize),
        anchor: "start",
        baseline: "middle",
        role: "value",
      });
  }
  return sceneOf(ctx, { marks: [...marks, ...texts], targets });
}
