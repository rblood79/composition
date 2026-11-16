/**
 * ADR-306 Phase 4 — candlestick (breakdown §2.2 #31). 뜻은 ztd-charts 0.5.0 (`3c4376c`, MIT —
 * `src/charts/candlestick.tsx` · `toCandles` · `mergeCandles` · `movingAverage` · `maPeriods`) 을 따른다:
 * 날짜면 시점 순, 종가 없는 행은 빼고 시가 · 고가 · 저가가 비면 이웃 값, 봉이 그림 폭 / 4 를 넘으면
 * 이웃 봉을 합친다 (시가 = 첫 봉 · 종가 = 끝 봉 · 고저 = 끝값 · 거래량 = 합), 상승 accent · 하락 neutral,
 * 이동평균은 합치기 전 종가로.
 *
 * 편차: ztd 의 brush (구간 선택) · 주석 · 마지막 값 표는 Phase 6 (공통 상호작용) 몫이다. 가격 축 범위
 * 고정은 `valueMin` · `valueMax` (ztd `yDomain`).
 */
import {
  annotationValues,
  buildAnnotationMarks,
  resolveAnnotations,
} from "../../marks/annotations";
import { highlightIndex } from "../../highlight";
import { approxTextWidth, linearScale, r2 } from "../../scales";
import type {
  AxisScene,
  ChartTarget,
  LineMark,
  Mark,
  PathMark,
  TextMark,
} from "../../types";
import {
  categoryLabels,
  invalidScene,
  noDataScene,
  sceneOf,
  type CategoryContext,
} from "../category/common";
import {
  fieldKey,
  numberList,
  readLabel,
  readNumber,
  requireField,
} from "../fields";
import { fitDomain, ticksFor } from "../niceScale";
import { roundRectPath } from "../shapes";
import { chartTimeParser } from "../../series";

export interface Candle {
  /** 정렬 뒤 첫 봉 인덱스 */
  i: number;
  /** 합친 봉 수 */
  span: number;
  label: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  rows: number[];
}

/** 이웃 봉을 묶어 max 개 이하로. */
export function mergeCandles(cs: readonly Candle[], max: number): Candle[] {
  if (cs.length <= max || max < 2) return [...cs];
  const size = Math.ceil(cs.length / max);
  const out: Candle[] = [];
  for (let a = 0; a < cs.length; a += size) {
    const g = cs.slice(a, a + size);
    const first = g[0];
    const last = g[g.length - 1];
    let h = -Infinity;
    let l = Infinity;
    let v = 0;
    let hasV = false;
    for (const q of g) {
      h = Math.max(h, q.h);
      l = Math.min(l, q.l);
      if (Number.isFinite(q.v)) {
        v += q.v;
        hasV = true;
      }
    }
    out.push({
      i: first.i,
      span: g.reduce((s, q) => s + q.span, 0),
      label: g.length > 1 ? `${first.label} ~ ${last.label}` : first.label,
      o: first.o,
      h,
      l,
      c: last.c,
      v: hasV ? v : NaN,
      rows: g.flatMap((q) => q.rows),
    });
  }
  return out;
}

/** 단순 이동평균 — 앞쪽 period − 1 개는 NaN. */
export function movingAverage(
  values: readonly number[],
  period: number,
): number[] {
  const out = new Array<number>(values.length).fill(NaN);
  if (period < 1) return out;
  let sum = 0;
  for (let k = 0; k < values.length; k++) {
    sum += values[k];
    if (k >= period) sum -= values[k - period];
    if (k >= period - 1) out[k] = sum / period;
  }
  return out;
}

/** 그릴 이동평균 기간 — 2 이상 · 봉 수 미만 · 앞의 3 개. */
export function maPeriods(ma: readonly number[], count: number): number[] {
  return ma
    .map((d) => Math.round(d))
    .filter((d) => d >= 2 && d < count)
    .slice(0, 3);
}

export interface CandlestickModel {
  candles: Candle[];
  hasVolume: boolean;
}

export function candlestickModel(
  ctx: CategoryContext,
): CandlestickModel | null {
  const { props, rows, input } = ctx;
  const dimension = requireField(input, "Date", props.dimension);
  // ADR-312 Decision 3 — 주 값 (종가) 은 `metric`.
  const close = requireField(input, "Close", props.metric);
  if (!input.ok || dimension === null || close === null) return null;
  const open = fieldKey(props.openField);
  const high = fieldKey(props.highField);
  const low = fieldKey(props.lowField);
  const volume = fieldKey(props.volumeField);
  // 시점 → epoch ms (정렬 키). ztd `toCandles` 처럼 시각 전체로 — 날짜만 자르면 같은 날의 시간봉 순서가 데이터
  //   순서로 남는다. ADR-312 Decision 9 — 해석은 시간 축 · calendar 와 같은 `chartTimeParser`.
  const parse = chartTimeParser(props);
  const raw = rows.map((row, i) => {
    const t = parse(row[dimension]);
    return {
      i,
      label: readLabel(row, dimension),
      t,
      c: readNumber(row, close),
      o: readNumber(row, open),
      h: readNumber(row, high),
      l: readNumber(row, low),
      v: readNumber(row, volume),
    };
  });
  const dated = raw.length > 0 && raw.every((r) => r.t !== null);
  const kept = raw.filter((r) => Number.isFinite(r.c));
  if (dated) kept.sort((a, b) => a.t! - b.t!);
  const candles: Candle[] = [];
  let prev = NaN;
  kept.forEach((r, k) => {
    const o = Number.isFinite(r.o) ? r.o : Number.isFinite(prev) ? prev : r.c;
    const h = Math.max(o, r.c, Number.isFinite(r.h) ? r.h : -Infinity);
    const l = Math.min(o, r.c, Number.isFinite(r.l) ? r.l : Infinity);
    candles.push({
      i: k,
      span: 1,
      label: r.label,
      o,
      h,
      l,
      c: r.c,
      v: r.v,
      rows: [r.i],
    });
    prev = r.c;
  });
  return {
    candles,
    hasVolume: volume !== null && candles.some((q) => Number.isFinite(q.v)),
  };
}

export function candlestickScene(ctx: CategoryContext) {
  const model = candlestickModel(ctx);
  if (model === null) return invalidScene(ctx);
  const { outer, fontSize } = ctx.frame;
  if (model.candles.length === 0 || outer.w <= 0 || outer.h <= 0)
    return noDataScene(ctx);
  const { props, input } = ctx;
  const fx = input.formatValue;
  const all = model.candles;
  const plotW0 = Math.max(40, outer.w - 56);
  const cs = mergeCandles(all, Math.max(8, Math.round(plotW0 / 4)));
  if (cs.length < all.length)
    input.warning(
      "budget.rowsTruncated",
      `${all.length} candles merged into ${cs.length}`,
      String(all.length),
    );
  const n = cs.length;
  let lo = Infinity;
  let hi = -Infinity;
  let vmax = 0;
  for (const q of cs) {
    lo = Math.min(lo, q.l);
    hi = Math.max(hi, q.h);
    if (Number.isFinite(q.v)) vmax = Math.max(vmax, q.v);
  }
  // ADR-306 Phase 6 — 주석 (값 구간은 가격 축 범위에 넣는다 — 시리즈 종류와 같은 규칙).
  const notes = resolveAnnotations(props.annotations);
  for (const v of annotationValues(notes)) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  const top = outer.y + 10;
  const bottomRoom = fontSize + 10;
  const base = outer.y + outer.h - bottomRoom;
  // 작은 상자 (Library 표본 칸 · 좁은 카드) 는 가격 봉만 — 거래량 띠 · 이동평균 이름이 그림을 덮는다.
  const roomy = outer.h >= fontSize * 14;
  const showVolume = model.hasVolume && roomy;
  const volH = showVolume ? Math.max(28, (base - top) * 0.18) : 0;
  const priceBottom = base - (showVolume ? volH + 8 : 0);
  if (priceBottom - top < 8) return sceneOf(ctx, { marks: [] });
  const yCount = Math.max(2, Math.round((priceBottom - top) / 60));
  // 가격 축 범위 고정 (ztd `yDomain`) — 한쪽만 주면 그쪽만 고정하고 나머지는 자동.
  const auto = fitDomain(lo, hi, yCount, { zero: false });
  const fixedMin =
    typeof props.valueMin === "number" && Number.isFinite(props.valueMin)
      ? props.valueMin
      : auto[0];
  const fixedMax =
    typeof props.valueMax === "number" && Number.isFinite(props.valueMax)
      ? props.valueMax
      : auto[1];
  const dom: [number, number] =
    fixedMin < fixedMax ? [fixedMin, fixedMax] : auto;
  const yTicks = ticksFor(dom[0], dom[1], yCount);
  const right =
    Math.max(
      Math.max(...yTicks.map((t) => approxTextWidth(fx(t), fontSize)), 8) + 8,
      approxTextWidth(fx(hi), fontSize) + 14,
    ) + 4;
  const x0 = outer.x + 4;
  const x1 = outer.x + outer.w - right;
  if (x1 - x0 < 8) return sceneOf(ctx, { marks: [] });
  const step = (x1 - x0) / n;
  const bodyW = Math.max(1, Math.min(18, step * 0.64));
  const cx = (k: number) => x0 + step * (k + 0.5);
  const y = linearScale(dom, [priceBottom, top]);
  const vy = (v: number) =>
    base - (vmax > 0 && Number.isFinite(v) ? (v / vmax) * volH : 0);

  const marks: Mark[] = [];
  const texts: TextMark[] = [];
  const targets: ChartTarget[] = [];
  const grid: LineMark[] = [];
  const ticks: TextMark[] = [];
  for (const t of yTicks) {
    const ty = r2(y(t));
    if (ty < top - 0.5 || ty > priceBottom + 0.5) continue;
    if (props.showGrid !== false)
      grid.push({
        kind: "line",
        x1: r2(x0),
        y1: ty,
        x2: r2(x1),
        y2: ty,
        role: "grid",
      });
    ticks.push({
      kind: "text",
      x: r2(x1 + 6),
      y: ty,
      text: fx(t),
      anchor: "start",
      baseline: "middle",
      role: "tick",
    });
  }
  const axes: AxisScene[] = [{ axis: "y", line: null, grid, ticks }];
  if (showVolume)
    marks.push({
      kind: "line",
      x1: r2(x0),
      y1: r2(base),
      x2: r2(x1),
      y2: r2(base),
      role: "grid",
    });

  cs.forEach((q, k) => {
    const rising = q.c >= q.o;
    const paint = rising ? "accent" : "neutral";
    const xx = cx(k);
    if (showVolume && Number.isFinite(q.v)) {
      const vTop = vy(q.v);
      marks.push({
        kind: "rect",
        x: r2(xx - bodyW / 2),
        y: r2(vTop),
        w: r2(bodyW),
        h: r2(Math.max(0, base - vTop)),
        seriesIndex: 0,
        fillPaint: paint,
        fillOpacity: 0.32,
      });
    }
    marks.push({
      kind: "line",
      x1: r2(xx),
      y1: r2(y(q.h)),
      x2: r2(xx),
      y2: r2(y(q.l)),
      role: "axis",
      paint,
      width: 1,
    });
    const bodyTop = Math.min(y(q.o), y(q.c));
    const bodyH = Math.max(1, Math.abs(y(q.c) - y(q.o)));
    marks.push({
      kind: "path",
      d: roundRectPath(
        xx - bodyW / 2,
        bodyTop,
        bodyW,
        bodyH,
        bodyW >= 6 ? 1.5 : 0,
      ),
      bbox: {
        x: r2(xx - bodyW / 2),
        y: r2(bodyTop),
        w: r2(bodyW),
        h: r2(bodyH),
      },
      fillPaint: paint,
    });
    const prevClose = k > 0 ? cs[k - 1].c : NaN;
    const change =
      Number.isFinite(prevClose) && prevClose !== 0
        ? ((q.c - prevClose) / Math.abs(prevClose)) * 100
        : null;
    targets.push({
      id: `candle-${k}`,
      key: q.label,
      value: q.c,
      x: r2(xx),
      y: r2(y(q.h)),
      rect: {
        x: r2(x0 + step * k),
        y: r2(top),
        w: r2(step),
        h: r2(base - top),
      },
      rows: q.rows,
      title: q.label,
      entries: [
        { label: "Open", text: fx(q.o) },
        { label: "High", text: fx(q.h) },
        { label: "Low", text: fx(q.l) },
        { label: "Close", text: fx(q.c), paint },
        ...(change !== null
          ? [
              {
                label: "Change",
                text: `${change >= 0 ? "+" : ""}${Math.round(change * 100) / 100}%`,
              },
            ]
          : []),
        ...(Number.isFinite(q.v) ? [{ label: "Volume", text: fx(q.v) }] : []),
      ],
    });
  });

  // 이동평균 — 합치기 전 종가로 내고 합친 봉의 끝 자리 값을 쓴다.
  const closes = all.map((q) => q.c);
  const periods = maPeriods(numberList(props.movingAverages), closes.length);
  let maX = x0 + 2;
  periods.forEach((d, mi) => {
    const full = movingAverage(closes, d);
    const vals = cs.map((q) => full[q.i + q.span - 1]);
    let path = "";
    vals.forEach((v, k) => {
      if (Number.isFinite(v))
        path += `${path ? "L" : "M"}${r2(cx(k))},${r2(y(v))}`;
    });
    if (path) {
      const mark: PathMark = {
        kind: "path",
        d: path,
        bbox: {
          x: r2(x0),
          y: r2(top),
          w: r2(x1 - x0),
          h: r2(priceBottom - top),
        },
        strokeWidth: mi === 0 ? 1.4 : 1.2,
        // ztd 색 순서 ink · muted · dim → 축 · 중립 · 격자 토큰.
        ...(mi === 0
          ? { role: "axis" as const }
          : mi === 1
            ? { strokePaint: "neutral" as const }
            : { role: "grid" as const }),
      };
      marks.push(mark);
    }
    if (!roomy) return;
    const lastV = vals[vals.length - 1];
    const text = `MA${d} ${Number.isFinite(lastV) ? fx(lastV) : "-"}`;
    texts.push({
      kind: "text",
      x: r2(maX),
      y: r2(top + 2),
      text,
      anchor: "start",
      baseline: "middle",
      role: "legend",
    });
    maX += approxTextWidth(text, fontSize) + 10;
  });

  // 날짜 글자는 상자 안에 들 때만 (가장자리 봉의 가운데 정렬 글자가 상자 밖으로 나가 잘린다).
  const dateAxis = categoryLabels(
    ctx,
    // 합친 봉의 축 글자는 첫 기간 — 「a ~ b」 범위는 툴팁 제목에 둔다.
    cs.map((q) => q.label.split(" ~ ")[0]),
    cs.map((_, k) => cx(k)),
    base + fontSize * 0.5 + 5,
  );
  dateAxis.ticks = dateAxis.ticks.filter((t) => {
    const half = approxTextWidth(t.text, fontSize) / 2;
    return t.x - half >= outer.x && t.x + half <= outer.x + outer.w;
  });
  axes.push(dateAxis);
  // 주석 — 봉 칸 (범주 이름 = 봉 이름, 칸 절반 = step / 2, 예측은 칸 왼쪽 끝부터 — ztd edge). 주말 음영은
  //   시간 축이 아니라 그리지 않는다 (봉 x 는 범주 칸).
  const annotated = buildAnnotationMarks({
    list: notes,
    axis: {
      at: (v) => {
        const k = cs.findIndex((q) => q.label === v);
        return k < 0 ? null : cx(k);
      },
      half: step / 2,
      lo: x0,
      hi: x1,
    },
    value: y,
    plot: { x: x0, y: top, w: x1 - x0, h: priceBottom - top },
    orientation: "vertical",
    fontSize,
    trendPoints: cs.map((q, k) => ({ along: cx(k), across: y(q.c) })),
    edge: true,
  });
  marks.unshift(...annotated.under);
  marks.push(...annotated.over);
  // ADR-306 Phase 6 — `highlight` (ztd candlestick 기본 last): 고른 봉의 종가 파선 · 가격 글자 (오른쪽 끝).
  const markK = highlightIndex(
    props.highlight,
    cs.map((q) => q.label),
    cs.map((q) => q.c),
    -1,
  );
  if (markK >= 0 && Number.isFinite(cs[markK].c)) {
    const yc = r2(y(cs[markK].c));
    marks.push({
      kind: "line",
      x1: r2(cx(markK)),
      y1: yc,
      x2: r2(x1),
      y2: yc,
      role: "reference",
      dash: [3, 3],
    });
    texts.push({
      kind: "text",
      x: r2(x1 + 4),
      y: yc,
      text: fx(cs[markK].c),
      anchor: "start",
      baseline: "middle",
      role: "reference",
    });
  }
  return sceneOf(ctx, { marks: [...marks, ...texts], axes, targets });
}
