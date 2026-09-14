import type { CanvasKit, Canvas, Path } from "canvaskit-wasm";
import { buildPath } from "./buildPath";
import type { SkiaNodeData } from "./nodeRendererTypes";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { getCacheMetrics } from "./cacheMetrics";
import { resolveCssCornerRadii } from "../styleConversion/borderGeometry";
import { createRoundRectPath } from "./nodeRendererClip";

export function renderLine(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  if (!node.line) return;
  // Skip fully transparent strokes — Skia paint doesn't always respect alpha=0
  if (node.line.strokeColor[3] <= 0) return;
  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(node.line.strokeWidth);
  const cap = node.line.strokeCap;
  paint.setStrokeCap(
    cap === "butt"
      ? ck.StrokeCap.Butt
      : cap === "square"
        ? ck.StrokeCap.Square
        : ck.StrokeCap.Round,
  );
  paint.setColor(node.line.strokeColor);

  let dashEffect: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
  if (node.line.strokeDasharray && node.line.strokeDasharray.length >= 2) {
    dashEffect = ck.PathEffect.MakeDash(node.line.strokeDasharray);
    paint.setPathEffect(dashEffect);
  }

  canvas.drawLine(
    node.line.x1,
    node.line.y1,
    node.line.x2,
    node.line.y2,
    paint,
  );

  if (dashEffect) {
    paint.setPathEffect(null);
    dashEffect.delete();
  }
  releasePooledPaint(paint);
}

export function renderArc(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  if (!node.arc) return;
  const {
    cx,
    cy,
    radius,
    startAngle,
    sweepAngle,
    strokeColor,
    strokeWidth,
    strokeCap,
  } = node.arc;

  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(strokeWidth);
  paint.setColor(strokeColor);

  if (strokeCap === "round") {
    paint.setStrokeCap(ck.StrokeCap.Round);
  } else if (strokeCap === "square") {
    paint.setStrokeCap(ck.StrokeCap.Square);
  } else {
    paint.setStrokeCap(ck.StrokeCap.Butt);
  }

  const oval = ck.LTRBRect(cx - radius, cy - radius, cx + radius, cy + radius);
  const path = buildPath(ck, (path) => {
    path.addArc(oval, startAngle, sweepAngle);
  });

  canvas.drawPath(path, paint);

  path.delete();
  releasePooledPaint(paint);
}

/**
 * CSS dashed/dotted 의 dash 배열 — Chrome 실측 (ADR-219 G2, 2026-09-14 Preview 픽셀):
 *
 * - dashed: 폭 < 3 → dash 3w · gap 2w (w=2: 6/4), 폭 ≥ 3 → dash 2w · gap w (w=3: 6/3 ·
 *   w=4: 8/4 · w=8: 16/9). 종전 `[3w, 2w]` 고정은 w=4 에서 12/8 이라 대칭이 0.040 이었다.
 * - dotted: `[0, 2w]` + round cap → 지름 w 점이 2w 주기 (w=4: 점 3~4 · 간격 5).
 *   종전 `[w, 1.5w]` + round cap 은 점 2w · 간격 0.5w.
 * - `pathLength` 를 주면 Chrome 처럼 **gap 을 늘여 패턴이 경로 길이에 정확히 맞게** 한다
 *   (닫힌 경로에서 시작·끝이 이어지고, 위상은 경로 시작 = TL 호 끝에서 dash 로 시작).
 */
export function cssDashPattern(
  style: "dashed" | "dotted",
  width: number,
  pathLength?: number,
): number[] {
  const dash = style === "dotted" ? 0 : width < 3 ? width * 3 : width * 2;
  let gap = style === "dotted" ? width * 2 : width < 3 ? width * 2 : width;
  gap = Math.max(gap, 1);
  if (pathLength && pathLength > dash + gap) {
    const n = Math.max(1, Math.round(pathLength / (dash + gap)));
    gap = Math.max(1, pathLength / n - dash);
  }
  return [dash, gap];
}

/** 코너별 반경 rrect 의 둘레 (dash 맞춤용) — 직선 합 + 사분원 호 4 */
export function roundRectPerimeter(
  width: number,
  height: number,
  radii: readonly [number, number, number, number],
): number {
  const sum = radii[0] + radii[1] + radii[2] + radii[3];
  return 2 * (width + height) - 2 * sum + (Math.PI / 2) * sum;
}

/**
 * 변별 stroke 한 벌의 입력 (ADR-219).
 *
 * `radii` 는 이미 CSS §4.5 축소를 거친 **바깥** 반경, `widths` 는 `[top, right, bottom,
 * left]` (0 = 그 변 없음). 색 하나, dash 하나 — 변별 색은 범위 밖.
 */
export interface SidedStrokeSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  radii: readonly [number, number, number, number];
  widths: readonly [number, number, number, number];
  color: Float32Array;
  /** 변 폭에 맞춘 dash 배열 (없으면 solid) — 변마다 자기 폭 · 그 중심선 둘레로 맞춘다 */
  dashFor?: (sideWidth: number, pathLength: number) => number[] | null;
  roundCap?: boolean;
}

/**
 * 변별 stroke — CSS `BoxBorderPainter` 와 같은 모델: 변마다 자기 폭의 중심선 rrect 를
 * 전체 stroke 하되 그 변의 **wedge** (바깥 두 꼭짓점 → 안쪽 두 꼭짓점 사다리꼴) 로 clip
 * 한다. wedge 네 개는 테두리 띠를 겹침 없이 분할하므로:
 *
 * - 인접 두 변이 모두 있는 코너는 폭 비율의 대각선에서 갈린다 (같은 폭이면 45°) — 호가
 *   한 번만 칠해진다 (반투명 stroke 겹침 0, 종전 `renderPartialBorder` 는 두 변이 각각
 *   호 전체를 그렸다).
 * - 한 변만 있는 코너는 대각선이 세로/가로가 되어 그 변이 코너 전체를 가진다.
 * - 반경 0 코너의 miter 도 같은 규칙 (대각선 join).
 *
 * dashed/dotted 의 코너 호 폭은 그 변 폭이라 두 변 폭이 다르면 호 중간에서 폭이 바뀐다
 * (근사 — solid 는 이 함수가 아니라 even-odd 띠로 그린다, breakdown §2.3).
 */
export function renderSidedStroke(
  ck: CanvasKit,
  canvas: Canvas,
  spec: SidedStrokeSpec,
): void {
  const { x, y, width: w, height: h, radii, widths, color } = spec;
  const [wt, wr, wb, wl] = widths;
  if (wt <= 0 && wr <= 0 && wb <= 0 && wl <= 0) return;
  const [rTL, rTR, rBR, rBL] = radii;

  // 바깥 꼭짓점 · 안쪽 (padding box) 꼭짓점
  const ox0 = x;
  const oy0 = y;
  const ox1 = x + w;
  const oy1 = y + h;
  const ix0 = x + wl;
  const iy0 = y + wt;
  const ix1 = x + w - wr;
  const iy1 = y + h - wb;

  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setColor(color);
  paint.setStrokeCap(spec.roundCap ? ck.StrokeCap.Round : ck.StrokeCap.Butt);

  // 변 wedge: [바깥 시작, 바깥 끝, 안쪽 끝, 안쪽 시작] (시계 방향)
  const wedges: Array<[number, [number, number][]]> = [
    [
      wt,
      [
        [ox0, oy0],
        [ox1, oy0],
        [ix1, iy0],
        [ix0, iy0],
      ],
    ],
    [
      wr,
      [
        [ox1, oy0],
        [ox1, oy1],
        [ix1, iy1],
        [ix1, iy0],
      ],
    ],
    [
      wb,
      [
        [ox1, oy1],
        [ox0, oy1],
        [ix0, iy1],
        [ix1, iy1],
      ],
    ],
    [
      wl,
      [
        [ox0, oy1],
        [ox0, oy0],
        [ix0, iy0],
        [ix0, iy1],
      ],
    ],
  ];

  for (const [sideWidth, quad] of wedges) {
    if (sideWidth <= 0) continue;
    const inset = sideWidth / 2;
    paint.setStrokeWidth(sideWidth);

    // 중심선 rrect — 이 변 폭만큼 안쪽, 반경은 바깥 반경 − 반폭. 경로 시작은 TL 호 끝
    //   (Chrome 의 dash 위상과 같다) — `createRoundRectPath` 가 그 순서로 만든다.
    const c = (r: number) => Math.max(0, r - inset);
    const cw = w - sideWidth;
    const ch = h - sideWidth;
    const centerRadii: [number, number, number, number] = [
      c(rTL),
      c(rTR),
      c(rBR),
      c(rBL),
    ];
    const centerline = createRoundRectPath(
      ck,
      x + inset,
      y + inset,
      cw,
      ch,
      centerRadii,
    );

    let dashEffect: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
    const dash =
      spec.dashFor?.(sideWidth, roundRectPerimeter(cw, ch, centerRadii)) ??
      null;
    if (dash && dash.length >= 2) {
      dashEffect = ck.PathEffect.MakeDash(dash);
      paint.setPathEffect(dashEffect);
    } else {
      paint.setPathEffect(null);
    }
    const wedge = buildPath(ck, (path) => {
      path.moveTo(quad[0][0], quad[0][1]);
      path.lineTo(quad[1][0], quad[1][1]);
      path.lineTo(quad[2][0], quad[2][1]);
      path.lineTo(quad[3][0], quad[3][1]);
      path.close();
    });

    canvas.save();
    canvas.clipPath(wedge, ck.ClipOp.Intersect, true);
    canvas.drawPath(centerline, paint);
    canvas.restore();

    wedge.delete();
    centerline.delete();
    if (dashEffect) {
      paint.setPathEffect(null);
      dashEffect.delete();
    }
  }

  releasePooledPaint(paint);
}

/**
 * 잔존 spec `sides` 프리미티브 — 폭 하나 · 변 마스크. 코너 소유권은 `renderSidedStroke`
 * (ADR-219: 종전엔 인접 두 변이 코너 호를 각각 전체로 그려 반투명에서 두 번 칠했다).
 */
export function renderPartialBorder(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  if (!node.partialBorder) return;
  const { sides, strokeColor, strokeWidth, strokeDasharray, borderRadius } =
    node.partialBorder;
  const w = node.width;
  const h = node.height;
  const radii = resolveCssCornerRadii(borderRadius, w, h);
  const on = (flag: boolean | undefined) => (flag ? strokeWidth : 0);

  renderSidedStroke(ck, canvas, {
    x: 0,
    y: 0,
    width: w,
    height: h,
    radii,
    widths: [on(sides.top), on(sides.right), on(sides.bottom), on(sides.left)],
    color: strokeColor,
    dashFor:
      strokeDasharray && strokeDasharray.length >= 2
        ? () => strokeDasharray
        : undefined,
    // dotted (`[0, 2w]`) 는 round cap 이어야 점이 보인다 (butt 은 0 길이 dash 가 사라진다)
    roundCap: strokeDasharray?.[0] === 0,
  });
}

export function renderIconPath(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  if (!node.iconPath) return;
  const { paths, circles, cx, cy, size, strokeColor, strokeWidth } =
    node.iconPath;
  const scale = size / 24;

  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(strokeWidth);
  paint.setStrokeCap(ck.StrokeCap.Round);
  paint.setStrokeJoin(ck.StrokeJoin.Round);
  paint.setColor(strokeColor);

  canvas.save();
  canvas.translate(cx - size / 2, cy - size / 2);
  canvas.scale(scale, scale);

  for (const d of paths) {
    const path = ck.Path.MakeFromSVGString(d);
    if (path) {
      canvas.drawPath(path, paint);
      path.delete();
    }
  }

  if (circles) {
    for (const c of circles) {
      canvas.drawCircle(c.cx, c.cy, c.r, paint);
    }
  }

  releasePooledPaint(paint);
  canvas.restore();
}

/**
 * ADR-211 P4 — SVG `d` → `Path` 캐시 (LRU · 개수/바이트 상한 · 퇴출 시 `delete()`).
 *
 * `MakeFromSVGString` 은 문자열 길이에 비례하는 wasm 파싱이다. 행 상한 200 을 없애자
 * 640px 선/영역 차트 하나가 200 범주 × 4 시리즈 = path 문자열 33~65 KB 가 되고, 내용
 * 재기록 때마다 다시 파싱해 `render.frame` p95 가 +8ms 났다 (group800 frame A/B,
 * `renderPath` wasm 13 → 261 ms / 54 op). 같은 `d` 는 노드 데이터가 바뀌지 않는 한
 * 같으므로 파싱 결과를 재사용한다. Path 는 그리기에 불변이라 공유해도 안전하다
 * (`drawPath` 는 SkPath 를 값 복사 — 퇴출이 record 된 picture 를 깨지 않는다;
 * `setFillType` 은 생성 시 한 번, 키에 포함).
 *
 * 상한은 자연 소멸이 없는 캐시의 규칙 (메모리 `feedback-content-key-cache-has-no-natural-death`).
 * 개수와 바이트를 같이 건다 — 개수만 걸면 조각당 path 1개인 pie (200 범주 × 3개 = 600)
 * 가 순차 접근에서 매 pass 전량 miss 하는 LRU 절벽이 생기고, 바이트만 걸면 소형
 * path 수천 개가 Map churn 을 만든다. 4 MB 는 65 KB 급 path 60개 + 소형 수천 개.
 */
const SVG_PATH_CACHE_MAX_ENTRIES = 4096;
const SVG_PATH_CACHE_MAX_BYTES = 4 * 1024 * 1024;
interface SvgPathCache {
  paths: Map<string, Path>;
  bytes: number;
}
const svgPathCaches = new WeakMap<CanvasKit, SvgPathCache>();

function svgPathCacheFor(ck: CanvasKit): SvgPathCache {
  let cache = svgPathCaches.get(ck);
  if (!cache) {
    cache = { paths: new Map(), bytes: 0 };
    svgPathCaches.set(ck, cache);
  }
  return cache;
}

/** 캐시 비우기 — 테스트 격리 · CanvasKit 인스턴스를 유지한 채 캔버스를 내릴 때. */
export function clearSvgPathCache(ck: CanvasKit): void {
  const cache = svgPathCaches.get(ck);
  if (!cache) return;
  for (const path of cache.paths.values()) path.delete();
  cache.paths.clear();
  cache.bytes = 0;
}

function acquireSvgPath(
  ck: CanvasKit,
  d: string,
  fillRule: string | undefined,
): Path | null {
  const cache = svgPathCacheFor(ck);
  const key = fillRule === "evenodd" ? `e|${d}` : d;
  const hit = cache.paths.get(key);
  if (hit) {
    // LRU — 최근 사용을 뒤로.
    cache.paths.delete(key);
    cache.paths.set(key, hit);
    if (process.env.NODE_ENV === "development") {
      getCacheMetrics("svgPath").recordHit();
    }
    return hit;
  }
  const path = ck.Path.MakeFromSVGString(d);
  if (!path) return null;
  if (fillRule === "evenodd") path.setFillType(ck.FillType.EvenOdd);
  cache.paths.set(key, path);
  cache.bytes += key.length;
  const metrics =
    process.env.NODE_ENV === "development" ? getCacheMetrics("svgPath") : null;
  while (
    cache.paths.size > SVG_PATH_CACHE_MAX_ENTRIES ||
    cache.bytes > SVG_PATH_CACHE_MAX_BYTES
  ) {
    const oldest = cache.paths.keys().next().value;
    if (oldest === undefined) break;
    cache.paths.get(oldest)?.delete();
    cache.paths.delete(oldest);
    cache.bytes -= oldest.length;
    metrics?.recordEviction();
  }
  if (metrics) {
    metrics.recordMiss("parse");
    metrics.setSize(cache.paths.size);
  }
  return path;
}

/**
 * ADR-194 Phase 1 — 임의 SVG path 렌더.
 *
 * `Path.MakeFromSVGString` 은 CanvasKit 0.42.0 유지 API (ADR-117 Implemented 후에도
 * 동일) 다. lucide 레지스트리에 잠겨 있던 이 경로가 본 함수로 일반화된다 —
 * `renderIconPath` 는 24 viewBox 스케일 + round cap/join 이 고정된 아이콘 전용이라
 * 그대로 두고(레지스트리 채널 불변), 임의 형상은 여기로 온다.
 *
 * fill 과 stroke 는 배타가 아니라 가산 — 둘 다 지정되면 fill 후 stroke 를 얹는다
 * (SVG `<path fill stroke>` 동형).
 */
export function renderPath(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  if (!node.path) return;
  const { d, offsetX, offsetY, fillColor, strokeColor, strokeWidth } =
    node.path;

  const hasFill = !!fillColor && fillColor[3] > 0;
  const hasStroke = !!strokeColor && strokeColor[3] > 0 && strokeWidth > 0;
  if (!hasFill && !hasStroke) return;

  const path = acquireSvgPath(ck, d, node.path.fillRule);
  if (!path) return;

  const translated = offsetX !== 0 || offsetY !== 0;
  if (translated) {
    canvas.save();
    canvas.translate(offsetX, offsetY);
  }

  if (hasFill) {
    const paint = acquirePooledPaint(ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Fill);
    paint.setColor(fillColor!);
    canvas.drawPath(path, paint);
    releasePooledPaint(paint);
  }

  if (hasStroke) {
    const paint = acquirePooledPaint(ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(strokeWidth);
    const cap = node.path.strokeCap;
    paint.setStrokeCap(
      cap === "round"
        ? ck.StrokeCap.Round
        : cap === "square"
          ? ck.StrokeCap.Square
          : ck.StrokeCap.Butt,
    );
    const join = node.path.strokeJoin;
    paint.setStrokeJoin(
      join === "round"
        ? ck.StrokeJoin.Round
        : join === "bevel"
          ? ck.StrokeJoin.Bevel
          : ck.StrokeJoin.Miter,
    );
    paint.setColor(strokeColor!);
    canvas.drawPath(path, paint);
    releasePooledPaint(paint);
  }

  if (translated) canvas.restore();
}

export function renderScrollbar(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  if (!node.scrollbar) return;

  const TRACK_WIDTH = 8;
  const TRACK_RADIUS = 4;
  const THUMB_RADIUS = 4;
  const TRACK_COLOR = Float32Array.of(0, 0, 0, 0.08);
  const THUMB_COLOR = Float32Array.of(0, 0, 0, 0.25);

  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(true);

  if (node.scrollbar.vertical) {
    const { trackHeight, thumbHeight, thumbY } = node.scrollbar.vertical;
    const trackX = node.width - TRACK_WIDTH - 2;
    const trackY = 0;

    paint.setStyle(ck.PaintStyle.Fill);
    paint.setColor(TRACK_COLOR);
    const trackRRect = ck.RRectXY(
      ck.LTRBRect(trackX, trackY, trackX + TRACK_WIDTH, trackY + trackHeight),
      TRACK_RADIUS,
      TRACK_RADIUS,
    );
    canvas.drawRRect(trackRRect, paint);

    paint.setColor(THUMB_COLOR);
    const thumbRRect = ck.RRectXY(
      ck.LTRBRect(trackX, thumbY, trackX + TRACK_WIDTH, thumbY + thumbHeight),
      THUMB_RADIUS,
      THUMB_RADIUS,
    );
    canvas.drawRRect(thumbRRect, paint);
  }

  if (node.scrollbar.horizontal) {
    const { trackWidth, thumbWidth, thumbX } = node.scrollbar.horizontal;
    const trackX = 0;
    const trackY = node.height - TRACK_WIDTH - 2;

    paint.setStyle(ck.PaintStyle.Fill);
    paint.setColor(TRACK_COLOR);
    const trackRRect = ck.RRectXY(
      ck.LTRBRect(trackX, trackY, trackX + trackWidth, trackY + TRACK_WIDTH),
      TRACK_RADIUS,
      TRACK_RADIUS,
    );
    canvas.drawRRect(trackRRect, paint);

    paint.setColor(THUMB_COLOR);
    const thumbRRect = ck.RRectXY(
      ck.LTRBRect(thumbX, trackY, thumbX + thumbWidth, trackY + TRACK_WIDTH),
      THUMB_RADIUS,
      THUMB_RADIUS,
    );
    canvas.drawRRect(thumbRRect, paint);
  }

  releasePooledPaint(paint);
}
