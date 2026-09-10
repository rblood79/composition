import type { CanvasKit, Canvas, Path } from "canvaskit-wasm";
import { buildPath } from "./buildPath";
import type { SkiaNodeData } from "./nodeRendererTypes";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { getCacheMetrics } from "./cacheMetrics";
import { clampCornerRadii } from "./nodeRendererClip";

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

  const [rTL, rTR, rBR, rBL] = clampCornerRadii(borderRadius, w, h);

  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(strokeWidth);
  paint.setStrokeCap(ck.StrokeCap.Butt);
  paint.setColor(strokeColor);

  let dashEffect: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
  if (strokeDasharray && strokeDasharray.length >= 2) {
    dashEffect = ck.PathEffect.MakeDash(strokeDasharray);
    paint.setPathEffect(dashEffect);
  }

  const inset = strokeWidth / 2;

  if (sides.top) {
    const path = buildPath(ck, (path) => {
      if (rTL > 0) {
        path.moveTo(inset, rTL + inset);
        path.arcToTangent(inset, inset, rTL + inset, inset, rTL);
      } else {
        path.moveTo(inset, inset);
      }
      if (rTR > 0) {
        path.lineTo(w - rTR - inset, inset);
        path.arcToTangent(w - inset, inset, w - inset, rTR + inset, rTR);
      } else {
        path.lineTo(w - inset, inset);
      }
    });
    canvas.drawPath(path, paint);
    path.delete();
  }

  if (sides.right) {
    const path = buildPath(ck, (path) => {
      if (rTR > 0) {
        path.moveTo(w - rTR - inset, inset);
        path.arcToTangent(w - inset, inset, w - inset, rTR + inset, rTR);
      } else {
        path.moveTo(w - inset, inset);
      }
      if (rBR > 0) {
        path.lineTo(w - inset, h - rBR - inset);
        path.arcToTangent(
          w - inset,
          h - inset,
          w - rBR - inset,
          h - inset,
          rBR,
        );
      } else {
        path.lineTo(w - inset, h - inset);
      }
    });
    canvas.drawPath(path, paint);
    path.delete();
  }

  if (sides.bottom) {
    const path = buildPath(ck, (path) => {
      if (rBR > 0) {
        path.moveTo(w - inset, h - rBR - inset);
        path.arcToTangent(
          w - inset,
          h - inset,
          w - rBR - inset,
          h - inset,
          rBR,
        );
      } else {
        path.moveTo(w - inset, h - inset);
      }
      if (rBL > 0) {
        path.lineTo(rBL + inset, h - inset);
        path.arcToTangent(inset, h - inset, inset, h - rBL - inset, rBL);
      } else {
        path.lineTo(inset, h - inset);
      }
    });
    canvas.drawPath(path, paint);
    path.delete();
  }

  if (sides.left) {
    const path = buildPath(ck, (path) => {
      if (rBL > 0) {
        path.moveTo(rBL + inset, h - inset);
        path.arcToTangent(inset, h - inset, inset, h - rBL - inset, rBL);
      } else {
        path.moveTo(inset, h - inset);
      }
      if (rTL > 0) {
        path.lineTo(inset, rTL + inset);
        path.arcToTangent(inset, inset, rTL + inset, inset, rTL);
      } else {
        path.lineTo(inset, inset);
      }
    });
    canvas.drawPath(path, paint);
    path.delete();
  }

  if (dashEffect) {
    paint.setPathEffect(null);
    dashEffect.delete();
  }
  releasePooledPaint(paint);
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
