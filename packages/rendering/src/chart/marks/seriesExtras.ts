/**
 * ADR-306 Phase 5 — 기존 종류 보강 (breakdown §2.1) 의 마크. **두 consumer 가 같이 부른다** (Canvas
 * `computeChartScene` · DOM `RechartsChart`) — 같은 격자 · 스케일이면 같은 좌표다. 뜻은 ztd-charts 0.5.0
 * (`3c4376c`, MIT — `src/charts/line.tsx` 범위 띠 · `endLabels`, `bubble.tsx` · `scatter-kit.tsx` 의 크기 ·
 * 이름 · `linearFit` · `quadrantTags`) 을 따른다.
 *
 * - line · area: 범위 띠 (`lowerFields` · `upperFields` — 누적이면 그리지 않는다, ztd 와 같음) · 끝 이름표.
 * - scatter: 점 크기 (`sizeField` — 면적 비례, 반지름 `sizeRange`) · 점 이름 (`labelField`) · 추세선
 *   (`fit: linear` — 최소제곱, 점의 x 범위 안 · y 축 밖은 자른다) · 사분면 이름 (`quadrants`).
 */
import { curveCommands, toScreen } from "../curves";
import type { AxialPoint } from "../curves";
import { approxTextWidth, r2 } from "../scales";
import type { BandScale, LinearScale } from "../scales";
import { seriesLabel } from "../series";
import type { SeriesGrid, StackMode } from "../series";
import type {
  ChartProps,
  LineMark,
  Mark,
  PathMark,
  Rect,
  TextMark,
} from "../types";
import { circlePath } from "./dots";
import { fittedSizeRange } from "./sizeRange";
export { SIZE_RANGE_DEFAULT } from "./sizeRange";
import { bandCenter, seriesAxialPoints, splitRuns } from "./line";

export interface SeriesExtraInput {
  props: Pick<
    ChartProps,
    | "chartType"
    | "orientation"
    | "curve"
    | "endLabels"
    | "sizeField"
    | "sizeRange"
    | "labelField"
    | "fit"
    | "quadrants"
  >;
  grid: SeriesGrid;
  band: BandScale;
  value: LinearScale;
  plot: Rect;
  stackMode: StackMode;
  fontSize: number;
  /** 산점도 점 기본 반지름 (`dotRadius`). */
  dotRadius: number;
  /** 사분면 가로 기준 — 값 축 기준선의 첫 값 (없으면 y 평균). */
  referenceY?: number;
}

export interface SeriesExtraMarks {
  /** 데이터 마크 뒤 (격자 위) — 범위 띠 · 사분면 선 · 이름. */
  back: Mark[];
  /** 산점도 크기 점 — 있으면 기본 점 대신 (시리즈당 path 하나, 반지름이 점마다 다르다). */
  dots: PathMark[] | null;
  /** 데이터 마크 앞 — 끝 이름표 · 점 이름 · 추세선. */
  front: Mark[];
}

const EMPTY: SeriesExtraMarks = { back: [], dots: null, front: [] };

/** 세로로 겹치는 이름표를 벌린다 (순서 유지, `[lo, hi]` 안). */
function dodge(ys: number[], gap: number, lo: number, hi: number): number[] {
  const idx = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const pos = idx.map((d) => Math.max(lo, Math.min(hi, d.y)));
  for (let k = 1; k < pos.length; k++)
    if (pos[k] - pos[k - 1] < gap) pos[k] = pos[k - 1] + gap;
  const over = pos.length ? pos[pos.length - 1] - hi : 0;
  if (over > 0) for (let k = 0; k < pos.length; k++) pos[k] -= over;
  const out = new Array<number>(ys.length);
  idx.forEach((d, k) => (out[d.i] = r2(pos[k])));
  return out;
}

export function buildSeriesExtraMarks(
  input: SeriesExtraInput,
): SeriesExtraMarks {
  const t = input.props.chartType;
  if (t === "line" || t === "area") return lineExtras(input);
  if (t === "scatter") return scatterExtras(input);
  return EMPTY;
}

function lineExtras(input: SeriesExtraInput): SeriesExtraMarks {
  const { props, grid, band, value, plot, stackMode, fontSize } = input;
  const orientation = props.orientation;
  const back: Mark[] = [];
  // 범위 띠 — 위 경계를 앞으로, 아래 경계를 거꾸로 이어 닫는다 (area 와 같은 곡선).
  if (stackMode === "none")
    grid.series.forEach((series) => {
      const lower = series.extras?.lower;
      const upper = series.extras?.upper;
      if (!lower || !upper) return;
      const pts: { categoryIndex: number; lo: AxialPoint; hi: AxialPoint }[] =
        [];
      for (let ci = 0; ci < grid.categories.length; ci++) {
        const a = lower.get(ci);
        const b = upper.get(ci);
        if (a === undefined || b === undefined) continue;
        const along = bandCenter(band, ci);
        pts.push({
          categoryIndex: ci,
          lo: { along, across: value(Math.min(a, b)) },
          hi: { along, across: value(Math.max(a, b)) },
        });
      }
      const runs = splitRuns(pts).filter((run) => run.length > 1);
      if (runs.length === 0) return;
      const d = runs
        .map(
          (run) =>
            `${curveCommands(
              run.map((p) => p.hi),
              props.curve,
              orientation,
              true,
            )}${curveCommands(
              run.map((p) => p.lo).reverse(),
              props.curve,
              orientation,
              false,
            )} Z`,
        )
        .join(" ");
      back.push({
        kind: "path",
        d,
        bbox: { ...plot },
        fillSeries: series.seriesIndex,
        fillOpacity: 0.18,
      });
    });
  const front: Mark[] = [];
  if (props.endLabels === true && orientation !== "horizontal") {
    const ends: { si: number; x: number; y: number }[] = [];
    grid.series.forEach((_, si) => {
      const points = seriesAxialPoints(grid, si, band, value);
      const last = points[points.length - 1];
      if (!last) return;
      const p = toScreen(orientation, last);
      ends.push({ si, x: p.x, y: p.y });
    });
    const ys = dodge(
      ends.map((e) => e.y),
      fontSize * 1.2,
      plot.y + fontSize / 2,
      plot.y + plot.h - fontSize / 2,
    );
    const x = plot.x + plot.w + 6;
    ends.forEach((e, k) =>
      front.push({
        kind: "text",
        x: r2(x),
        y: ys[k],
        text: seriesLabel(grid.series[e.si], "series"),
        anchor: "start",
        baseline: "middle",
        role: "legend",
      }),
    );
  }
  return { back, dots: null, front };
}

/** 최소제곱 직선 (ztd `linearFit`) — 점이 둘 미만이거나 x 가 모두 같으면 null. */
export function linearFit(
  pts: readonly { x: number; y: number }[],
): { slope: number; at: (x: number) => number } | null {
  const n = pts.length;
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (const q of pts) {
    mx += q.x;
    my += q.y;
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  for (const q of pts) {
    sxy += (q.x - mx) * (q.y - my);
    sxx += (q.x - mx) ** 2;
  }
  if (!(sxx > 0)) return null;
  const slope = sxy / sxx;
  return { slope, at: (x) => my + slope * (x - mx) };
}

function scatterExtras(input: SeriesExtraInput): SeriesExtraMarks {
  const { props, grid, band, value, plot, fontSize } = input;
  const orientation = props.orientation;
  // 화면 점 + 데이터 값 (x = 범주 위치의 데이터 값 — 화면에서 역산하지 않고 band 의 x 를 그대로 쓴다).
  const all = grid.series.map((_, si) =>
    seriesAxialPoints(grid, si, band, value).map((point) => ({
      ci: point.categoryIndex,
      raw: point.raw,
      ...toScreen(orientation, point),
    })),
  );
  // 점 크기 — 면적이 값에 비례 (반지름 ∝ √값), 가장 큰 값이 큰 반지름. 0 이하 · 결측은 작은 반지름.
  let dots: PathMark[] | null = null;
  const sized = grid.series.some((s) => s.extras?.size);
  const [rMin, rMax] = fittedSizeRange(props.sizeRange, plot.w, plot.h);
  if (props.sizeField && sized) {
    let vmax = 0;
    for (const s of grid.series)
      for (const v of s.extras?.size?.values() ?? []) vmax = Math.max(vmax, v);
    dots = [];
    grid.series.forEach((series, si) => {
      const pts = all[si];
      if (pts.length === 0) return;
      const radius = (ci: number) => {
        const v = series.extras?.size?.get(ci);
        if (v === undefined || !(v > 0) || !(vmax > 0)) return rMin;
        return Math.max(rMin, r2(Math.sqrt(v / vmax) * rMax));
      };
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      // 큰 점을 먼저 (작은 점이 위에 — 겹쳐도 작은 점이 보인다; 한 path 라 nonzero 로 합쳐진다).
      const ordered = [...pts].sort((a, b) => radius(b.ci) - radius(a.ci));
      const d = ordered
        .map((p) => {
          const r = radius(p.ci);
          x0 = Math.min(x0, p.x - r);
          y0 = Math.min(y0, p.y - r);
          x1 = Math.max(x1, p.x + r);
          y1 = Math.max(y1, p.y + r);
          return circlePath(p.x, p.y, r);
        })
        .join(" ");
      dots!.push({
        kind: "path",
        d,
        bbox: { x: r2(x0), y: r2(y0), w: r2(x1 - x0), h: r2(y1 - y0) },
        fillSeries: series.seriesIndex,
        fillOpacity: 0.75,
      });
    });
  }
  const back: Mark[] = [];
  const front: Mark[] = [];
  // 사분면 — 기준 x 는 점 x 평균 (화면 좌표의 평균 = 데이터 평균 — 스케일이 선형), 기준 y 는 기준선의 첫
  //   값이 있으면 그 값, 없으면 y 평균. 선 둘 + 각 칸 모서리 이름 (왼쪽 위 · 오른쪽 위 · 왼쪽 아래 ·
  //   오른쪽 아래 — ztd 순서).
  const names = Array.isArray(props.quadrants)
    ? props.quadrants.map((q) => String(q).trim())
    : [];
  const flat = all.flat();
  if (names.some(Boolean) && flat.length > 0 && orientation !== "horizontal") {
    const xr = flat.reduce((s, p) => s + p.x, 0) / flat.length;
    const yr =
      input.referenceY !== undefined
        ? value(input.referenceY)
        : flat.reduce((s, p) => s + p.y, 0) / flat.length;
    const lines: LineMark[] = [
      {
        kind: "line",
        x1: r2(xr),
        y1: plot.y,
        x2: r2(xr),
        y2: r2(plot.y + plot.h),
        role: "reference",
        dash: [4, 4],
      },
      {
        kind: "line",
        x1: plot.x,
        y1: r2(yr),
        x2: r2(plot.x + plot.w),
        y2: r2(yr),
        role: "reference",
        dash: [4, 4],
      },
    ];
    back.push(...lines);
    const cells = [
      {
        x: plot.x + 4,
        y: plot.y + fontSize,
        w: xr - plot.x,
        h: yr - plot.y,
        anchor: "start" as const,
      },
      {
        x: plot.x + plot.w - 4,
        y: plot.y + fontSize,
        w: plot.x + plot.w - xr,
        h: yr - plot.y,
        anchor: "end" as const,
      },
      {
        x: plot.x + 4,
        y: yr + fontSize,
        w: xr - plot.x,
        h: plot.y + plot.h - yr,
        anchor: "start" as const,
      },
      {
        x: plot.x + plot.w - 4,
        y: yr + fontSize,
        w: plot.x + plot.w - xr,
        h: plot.y + plot.h - yr,
        anchor: "end" as const,
      },
    ];
    cells.forEach((q, k) => {
      const name = names[k];
      if (!name || q.h < fontSize * 2 || q.w < fontSize * 4) return;
      const room = q.w - 12;
      const per = fontSize * 0.55;
      const text =
        approxTextWidth(name, fontSize) <= room
          ? name
          : `${name.slice(0, Math.max(0, Math.floor(room / per) - 1))}…`;
      if (text === "…") return;
      back.push({
        kind: "text",
        x: r2(q.x),
        y: r2(q.y),
        text,
        anchor: q.anchor,
        baseline: "middle",
        role: "tick",
      });
    });
  }
  // 추세선 — 보이는 점 전체 (시리즈를 가리지 않는다) 의 최소제곱. 화면 좌표에서 맞춘다 (x · y 스케일이
  //   선형이라 데이터에서 맞춘 직선과 같은 선이다). 점의 x 범위 안, 그림 위아래 밖은 자른다.
  if (props.fit === "linear" && orientation !== "horizontal") {
    const fit = linearFit(flat);
    if (fit) {
      let a = Math.min(...flat.map((p) => p.x));
      let b = Math.max(...flat.map((p) => p.x));
      const top = plot.y;
      const bottom = plot.y + plot.h;
      if (fit.slope !== 0) {
        const xa = a + (top - fit.at(a)) / fit.slope;
        const xb = a + (bottom - fit.at(a)) / fit.slope;
        a = Math.max(a, Math.min(xa, xb));
        b = Math.min(b, Math.max(xa, xb));
      }
      if (b > a)
        front.push({
          kind: "line",
          x1: r2(a),
          y1: r2(fit.at(a)),
          x2: r2(b),
          y2: r2(fit.at(b)),
          role: "reference",
          width: 1.5,
        });
    }
  }
  // 점 이름 — 크기가 있으면 큰 점부터, 겹치면 앞 이름만 (가로 · 세로 상자 겹침), 최대 40 개.
  if (props.labelField) {
    const items = grid.series.flatMap((series, si) =>
      all[si].flatMap((p) => {
        const text = series.extras?.label?.get(p.ci);
        if (!text) return [];
        const size = series.extras?.size?.get(p.ci) ?? 0;
        return [{ p, text, size }];
      }),
    );
    items.sort((a, b) => b.size - a.size);
    const placed: Rect[] = [];
    for (const item of items) {
      if (placed.length >= 40) break;
      const w = approxTextWidth(item.text, fontSize);
      const gap = input.dotRadius + 3;
      // 오른쪽 먼저, 그림 밖이면 왼쪽 (ztd 와 같은 차례 — 오른쪽 · 왼쪽).
      const right = item.p.x + gap;
      const left = item.p.x - gap - w;
      const x =
        right + w <= plot.x + plot.w ? right : left >= plot.x ? left : null;
      if (x === null) continue;
      const box = { x, y: item.p.y - fontSize * 0.6, w, h: fontSize * 1.2 };
      if (
        placed.some(
          (q) =>
            box.x < q.x + q.w &&
            q.x < box.x + box.w &&
            box.y < q.y + q.h &&
            q.y < box.y + box.h,
        )
      )
        continue;
      placed.push(box);
      front.push({
        kind: "text",
        x: r2(box.x),
        y: r2(item.p.y),
        text: item.text,
        anchor: "start",
        baseline: "middle",
        role: "value",
      } satisfies TextMark);
    }
  }
  return { back, dots, front };
}
