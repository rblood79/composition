/**
 * ADR-194 — pie / donut 마크. 자체 `arcPath` 로 SVG `A` 명령을 낸다.
 *
 * CanvasKit `Path.MakeFromSVGString` 이 `A` 를 파싱한다는 것은 Phase 1 의
 * `nodeRendererPath.integration.test.ts` 가 실제 픽셀로 확인했다 — 이 파일이
 * 그 전제 위에 선다.
 *
 * 파이는 범주 축·값 축이 없다: **범주가 조각**이고 **시리즈가 링**이다
 * (shadcn `chart-pie-stacked` 의 이중 링). 안쪽 반지름(innerRadius)이 0 보다
 * 크면 도넛이고, 그 구멍에 합계를 적을 수 있다 (`chart-pie-donut-text`).
 */
import { formatTick, r2 } from "../scales";
import type { SeriesGrid, StackMode } from "../series";
import type { PathMark, Rect, TextMark } from "../types";

export interface PieMarkInput {
  grid: SeriesGrid;
  plot: Rect;
  /** 팔레트 길이 — 파이는 **범주**가 색을 가르므로 범주 인덱스를 여기로 modulo 한다. */
  seriesCount: number;
  showValueLabels: boolean;
  /** 바깥 반지름 대비 안쪽 반지름 비율 (0~90, %) */
  innerRadius: number;
  /** 구멍 안 합계 표시 (도넛일 때만) */
  showTotal: boolean;
  /** 합계 아래 설명 — metric 필드명 */
  totalCaption: string;
  /** 시리즈를 링으로 나눌지 (dodged 면 첫 시리즈만 그린다) */
  stackMode: StackMode;
  fontSize: number;
}

export interface PieMarks {
  marks: PathMark[];
  labels: TextMark[];
}

/** 링 사이 간격 — 붙여 그리면 두 링의 경계가 조각 경계처럼 보인다. */
const RING_GAP = 2;

/** 각도(도) → 원 위의 점. 12시 방향을 0° 로 두고 시계 방향. */
function polar(
  cx: number,
  cy: number,
  radius: number,
  degrees: number,
): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [
    r2(cx + radius * Math.cos(radians)),
    r2(cy + radius * Math.sin(radians)),
  ];
}

function circleCommands(
  cx: number,
  cy: number,
  radius: number,
  sweepFlag: 0 | 1,
): string {
  const [ax, ay] = polar(cx, cy, radius, 0);
  const [bx, by] = polar(cx, cy, radius, 180);
  const r = r2(radius);
  return `M ${ax} ${ay} A ${r} ${r} 0 1 ${sweepFlag} ${bx} ${by} A ${r} ${r} 0 1 ${sweepFlag} ${ax} ${ay} Z`;
}

/**
 * 조각 하나의 path. 360°(단일 조각)는 `A` 하나로 표현할 수 없어
 * (시작=끝이면 호가 사라진다) 반원 2개로 쪼갠다.
 *
 * `innerRadius > 0` 이면 고리 조각이다 — 바깥 호를 시계 방향으로 긋고 안쪽 호를
 * 반대 방향으로 되짚어 닫는다. 전체 고리(360°)는 두 원의 감김 방향을 반대로
 * 두고 소비처가 `evenodd` 로 뚫는다.
 */
export function arcSlicePath(
  cx: number,
  cy: number,
  radius: number,
  innerRadius: number,
  startDeg: number,
  sweepDeg: number,
): string {
  if (sweepDeg <= 0 || radius <= 0) return "";
  const inner = Math.max(0, Math.min(innerRadius, radius));
  const full = sweepDeg >= 359.999;

  if (full) {
    const outer = circleCommands(cx, cy, radius, 1);
    return inner > 0 ? `${outer} ${circleCommands(cx, cy, inner, 0)}` : outer;
  }

  const [sx, sy] = polar(cx, cy, radius, startDeg);
  const [ex, ey] = polar(cx, cy, radius, startDeg + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  const ro = r2(radius);

  if (inner <= 0) {
    return `M ${r2(cx)} ${r2(cy)} L ${sx} ${sy} A ${ro} ${ro} 0 ${largeArc} 1 ${ex} ${ey} Z`;
  }

  const [isx, isy] = polar(cx, cy, inner, startDeg + sweepDeg);
  const [iex, iey] = polar(cx, cy, inner, startDeg);
  const ri = r2(inner);
  return `M ${sx} ${sy} A ${ro} ${ro} 0 ${largeArc} 1 ${ex} ${ey} L ${isx} ${isy} A ${ri} ${ri} 0 ${largeArc} 0 ${iex} ${iey} Z`;
}

/** 구 API — 속이 찬 조각. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  sweepDeg: number,
): string {
  return arcSlicePath(cx, cy, radius, 0, startDeg, sweepDeg);
}

interface Slice {
  categoryIndex: number;
  magnitude: number;
  raw: number;
}

function slicesOf(grid: SeriesGrid, seriesIdx: number): {
  slices: Slice[];
  total: number;
} {
  const series = grid.series[seriesIdx];
  const slices: Slice[] = [];
  let total = 0;
  if (!series) return { slices, total };
  for (let ci = 0; ci < grid.categories.length; ci++) {
    const v = series.values.get(ci);
    if (v === undefined) continue;
    // 음수는 각도를 만들 수 없다 — 절대값으로 비중을 낸다 (파이에 음수를 넣은
    //   입력을 버리지 않고 크기로 해석. 부호는 파이가 표현할 수 없는 축이다).
    const magnitude = Math.abs(v);
    if (magnitude === 0) continue;
    slices.push({ categoryIndex: ci, magnitude, raw: v });
    total += magnitude;
  }
  return { slices, total };
}

export function buildPieMarks(input: PieMarkInput): PieMarks {
  const {
    grid,
    plot,
    seriesCount,
    showValueLabels,
    innerRadius,
    showTotal,
    totalCaption,
    stackMode,
    fontSize,
  } = input;
  const marks: PathMark[] = [];
  const labels: TextMark[] = [];

  const cx = plot.x + plot.w / 2;
  const cy = plot.y + plot.h / 2;
  const outerRadius = Math.min(plot.w, plot.h) / 2;
  if (outerRadius <= 0 || grid.series.length === 0) return { marks, labels };

  const holeRatio = Math.min(Math.max(innerRadius, 0), 90) / 100;
  const holeRadius = r2(outerRadius * holeRatio);
  // 링은 누적 모드에서만 나눈다 — dodged 파이는 첫 시리즈만 그린다 (겹쳐 그리면
  //   뒤 시리즈가 통째로 가려져 화면에 없는 데이터가 된다).
  const ringCount = stackMode === "none" ? 1 : grid.series.length;
  const ringBand = (outerRadius - holeRadius) / ringCount;
  const palette = Math.max(1, seriesCount);

  let grandTotal = 0;

  for (let si = 0; si < ringCount; si++) {
    const { slices, total } = slicesOf(grid, si);
    if (total === 0) continue;
    grandTotal += total;

    const ringOuter = outerRadius - ringBand * si;
    const ringInner =
      ringCount > 1 ? ringOuter - ringBand + RING_GAP : holeRadius;
    if (ringOuter - ringInner <= 0) continue;

    let angle = 0;
    for (const slice of slices) {
      const sweep = (slice.magnitude / total) * 360;
      const d = arcSlicePath(cx, cy, ringOuter, ringInner, angle, sweep);
      const midAngle = angle + sweep / 2;
      angle += sweep;
      if (!d) continue;
      marks.push({
        kind: "path",
        d,
        // 조각별 bbox 를 정확히 재려면 호의 극점 판정이 필요하다. 원 전체 bbox 는
        //   항상 상위집합이라 컬링이 오판하지 않는다 (R9 요구는 상위집합).
        bbox: {
          x: r2(cx - ringOuter),
          y: r2(cy - ringOuter),
          w: r2(ringOuter * 2),
          h: r2(ringOuter * 2),
        },
        // 파이는 시리즈가 아니라 **범주**가 색을 가른다 (조각마다 다른 색).
        fillSeries: slice.categoryIndex % palette,
        // 고리는 바깥/안쪽 두 경로가 겹친다 — evenodd 라야 구멍이 뚫린다.
        ...(ringInner > 0 ? { fillRule: "evenodd" as const } : {}),
      });

      if (showValueLabels) {
        const text = formatTick(slice.raw);
        if (text !== "") {
          // 링 두께의 중앙 — 속이 찬 파이는 반지름의 62% (중심은 조각끼리 겹치고
          //   테두리는 잘린다).
          const radius =
            ringInner > 0 ? (ringOuter + ringInner) / 2 : ringOuter * 0.62;
          const [lx, ly] = polar(cx, cy, radius, midAngle);
          labels.push({
            kind: "text",
            x: lx,
            y: ly,
            text,
            anchor: "middle",
            baseline: "middle",
            role: "value",
          });
        }
      }
    }
  }

  if (marks.length === 0) return { marks, labels };

  // 구멍 안 합계 — 구멍이 글자보다 작으면 그리지 않는다.
  const innermost =
    ringCount > 1 ? outerRadius - ringBand * (ringCount - 1) - ringBand + RING_GAP : holeRadius;
  if (showTotal && innermost >= fontSize) {
    labels.push({
      kind: "text",
      x: r2(cx),
      y: r2(cy - fontSize * 0.2),
      text: formatTick(grandTotal),
      anchor: "middle",
      baseline: "middle",
      role: "value",
      fontScale: 1.8,
    });
    if (totalCaption && innermost >= fontSize * 2) {
      labels.push({
        kind: "text",
        x: r2(cx),
        y: r2(cy + fontSize * 1.3),
        text: totalCaption,
        anchor: "middle",
        baseline: "middle",
        role: "tick",
      });
    }
  }

  return { marks, labels };
}
