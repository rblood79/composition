/**
 * ADR-306 Phase 6 — 선 · 면을 나눠 칠하기 (예측 구간 파선 · 손익 색). 뜻은 ztd-charts 0.5.0 (`3c4376c`,
 * MIT — `src/charts/line.tsx` 의 `pre` · `post` · `up` · `dn` clipPath) 를 따른다: 같은 path 를 자르기
 * 상자로 나눠 그린다 — 예측 x 뒤는 파선 (5 4), 강조 시리즈의 기준값 아래는 neutral.
 *
 * 두 consumer 가 같은 시리즈 path (`buildLineMarks` · `buildAreaMarks`) 에 같은 상자를 씌운다 — Canvas 는
 * scene 의 시리즈 마크를 이 결과로 바꾸고, DOM 은 Recharts 선 · 면을 숨기고 이 결과를 그린다.
 *
 * 편차: 누적 (stacked · expand) 에서는 나누지 않는다 (ztd 도 손익 색은 겹치기에서만 — 예측 파선만 누적에서
 * 갈린다). 손익 색 면은 지금 면 모양 (바닥 = 축 안의 0) 그대로 위아래 색만 나눈다 (ztd 는 선 → 기준값 면).
 */
import { r2 } from "../scales";
import type { LinearScale } from "../scales";
import type { SeriesGrid, StackMode } from "../series";
import type {
  ChartOrientation,
  LineMark,
  Mark,
  PathMark,
  Rect,
} from "../types";

export interface SeriesStyleInput {
  /**
   * 시리즈 path 마크와 그 시리즈의 격자 자리 (`grid.series` 인덱스). 색 index (`seriesIndex`) 로 찾지 않는다 —
   * seriesConfig 색 지정 · 강조 밖 neutral · 8 색 넘는 시리즈에서 겹친다 (판독 MEDIUM-2).
   */
  marks: readonly { mark: PathMark; si: number }[];
  grid: SeriesGrid;
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  stackMode: StackMode;
  /** 예측이 시작하는 범주 축 좌표 (`forecastAt`) — null 이면 나누지 않는다. */
  forecastAt: number | null;
  /** 손익 색을 칠할 시리즈 (`grid.series` 인덱스) — 비면 손익 색 없음. */
  signSeries: ReadonlySet<number>;
  /** 손익 색 기준값. */
  baseline: number;
}

export interface SeriesStyleMarks {
  /** 시리즈 마크 대신 그릴 것 (아래에서 위 순서). */
  marks: Mark[];
  /** 손익 색 기준선 (시리즈 아래). */
  under: LineMark[];
}

/** 자르기 상자의 여유 — 선 두께 · round cap 이 plot 밖으로 조금 나가도 자르지 않게. */
const PAD = 40;

/**
 * 나눌 것이 없으면 null (그대로 그린다 — 지금 그림과 byte 같음). 예측 · 손익 둘 다 있으면 네 칸으로 나눈다.
 */
export function styleSeriesMarks(
  input: SeriesStyleInput,
): SeriesStyleMarks | null {
  const { plot, orientation } = input;
  if (input.stackMode !== "none") return null;
  const xf = input.forecastAt;
  const sign = input.signSeries.size > 0;
  if (xf === null && !sign) return null;
  const horizontal = orientation === "horizontal";
  const left = r2(plot.x - PAD);
  const right = r2(plot.x + plot.w + PAD);
  const topY = r2(plot.y - PAD);
  const bottomY = r2(plot.y + plot.h + PAD);
  // 범주 축 방향 상자 (예측 앞 · 뒤).
  const alongBox = (a0: number, a1: number): Rect =>
    horizontal
      ? { x: left, y: r2(a0), w: r2(right - left), h: r2(a1 - a0) }
      : { x: r2(a0), y: topY, w: r2(a1 - a0), h: r2(bottomY - topY) };
  // 값 축 방향 상자 (기준값 위 · 아래 — 「위」 는 큰 값 쪽).
  const cb = input.value(input.baseline);
  const up: Rect = horizontal
    ? { x: r2(cb), y: topY, w: r2(right - cb), h: r2(bottomY - topY) }
    : { x: left, y: topY, w: r2(right - left), h: r2(cb - topY) };
  const down: Rect = horizontal
    ? { x: left, y: topY, w: r2(cb - left), h: r2(bottomY - topY) }
    : { x: left, y: r2(cb), w: r2(right - left), h: r2(bottomY - cb) };
  const aLo = horizontal ? topY : left;
  const aHi = horizontal ? bottomY : right;
  const meet = (a: Rect, b: Rect): Rect => {
    const x0 = Math.max(a.x, b.x);
    const y0 = Math.max(a.y, b.y);
    const x1 = Math.min(a.x + a.w, b.x + b.w);
    const y1 = Math.min(a.y + a.h, b.y + b.h);
    return {
      x: x0,
      y: y0,
      w: r2(Math.max(0, x1 - x0)),
      h: r2(Math.max(0, y1 - y0)),
    };
  };
  const out: Mark[] = [];
  for (const { mark, si } of input.marks) {
    const signed = input.signSeries.has(si);
    const spans: { clip: Rect | null; dashed: boolean }[] =
      xf === null
        ? [{ clip: null, dashed: false }]
        : [
            { clip: alongBox(aLo, xf), dashed: false },
            { clip: alongBox(xf, aHi), dashed: true },
          ];
    const tones: { clip: Rect | null; low: boolean }[] = signed
      ? [
          { clip: up, low: false },
          { clip: down, low: true },
        ]
      : [{ clip: null, low: false }];
    // 면 (면 종류) — 예측으로 나누지 않고 손익 색으로만 (ztd 도 예측은 선만 파선).
    if (mark.fillSeries !== undefined)
      for (const tone of tones)
        out.push({
          ...withoutStroke(mark),
          ...(tone.low
            ? {
                fillSeries: undefined,
                fillPaint: "neutral" as const,
                fillOpacity: mark.fillOpacity ?? 0.85,
              }
            : {}),
          ...(tone.clip ? { clip: tone.clip } : {}),
        });
    if (mark.strokeSeries !== undefined)
      for (const span of spans)
        for (const tone of tones) {
          const clip =
            span.clip && tone.clip
              ? meet(span.clip, tone.clip)
              : (span.clip ?? tone.clip);
          out.push({
            ...withoutFill(mark),
            ...(tone.low
              ? { strokeSeries: undefined, strokePaint: "neutral" as const }
              : {}),
            ...(span.dashed ? { dash: [5, 4] } : {}),
            ...(clip ? { clip } : {}),
          });
        }
  }
  const under: LineMark[] = sign ? [plotLine(plot, horizontal, r2(cb))] : [];
  return { marks: out.map(clean), under };
}

/**
 * 그림 상자를 가로지르는 선 — `vertical` 이면 x = `at` 의 세로선, 아니면 y = `at` 의 가로선 (역할 axis).
 * 손익 기준선 · 동기화 안내선 · 범위 선택 끝선이 같이 쓴다.
 */
export function plotLine(
  plot: Rect,
  vertical: boolean,
  at: number,
  extra?: Partial<Omit<LineMark, "kind" | "x1" | "y1" | "x2" | "y2">>,
): LineMark {
  return vertical
    ? {
        kind: "line",
        x1: at,
        y1: plot.y,
        x2: at,
        y2: plot.y + plot.h,
        role: "axis",
        ...extra,
      }
    : {
        kind: "line",
        x1: plot.x,
        y1: at,
        x2: plot.x + plot.w,
        y2: at,
        role: "axis",
        ...extra,
      };
}

function withoutStroke(mark: PathMark): PathMark {
  const { strokeSeries: _s, strokeWidth: _w, strokePaint: _p, ...rest } = mark;
  return rest;
}

function withoutFill(mark: PathMark): PathMark {
  const { fillSeries: _f, fillOpacity: _o, fillPaint: _p, ...rest } = mark;
  return rest;
}

/** `undefined` 값 키를 지운다 (scene JSON 이 키 유무로 비교된다). */
function clean(mark: Mark): Mark {
  return Object.fromEntries(
    Object.entries(mark).filter(([, v]) => v !== undefined),
  ) as unknown as Mark;
}
