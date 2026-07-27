import type { CanvasKit, Canvas } from "canvaskit-wasm";
import type { SkiaNodeData } from "./nodeRendererTypes";
import { acquirePooledPaint, releasePooledPaint } from "./paints";

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

  const path = new ck.Path();
  const oval = ck.LTRBRect(cx - radius, cy - radius, cx + radius, cy + radius);
  path.addArc(oval, startAngle, sweepAngle);

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

  const maxR = Math.min(w, h) / 2;
  const [rawTL, rawTR, rawBR, rawBL] = borderRadius;
  const rTL = Math.min(Math.max(0, rawTL), maxR);
  const rTR = Math.min(Math.max(0, rawTR), maxR);
  const rBR = Math.min(Math.max(0, rawBR), maxR);
  const rBL = Math.min(Math.max(0, rawBL), maxR);

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
    const path = new ck.Path();
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
    canvas.drawPath(path, paint);
    path.delete();
  }

  if (sides.right) {
    const path = new ck.Path();
    if (rTR > 0) {
      path.moveTo(w - rTR - inset, inset);
      path.arcToTangent(w - inset, inset, w - inset, rTR + inset, rTR);
    } else {
      path.moveTo(w - inset, inset);
    }
    if (rBR > 0) {
      path.lineTo(w - inset, h - rBR - inset);
      path.arcToTangent(w - inset, h - inset, w - rBR - inset, h - inset, rBR);
    } else {
      path.lineTo(w - inset, h - inset);
    }
    canvas.drawPath(path, paint);
    path.delete();
  }

  if (sides.bottom) {
    const path = new ck.Path();
    if (rBR > 0) {
      path.moveTo(w - inset, h - rBR - inset);
      path.arcToTangent(w - inset, h - inset, w - rBR - inset, h - inset, rBR);
    } else {
      path.moveTo(w - inset, h - inset);
    }
    if (rBL > 0) {
      path.lineTo(rBL + inset, h - inset);
      path.arcToTangent(inset, h - inset, inset, h - rBL - inset, rBL);
    } else {
      path.lineTo(inset, h - inset);
    }
    canvas.drawPath(path, paint);
    path.delete();
  }

  if (sides.left) {
    const path = new ck.Path();
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
