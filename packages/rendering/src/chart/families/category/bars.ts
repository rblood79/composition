/**
 * ADR-306 Phase 3 — category family 의 막대 · 칸 종류 6: lollipop · segmented · waffle · funnel ·
 * pareto · waterfall. 뜻 (정렬 · 강조 · 비율 · 누적) 은 ztd-charts 0.5.0 (`3c4376c`, MIT —
 * `src/charts/{lollipop,segmented,waffle,funnel,pareto,waterfall}.tsx`) 을 따르고, 배치 비율도 그
 * 값을 쓰되 글자 크기만 rule metric 에 맞춘다. 모델 함수 (`*Model`) 는 크기 독립이고 테스트가 직접 잰다.
 *
 * 색: 하나만 강조하는 종류 (lollipop · funnel · pareto) 는 paint 역할 accent / neutral, 증감은
 * positive / negative, 항목마다 색이 필요한 종류 (segmented · waffle) 는 시리즈 팔레트 (`seriesIndex`).
 */
import { circlePath } from "../../marks/dots";
import {
  firstHighlight,
  highlightColor,
  highlightIndex,
  highlightSet,
} from "../../highlight";
import { approxTextWidth, linearScale, r2 } from "../../scales";
import type {
  AxisScene,
  ChartRateBase,
  ChartTarget,
  LineMark,
  Mark,
  TextMark,
} from "../../types";
import { fieldKey, readLabel, readNumber, requireField } from "../fields";
import { fitDomain, ticksFor } from "../niceScale";
import { allocateCells, fitText, roundRectPath } from "../shapes";
import {
  argMax,
  argMin,
  bandLayout,
  categoryLabels,
  finiteExtent,
  invalidScene,
  noDataScene,
  sceneOf,
  sortByValue,
  sortOf,
  tickColumnWidth,
  truncated,
  valueAxisX,
  valueAxisY,
  type CategoryContext,
} from "./common";

export const pct = (v: number) =>
  Number.isFinite(v) ? `${Math.round(v * 10) / 10}%` : "-";

export interface LabeledValue {
  /** 원본 행 */
  row: number;
  label: string;
  value: number;
}

/** dimension + metric 두 필수 역할을 읽는다 (null = 설정 오류). */
function labelValues(
  ctx: CategoryContext,
  clampNegative: boolean,
): LabeledValue[] | null {
  const { props, rows, input } = ctx;
  const dimension = requireField(input, "Category", props.dimension);
  const metric = requireField(input, "Value", props.metric);
  if (!input.ok || dimension === null || metric === null) return null;
  return rows.map((row, i) => {
    const raw = readNumber(row, metric);
    return {
      row: i,
      label: readLabel(row, dimension),
      value: clampNegative ? Math.max(0, Number.isFinite(raw) ? raw : 0) : raw,
    };
  });
}

// ── lollipop ───────────────────────────────────────────────────────────────

export interface LollipopModel {
  items: LabeledValue[];
  domain: [number, number];
  /** 강조 (가장 큰 값) — items 안의 인덱스 */
  hi: number;
}

export function lollipopModel(ctx: CategoryContext): LollipopModel | null {
  const values = labelValues(ctx, false);
  if (values === null) return null;
  const items = sortByValue(values, sortOf(ctx.props, "descending"));
  const nums = items.map((r) => r.value);
  const [mn, mx] = finiteExtent(nums);
  return {
    items,
    domain: fitDomain(mn, mx, 4),
    // ADR-306 Phase 6 — `highlight` (비면 가장 큰 값 — 지금 그대로).
    hi: highlightIndex(
      ctx.props.highlight,
      items.map((r) => r.label),
      nums,
      argMax(nums),
    ),
  };
}

export function lollipopScene(ctx: CategoryContext) {
  const model = lollipopModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.items.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { input, props } = ctx;
  const vertical = props.orientation === "vertical";
  const fx = input.formatValue;
  const showValues = props.showValueLabels === true;
  const minStep = Math.max(12, fontSize * 1.3);
  const marks: Mark[] = [];
  const labels: TextMark[] = [];
  const targets: ChartTarget[] = [];
  const axes: AxisScene[] = [];
  const dotR = (hi: boolean) => (hi ? 6.5 : 5.5);

  if (!vertical) {
    const bottom = fontSize + 8;
    const fit = Math.max(0, Math.floor((outer.h - 4 - bottom) / minStep));
    const items = model.items.slice(0, fit);
    truncated(ctx, items.length, model.items.length);
    if (items.length === 0) return sceneOf(ctx, { marks: [] });
    const labelW = Math.min(
      outer.w * 0.32,
      Math.max(...items.map((r) => approxTextWidth(r.label, fontSize)), 24) +
        10,
    );
    const valPad = showValues
      ? Math.max(
          ...items.map((r) => approxTextWidth(fx(r.value), fontSize)),
          10,
        ) + 16
      : 8;
    const negPad =
      showValues && model.domain[0] < 0
        ? Math.max(
            ...items.map((r) =>
              r.value < 0 ? approxTextWidth(fx(r.value), fontSize) : 0,
            ),
          ) + 16
        : 0;
    const left = outer.x + labelW + 6;
    const right = outer.x + outer.w;
    const x = linearScale(model.domain, [left + negPad, right - valPad]);
    const base = x(Math.max(model.domain[0], 0));
    const band = bandLayout(
      items.length,
      outer.y + 4,
      outer.y + outer.h - bottom,
      0.4,
      0.1,
    );
    axes.push(
      valueAxisX(
        ctx,
        model.domain,
        x,
        outer.y + 4,
        outer.y + outer.h - bottom,
        Math.max(2, Math.round(outer.w / 120)),
      ),
    );
    items.forEach((r, k) => {
      const hi = model.items.indexOf(r) === model.hi;
      const pos = r2(band.at(k) + band.bandwidth / 2);
      const end = r2(x(Number.isFinite(r.value) ? r.value : 0));
      const rr = dotR(hi);
      marks.push(
        {
          kind: "line",
          x1: r2(base),
          y1: pos,
          x2: end,
          y2: pos,
          role: "grid",
          paint: hi ? "accent" : "neutral",
          width: 2.2,
        },
        {
          kind: "path",
          d: circlePath(end, pos, rr),
          bbox: { x: r2(end - rr), y: r2(pos - rr), w: rr * 2, h: rr * 2 },
          fillPaint: hi ? "accent" : "neutral",
        },
      );
      labels.push({
        kind: "text",
        x: r2(outer.x + labelW),
        y: pos,
        text: fitText(r.label, labelW - 4, fontSize),
        anchor: "end",
        baseline: "middle",
        role: "legend",
      });
      if (showValues) {
        const neg = r.value < 0;
        labels.push({
          kind: "text",
          x: r2(neg ? end - 12 : end + 12),
          y: pos,
          text: fx(r.value),
          anchor: neg ? "end" : "start",
          baseline: "middle",
          role: "value",
        });
      }
      targets.push({
        id: `row-${r.row}`,
        x: end,
        y: r2(pos - rr),
        rect: {
          x: outer.x,
          y: r2(pos - band.step / 2),
          w: outer.w,
          h: r2(band.step),
        },
        rows: [r.row],
        title: r.label,
        entries: [
          {
            label: "Value",
            text: fx(r.value),
            paint: hi ? "accent" : "neutral",
          },
        ],
      });
    });
    return sceneOf(ctx, { marks: [...marks, ...labels], axes, targets });
  }

  // 세로 — 범주 아래, 값 축 왼쪽.
  const ticks = ticksFor(model.domain[0], model.domain[1], 4);
  const left = outer.x + tickColumnWidth(ticks, fx, fontSize);
  const top = outer.y + fontSize * 1.4;
  const bottom = outer.y + outer.h - (fontSize + 10);
  const fit = Math.max(0, Math.floor((outer.x + outer.w - left) / minStep));
  const items = model.items.slice(0, fit);
  truncated(ctx, items.length, model.items.length);
  if (items.length === 0) return sceneOf(ctx, { marks: [] });
  const negPad = model.domain[0] < 0 ? 16 : 0;
  const y = linearScale(model.domain, [bottom - negPad, top]);
  const base = y(Math.max(model.domain[0], 0));
  const band = bandLayout(
    items.length,
    left + 4,
    outer.x + outer.w - 4,
    0.4,
    0.1,
  );
  axes.push(valueAxisY(ctx, model.domain, ticks, y, left, outer.x + outer.w));
  const centers: number[] = [];
  items.forEach((r, k) => {
    const hi = model.items.indexOf(r) === model.hi;
    const pos = r2(band.at(k) + band.bandwidth / 2);
    centers.push(pos);
    const end = r2(y(Number.isFinite(r.value) ? r.value : 0));
    const rr = dotR(hi);
    marks.push(
      {
        kind: "line",
        x1: pos,
        y1: r2(base),
        x2: pos,
        y2: end,
        role: "grid",
        paint: hi ? "accent" : "neutral",
        width: 2.2,
      },
      {
        kind: "path",
        d: circlePath(pos, end, rr),
        bbox: { x: r2(pos - rr), y: r2(end - rr), w: rr * 2, h: rr * 2 },
        fillPaint: hi ? "accent" : "neutral",
      },
    );
    if (showValues) {
      const neg = r.value < 0;
      labels.push({
        kind: "text",
        x: pos,
        y: r2(neg ? end + 14 : end - 14),
        text: fx(r.value),
        anchor: "middle",
        baseline: "middle",
        role: "value",
      });
    }
    targets.push({
      id: `row-${r.row}`,
      x: pos,
      y: r2(end - rr),
      rect: {
        x: r2(pos - band.step / 2),
        y: outer.y,
        w: r2(band.step),
        h: outer.h,
      },
      rows: [r.row],
      title: r.label,
      entries: [
        { label: "Value", text: fx(r.value), paint: hi ? "accent" : "neutral" },
      ],
    });
  });
  axes.push(
    categoryLabels(
      ctx,
      items.map((r) => r.label),
      centers,
      bottom + fontSize * 0.5 + 6,
    ),
  );
  return sceneOf(ctx, { marks: [...marks, ...labels], axes, targets });
}

// ── segmented ──────────────────────────────────────────────────────────────

export interface SegmentPart extends LabeledValue {
  share: number;
  /** 시리즈 팔레트 자리 (정렬 뒤 순서) */
  color: number;
}

export function segmentedModel(
  ctx: CategoryContext,
): { parts: SegmentPart[]; total: number } | null {
  const values = labelValues(ctx, true);
  if (values === null) return null;
  const ordered = sortByValue(values, sortOf(ctx.props, "descending"));
  const total = ordered.reduce((s, r) => s + r.value, 0);
  const n = Math.max(1, ctx.metrics.seriesCount);
  // ADR-306 Phase 6 — `highlight` 를 주면 강조 밖 조각은 neutral (others 색 index — ztd segmented 기본 max).
  const picked = highlightSet(
    ctx.props.highlight,
    ordered.map((r) => r.label),
    ordered.map((r) => r.value),
  );
  return {
    parts: ordered.map((r, k) => ({
      ...r,
      share: total > 0 ? r.value / total : 0,
      color: highlightColor(picked, k, k % n),
    })),
    total,
  };
}

export function segmentedScene(ctx: CategoryContext) {
  const model = segmentedModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.parts.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const tall = props.shape !== "thin";
  const barH = tall ? 28 : 8;
  const top = outer.y + 2;
  const gap = 2;
  const radius = tall ? 4 : barH / 2;
  const marks: Mark[] = [];
  const targets: ChartTarget[] = [];
  const drawn = model.parts.filter((q) => q.share > 0);
  const room = Math.max(0, outer.w - gap * Math.max(0, drawn.length - 1));
  let cursor = outer.x;
  const geo = new Map<SegmentPart, { x: number; w: number }>();
  if (drawn.length === 0)
    marks.push({
      kind: "path",
      d: roundRectPath(outer.x, top, outer.w, barH, radius),
      bbox: { x: outer.x, y: top, w: outer.w, h: barH },
      fillRole: "grid",
    });
  for (const q of drawn) {
    const w = room * q.share;
    geo.set(q, { x: cursor, w });
    if (w >= 0.5)
      marks.push({
        kind: "path",
        d: roundRectPath(cursor, top, w, barH, Math.min(radius, w / 2)),
        bbox: { x: r2(cursor), y: r2(top), w: r2(w), h: barH },
        fillSeries: q.color,
        fillOpacity: 1,
      });
    cursor += w + gap;
  }
  // 막대 아래 목록 (이름 · 값 · 비중) — showLegend 가 끄면 막대만.
  const rowH = Math.max(22, fontSize * 2.2);
  const cols = outer.w >= 420 && model.parts.length >= 4 ? 2 : 1;
  const colW = outer.w / cols;
  const listTop = top + barH + 18;
  const fitRows = Math.max(
    0,
    Math.floor((outer.y + outer.h - listTop + rowH / 2) / rowH),
  );
  const listed = props.showLegend ? model.parts.slice(0, fitRows * cols) : [];
  if (props.showLegend) truncated(ctx, listed.length, model.parts.length);
  const listMarks: Mark[] = [];
  listed.forEach((q, k) => {
    const col = k % cols;
    const row = Math.floor(k / cols);
    const x = outer.x + col * colW;
    const y = r2(listTop + row * rowH);
    const right = x + colW - (cols > 1 && col === 0 ? 16 : 0);
    const shareText = pct(q.share * 100);
    const valueText = input.formatValue(q.value);
    const shareW = approxTextWidth(shareText, fontSize);
    const valueW = approxTextWidth(valueText, fontSize);
    listMarks.push(
      {
        kind: "rect",
        x: r2(x),
        y: r2(y - 5),
        w: 10,
        h: 10,
        seriesIndex: q.color,
      },
      {
        kind: "text",
        x: r2(x + 18),
        y,
        text: fitText(
          q.label,
          Math.max(24, right - x - 36 - shareW - valueW),
          fontSize,
        ),
        anchor: "start",
        baseline: "middle",
        role: "legend",
      },
      {
        kind: "text",
        x: r2(right - shareW - 10),
        y,
        text: valueText,
        anchor: "end",
        baseline: "middle",
        role: "value",
      },
      {
        kind: "text",
        x: r2(right),
        y,
        text: shareText,
        anchor: "end",
        baseline: "middle",
        role: "tick",
      },
    );
  });
  for (const q of model.parts) {
    const g = geo.get(q);
    if (!g) continue;
    targets.push({
      id: `row-${q.row}`,
      x: r2(g.x + g.w / 2),
      y: r2(top),
      rect: { x: r2(g.x), y: r2(top), w: r2(g.w), h: barH },
      rows: [q.row],
      title: q.label,
      entries: [
        { label: "Value", text: input.formatValue(q.value), series: q.color },
        { label: "Share", text: pct(q.share * 100) },
      ],
    });
  }
  return sceneOf(ctx, { marks: [...marks, ...listMarks], targets });
}

// ── waffle ─────────────────────────────────────────────────────────────────

export interface WaffleModel {
  items: (LabeledValue & { color: number })[];
  /** ADR-306 Phase 6 — 요약 숫자의 행 (`highlight`, 비면 첫 행). */
  hi: number;
  /** 항목마다 칸 수 (합 = 칸 수, `valueMax` 가 합보다 크면 비율만큼) */
  counts: number[];
  cells: number;
  columns: number;
  total: number;
}

export function waffleModel(ctx: CategoryContext): WaffleModel | null {
  const values = labelValues(ctx, true);
  if (values === null) return null;
  const { props } = ctx;
  const finite = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const cells = Math.max(
    1,
    Math.min(400, Math.round(finite(props.cells, 100))),
  );
  const columns = Math.max(
    1,
    Math.min(cells, Math.round(finite(props.columns, 10))),
  );
  const total =
    props.valueMax !== undefined && Number.isFinite(props.valueMax)
      ? props.valueMax
      : values.reduce((s, r) => s + r.value, 0);
  const n = Math.max(1, ctx.metrics.seriesCount);
  // ADR-306 Phase 6 — `highlight` 를 주면 강조 밖 칸은 neutral, 요약 숫자는 강조 행 (ztd waffle 기본 first).
  const picked = highlightSet(
    ctx.props.highlight,
    values.map((r) => r.label),
    values.map((r) => r.value),
  );
  return {
    hi: picked ? firstHighlight(picked) : 0,
    items: values.map((r, k) => ({
      ...r,
      color: highlightColor(picked, k, k % n),
    })),
    counts: allocateCells(
      values.map((r) => r.value),
      cells,
      props.valueMax !== undefined && Number.isFinite(props.valueMax)
        ? props.valueMax
        : undefined,
    ),
    cells,
    columns,
    total,
  };
}

export function waffleScene(ctx: CategoryContext) {
  const model = waffleModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.items.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const { cells, columns: cols } = model;
  const rowsN = Math.ceil(cells / cols);
  const summary = props.showTotal !== false && outer.w >= 260;
  const gap = outer.w < 360 ? 2.5 : 3.5;
  const gridMaxW = summary ? outer.w * 0.58 : outer.w;
  const cell = Math.max(
    3,
    Math.min(
      (gridMaxW - (cols - 1) * gap) / cols,
      (outer.h - (rowsN - 1) * gap) / rowsN,
    ),
  );
  const gridW = cols * cell + (cols - 1) * gap;
  const gridH = rowsN * cell + (rowsN - 1) * gap;
  const gy = outer.y + (outer.h - gridH) / 2;
  const hiRow = model.items[Math.max(0, model.hi)];
  const share = model.total > 0 ? (hiRow.value / model.total) * 100 : 0;
  const others = model.items
    .filter((r) => r !== hiRow)
    .map((r) => `${r.label} ${input.formatValue(r.value)}`)
    .join(" · ");
  const gapS = Math.max(14, (outer.w - gridW) * 0.12);
  const room = outer.w - gridW - gapS;
  const big = Math.max(24, Math.min(46, room * 0.32, outer.h * 0.24));
  const label = props.centerLabel || hiRow.label;
  const sumW = summary
    ? Math.min(
        room,
        Math.max(
          approxTextWidth(pct(share), big),
          approxTextWidth(label, fontSize),
          others ? approxTextWidth(others, fontSize) : 0,
        ),
      )
    : 0;
  const gx = summary
    ? outer.x + Math.max(0, (outer.w - (gridW + gapS + sumW)) / 2)
    : outer.x + (outer.w - gridW) / 2;
  const owner: number[] = [];
  model.counts.forEach((n, k) => {
    for (let j = 0; j < n; j++) owner.push(k);
  });
  const marks: Mark[] = [];
  const boxes = model.items.map(() => ({
    x0: Infinity,
    y0: Infinity,
    x1: -Infinity,
    y1: -Infinity,
  }));
  const radius = Math.min(cell * 0.22, 4);
  for (let idx = 0; idx < cells; idx++) {
    const k = owner[idx] ?? -1;
    const x = gx + (idx % cols) * (cell + gap);
    const y = gy + Math.floor(idx / cols) * (cell + gap);
    const bbox = { x: r2(x), y: r2(y), w: r2(cell), h: r2(cell) };
    marks.push(
      k >= 0
        ? {
            kind: "path",
            d: roundRectPath(x, y, cell, cell, radius),
            bbox,
            fillSeries: model.items[k].color,
            fillOpacity: 1,
          }
        : {
            kind: "path",
            d: roundRectPath(x, y, cell, cell, radius),
            bbox,
            fillRole: "grid",
          },
    );
    if (k >= 0) {
      const b = boxes[k];
      b.x0 = Math.min(b.x0, x);
      b.y0 = Math.min(b.y0, y);
      b.x1 = Math.max(b.x1, x + cell);
      b.y1 = Math.max(b.y1, y + cell);
    }
  }
  if (summary) {
    const sx = r2(gx + gridW + gapS);
    const cy = outer.y + outer.h / 2;
    marks.push(
      {
        kind: "text",
        x: sx,
        y: r2(cy - big * 0.32),
        text: pct(share),
        anchor: "start",
        baseline: "middle",
        role: "value",
        fontScale: r2(big / fontSize),
      },
      {
        kind: "text",
        x: sx,
        y: r2(cy + big * 0.42),
        text: fitText(label, outer.x + outer.w - sx - 2, fontSize),
        anchor: "start",
        baseline: "middle",
        role: "legend",
      },
    );
    if (others)
      marks.push({
        kind: "text",
        x: sx,
        y: r2(cy + big * 0.42 + fontSize * 1.5),
        text: fitText(others, outer.x + outer.w - sx - 2, fontSize),
        anchor: "start",
        baseline: "middle",
        role: "tick",
      });
  }
  const targets: ChartTarget[] = model.items.flatMap((r, k) => {
    const b = boxes[k];
    if (!Number.isFinite(b.x0)) return [];
    return [
      {
        id: `row-${r.row}`,
        x: r2(b.x0 + cell / 2),
        y: r2(b.y0),
        rect: {
          x: r2(b.x0),
          y: r2(b.y0),
          w: r2(b.x1 - b.x0),
          h: r2(b.y1 - b.y0),
        },
        rows: [r.row],
        title: r.label,
        entries: [
          { label: "Value", text: input.formatValue(r.value), series: r.color },
          {
            label: "Share",
            text: pct(model.total ? (r.value / model.total) * 100 : 0),
          },
          { label: "Cells", text: String(model.counts[k]) },
        ],
      },
    ];
  });
  return sceneOf(ctx, { marks, targets });
}

// ── funnel ─────────────────────────────────────────────────────────────────

export interface FunnelModel {
  stages: (LabeledValue & { rate: number | null })[];
  /** 전환율이 가장 낮은 단계 (강조) */
  hi: number;
  base: ChartRateBase;
}

export function funnelModel(ctx: CategoryContext): FunnelModel | null {
  const values = labelValues(ctx, true);
  if (values === null) return null;
  const base: ChartRateBase =
    ctx.props.rateBase === "first" ? "first" : "previous";
  const stages = values.map((r, i) => {
    const ref = base === "first" ? values[0].value : values[i - 1]?.value;
    return {
      ...r,
      rate: i === 0 ? null : ref ? (r.value / ref) * 100 : 0,
    };
  });
  return {
    stages,
    // ADR-306 Phase 6 — 비면 전환율이 가장 낮은 단계, 지정하면 값으로 (ztd funnel 과 같다).
    hi: highlightIndex(
      ctx.props.highlight,
      stages.map((s) => s.label),
      stages.map((s) => s.value),
      argMin(stages.map((s) => (s.rate === null ? NaN : s.rate))),
    ),
    base,
  };
}

export function funnelScene(ctx: CategoryContext) {
  const model = funnelModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.stages.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const showRates = props.showRates !== false;
  const fit = Math.max(0, Math.floor(outer.h / Math.max(20, fontSize * 2.6)));
  const stages = model.stages.slice(0, fit);
  truncated(ctx, stages.length, model.stages.length);
  if (stages.length === 0) return sceneOf(ctx, { marks: [] });
  const labelW =
    Math.min(
      120,
      Math.max(
        54,
        ...stages.map((s) =>
          Math.max(
            approxTextWidth(s.label, fontSize),
            approxTextWidth(input.formatValue(s.value), fontSize),
          ),
        ),
      ),
    ) + 8;
  const rateTitle =
    props.rateLabel || (model.base === "first" ? "vs. first" : "vs. previous");
  const rateW = showRates
    ? Math.max(44, approxTextWidth(rateTitle, fontSize) * 0.6)
    : 0;
  const top = showRates ? fontSize * 1.7 : 4;
  const plotX = outer.x + labelW + 6;
  const plotW = Math.max(40, outer.w - labelW - 6 - rateW - 10);
  const cxm = plotX + plotW / 2;
  const band = (outer.h - top - 4) / stages.length;
  const barH = Math.max(8, Math.min(34, band * 0.52));
  const first = Math.max(0, ...stages.map((s) => s.value)) || 1;
  const widths = stages.map((s) => Math.max(10, (s.value / first) * plotW));
  const yMid = (i: number) => outer.y + top + band * i + band / 2;
  const marks: Mark[] = [];
  const labels: TextMark[] = [];
  const targets: ChartTarget[] = [];
  if (showRates)
    labels.push({
      kind: "text",
      x: r2(outer.x + outer.w - 2),
      y: r2(outer.y + fontSize * 0.7),
      text: rateTitle,
      anchor: "end",
      baseline: "middle",
      role: "tick",
    });
  stages.forEach((s, i) => {
    const w = widths[i];
    const y = yMid(i);
    const hi = i === model.hi;
    if (i + 1 < stages.length) {
      const nw = widths[i + 1];
      const yb = y + barH / 2;
      const yt = y + band - barH / 2;
      const ym = (yb + yt) / 2;
      marks.push({
        kind: "path",
        d:
          `M${r2(cxm - w / 2)},${r2(yb - 1)}C${r2(cxm - w / 2)},${r2(ym)} ${r2(cxm - nw / 2)},${r2(ym)} ${r2(cxm - nw / 2)},${r2(yt + 1)}` +
          `L${r2(cxm + nw / 2)},${r2(yt + 1)}C${r2(cxm + nw / 2)},${r2(ym)} ${r2(cxm + w / 2)},${r2(ym)} ${r2(cxm + w / 2)},${r2(yb - 1)}Z`,
        bbox: {
          x: r2(cxm - Math.max(w, nw) / 2),
          y: r2(yb - 1),
          w: r2(Math.max(w, nw)),
          h: r2(yt - yb + 2),
        },
        fillPaint: "neutral",
        fillOpacity: 0.55,
      });
    }
    marks.push({
      kind: "path",
      d: roundRectPath(
        cxm - w / 2,
        y - barH / 2,
        w,
        barH,
        Math.min(7, barH / 3),
      ),
      bbox: { x: r2(cxm - w / 2), y: r2(y - barH / 2), w: r2(w), h: r2(barH) },
      fillPaint: hi ? "accent" : "neutral",
    });
    // 단계 줄이 글자 두 줄보다 낮으면 이름만 (값은 툴팁) — 두 줄이 이웃 단계와 포개진다.
    const twoLines = band >= fontSize * 2.6;
    labels.push({
      kind: "text",
      x: r2(outer.x + labelW),
      y: r2(twoLines ? y - fontSize * 0.55 : y),
      text: fitText(s.label, labelW - 4, fontSize),
      anchor: "end",
      baseline: "middle",
      role: "legend",
    });
    if (twoLines)
      labels.push({
        kind: "text",
        x: r2(outer.x + labelW),
        y: r2(y + fontSize * 0.75),
        text: input.formatValue(s.value),
        anchor: "end",
        baseline: "middle",
        role: "tick",
      });
    if (showRates && s.rate !== null)
      labels.push({
        kind: "text",
        x: r2(outer.x + outer.w - 2),
        y: r2(outer.y + top + band * i),
        text: pct(s.rate),
        anchor: "end",
        baseline: "middle",
        role: "value",
      });
    const entries: ChartTarget["entries"][number][] = [
      {
        label: "Count",
        text: input.formatValue(s.value),
        paint: hi ? "accent" : "neutral",
      },
    ];
    if (s.rate !== null)
      entries.push({
        label: model.base === "first" ? "vs. first step" : "vs. previous step",
        text: pct(s.rate),
      });
    if (i > 0)
      entries.push({
        label: "Drop-off",
        text: input.formatValue(stages[i - 1].value - s.value),
      });
    targets.push({
      id: `row-${s.row}`,
      x: r2(cxm),
      y: r2(y - barH / 2),
      rect: { x: outer.x, y: r2(y - band / 2), w: outer.w, h: r2(band) },
      rows: [s.row],
      title: s.label,
      entries,
    });
  });
  return sceneOf(ctx, { marks: [...marks, ...labels], targets });
}

// ── pareto ─────────────────────────────────────────────────────────────────

export interface ParetoBar extends LabeledValue {
  share: number;
  cum: number;
  hi: boolean;
}

export function paretoModel(
  ctx: CategoryContext,
): { bars: ParetoBar[]; threshold: number } | null {
  const values = labelValues(ctx, true);
  if (values === null) return null;
  const threshold = Number.isFinite(ctx.props.threshold)
    ? Math.max(0, Math.min(100, ctx.props.threshold!))
    : 80;
  const ordered = sortByValue(values, sortOf(ctx.props, "descending"));
  const total = ordered.reduce((s, r) => s + r.value, 0) || 1;
  let acc = 0;
  const bars: ParetoBar[] = ordered.map((r) => {
    acc += r.value;
    return {
      ...r,
      share: (r.value / total) * 100,
      cum: (acc / total) * 100,
      hi: false,
    };
  });
  // 누적이 기준선에 닿기 전까지 (최소 1 개).
  for (let k = 0; k < bars.length; k++) {
    bars[k].hi = true;
    if (bars[k].cum >= threshold - 0.5) break;
    const next = bars[k + 1];
    if (next && next.cum > threshold + 0.5) break;
  }
  // ADR-306 Phase 6 — `highlight` 를 주면 그 막대들 (ztd pareto 와 같다 — 값으로 max).
  const picked = highlightSet(
    ctx.props.highlight,
    bars.map((b) => b.label),
    bars.map((b) => b.value),
  );
  if (picked) bars.forEach((b, k) => (b.hi = picked.has(k)));
  return { bars, threshold };
}

export function paretoScene(ctx: CategoryContext) {
  const model = paretoModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.bars.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const ticks = [0, 50, 100];
  const left = outer.x + tickColumnWidth(ticks, String, fontSize);
  const right = outer.x + outer.w - 30;
  const fit = Math.max(
    1,
    Math.floor((right - left) / Math.max(8, ctx.metrics.minSlot)),
  );
  const bars = model.bars.slice(0, fit);
  truncated(ctx, bars.length, model.bars.length);
  const top = outer.y + fontSize;
  const bottom = outer.y + outer.h - (fontSize + 10);
  const y = linearScale([0, 100], [bottom, top]);
  const band = bandLayout(bars.length, left + 4, right, 0.28, 0.1);
  const bw = band.bandwidth;
  const radius = Math.min(4, bw / 4);
  const marks: Mark[] = [];
  const overlay: Mark[] = [];
  const targets: ChartTarget[] = [];
  const centers = bars.map((_, k) => r2(band.at(k) + bw / 2));
  const thY = r2(y(model.threshold));
  overlay.push(
    {
      kind: "line",
      x1: r2(left),
      y1: thY,
      x2: r2(right),
      y2: thY,
      role: "reference",
      dash: [3, 3],
    },
    {
      kind: "text",
      x: r2(right + 4),
      y: thY,
      text: `${model.threshold}%`,
      anchor: "start",
      baseline: "middle",
      role: "reference",
    },
  );
  bars.forEach((b, k) => {
    const yy = y(b.share);
    marks.push({
      kind: "path",
      d: roundRectPath(band.at(k), yy, bw, Math.max(0, bottom - yy), {
        tl: radius,
        tr: radius,
      }),
      bbox: {
        x: r2(band.at(k)),
        y: r2(yy),
        w: r2(bw),
        h: r2(Math.max(0, bottom - yy)),
      },
      fillPaint: b.hi ? "accent" : "neutral",
    });
    targets.push({
      id: `row-${b.row}`,
      x: centers[k],
      y: r2(Math.min(yy, y(b.cum))),
      rect: {
        x: r2(band.at(k) - (band.step - bw) / 2),
        y: r2(top),
        w: r2(band.step),
        h: r2(bottom - top),
      },
      rows: [b.row],
      title: `${props.rankLabels ? `#${k + 1} · ` : ""}${b.label}`,
      entries: [
        {
          label: "Value",
          text: input.formatValue(b.value),
          paint: b.hi ? "accent" : "neutral",
        },
        { label: "Share", text: pct(b.share) },
        { label: "Cumulative", text: pct(b.cum) },
      ],
    });
  });
  // 누적선 + 점 — 축 토큰 (진한 회색). 마지막 강조 막대의 누적에 글자.
  if (bars.length > 1)
    overlay.push({
      kind: "path",
      d: bars
        .map((b, k) => `${k === 0 ? "M" : "L"}${centers[k]},${r2(y(b.cum))}`)
        .join(""),
      bbox: {
        x: centers[0],
        y: r2(top),
        w: r2(centers[centers.length - 1] - centers[0]),
        h: r2(bottom - top),
      },
      role: "axis",
      strokeWidth: 1.6,
    });
  let lastHi = -1;
  bars.forEach((b, k) => {
    if (b.hi) lastHi = k;
  });
  bars.forEach((b, k) => {
    const cy = r2(y(b.cum));
    const rr = k === lastHi ? 3.6 : 2.4;
    overlay.push({
      kind: "path",
      d: circlePath(centers[k], cy, rr / 2),
      bbox: { x: r2(centers[k] - rr), y: r2(cy - rr), w: rr * 2, h: rr * 2 },
      role: "axis",
      strokeWidth: rr,
    });
  });
  if (lastHi >= 0 && props.showValueLabels)
    overlay.push({
      kind: "text",
      x: r2(centers[lastHi] + 8),
      y: r2(y(bars[lastHi].cum) + fontSize),
      text: pct(bars[lastHi].cum),
      anchor: "start",
      baseline: "middle",
      role: "value",
    });
  const axes: AxisScene[] = [
    valueAxisY(ctx, [0, 100], ticks, y, left, right, String),
    categoryLabels(
      ctx,
      bars.map((b, k) => (props.rankLabels ? `#${k + 1}` : b.label)),
      centers,
      bottom + fontSize * 0.5 + 6,
    ),
  ];
  return sceneOf(ctx, { marks: [...marks, ...overlay], axes, targets });
}

// ── waterfall ──────────────────────────────────────────────────────────────

export interface WaterfallStep {
  /** 원본 행 (끝 합계 막대는 -1) */
  row: number;
  label: string;
  value: number;
  start: number;
  end: number;
  total: boolean;
}

export function waterfallModel(
  ctx: CategoryContext,
): { steps: WaterfallStep[]; domain: [number, number] } | null {
  const { props, rows, input } = ctx;
  const dimension = requireField(input, "Category", props.dimension);
  const metric = requireField(input, "Value", props.metric);
  const kind = fieldKey(props.kindField);
  if (!input.ok || dimension === null || metric === null) return null;
  const steps: WaterfallStep[] = [];
  let run = 0;
  rows.forEach((row, i) => {
    const raw = readNumber(row, metric);
    const t = kind === null ? "" : readLabel(row, kind).toLowerCase();
    const isTotal =
      t === "total" ||
      t === "합계" ||
      (i === 0 && props.startTotal !== false && t !== "delta");
    if (isTotal) {
      const v = Number.isFinite(raw) ? raw : run;
      steps.push({
        row: i,
        label: readLabel(row, dimension),
        value: v,
        start: 0,
        end: v,
        total: true,
      });
      run = v;
    } else {
      const v = Number.isFinite(raw) ? raw : 0;
      steps.push({
        row: i,
        label: readLabel(row, dimension),
        value: v,
        start: run,
        end: run + v,
        total: false,
      });
      run += v;
    }
  });
  if (props.endTotal === true)
    steps.push({
      row: -1,
      label: "Total",
      value: run,
      start: 0,
      end: run,
      total: true,
    });
  const lo = Math.min(0, ...steps.map((s) => Math.min(s.start, s.end)));
  const hi = Math.max(0, ...steps.map((s) => Math.max(s.start, s.end)));
  return { steps, domain: fitDomain(lo, hi, 3) };
}

export function waterfallScene(ctx: CategoryContext) {
  const model = waterfallModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.steps.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const signed = (v: number) =>
    v > 0 ? `+${fx(v)}` : v < 0 ? `−${fx(-v)}` : fx(0);
  const ticks = ticksFor(model.domain[0], model.domain[1], 3);
  const left = outer.x + tickColumnWidth(ticks, fx, fontSize);
  const right = outer.x + outer.w - 2;
  const fit = Math.max(
    1,
    Math.floor((right - left) / Math.max(8, ctx.metrics.minSlot)),
  );
  const steps = model.steps.slice(0, fit);
  truncated(ctx, steps.length, model.steps.length);
  const top = outer.y + fontSize * 1.8;
  const bottom = outer.y + outer.h - (fontSize + 10);
  const y = linearScale(model.domain, [bottom, top]);
  const band = bandLayout(steps.length, left + 4, right, 0.34, 0.12);
  const bw = band.bandwidth;
  const radius = Math.min(4, bw / 4);
  const marks: Mark[] = [];
  const lines: LineMark[] = [];
  const labels: TextMark[] = [];
  const targets: ChartTarget[] = [];
  // ADR-306 Phase 6 — `highlight` 를 주면 그 증감 막대는 accent (ztd waterfall — 증감, 기본 max).
  const picked = highlightSet(
    props.highlight,
    steps.map((s) => s.label),
    steps.map((s) => (s.total ? -Infinity : s.value)),
  );
  steps.forEach((s, k) => {
    const bx = band.at(k);
    const ya = y(s.start);
    const yb = y(s.end);
    const top0 = Math.min(ya, yb);
    const h = Math.max(Math.abs(yb - ya), 1);
    const up = s.total || s.value >= 0;
    const paint =
      s.total || picked?.has(k)
        ? "accent"
        : s.value >= 0
          ? "positive"
          : "negative";
    marks.push({
      kind: "path",
      d: roundRectPath(
        bx,
        top0,
        bw,
        h,
        up ? { tl: radius, tr: radius } : { bl: radius, br: radius },
      ),
      bbox: { x: r2(bx), y: r2(top0), w: r2(bw), h: r2(h) },
      fillPaint: paint,
    });
    if (props.connectors !== false && k + 1 < steps.length) {
      const lvl = r2(Math.round(y(s.end)) + 0.5);
      lines.push({
        kind: "line",
        x1: r2(bx + bw),
        y1: lvl,
        x2: r2(band.at(k + 1)),
        y2: lvl,
        role: "grid",
        dash: [2, 3],
      });
    }
    // 막대가 글자보다 좁으면 값 라벨이 이웃과 포개진다 — 내지 않는다 (툴팁에 남는다).
    if (props.showValueLabels && band.step >= fontSize * 3)
      labels.push({
        kind: "text",
        x: r2(bx + bw / 2),
        y: r2(up ? top0 - fontSize * 0.8 : top0 + h + fontSize * 0.9),
        text: s.total ? fx(s.value) : signed(s.value),
        anchor: "middle",
        baseline: "middle",
        role: s.total ? "value" : "tick",
      });
    targets.push({
      id: `step-${k}`,
      x: r2(bx + bw / 2),
      y: r2(top0),
      rect: {
        x: r2(bx - (band.step - bw) / 2),
        y: r2(top),
        w: r2(band.step),
        h: r2(bottom - top),
      },
      rows: s.row >= 0 ? [s.row] : [],
      title: s.label,
      entries: s.total
        ? [{ label: "Total", text: fx(s.value), paint }]
        : [
            {
              label: s.value >= 0 ? "Increase" : "Decrease",
              text: signed(s.value),
              paint,
            },
            { label: "Cumulative", text: fx(s.end) },
          ],
    });
  });
  const axes: AxisScene[] = [
    valueAxisY(ctx, model.domain, ticks, y, left, right),
    categoryLabels(
      ctx,
      steps.map((s) => s.label),
      steps.map((_, k) => band.at(k) + bw / 2),
      bottom + fontSize * 0.5 + 6,
    ),
  ];
  return sceneOf(ctx, {
    marks: [...lines, ...marks, ...labels],
    axes,
    targets,
  });
}
