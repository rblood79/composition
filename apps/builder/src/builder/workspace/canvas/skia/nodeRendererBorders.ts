import type { CanvasKit, Canvas, Paint } from "canvaskit-wasm";
import { colord } from "colord";
import { applyFill } from "./fills";
import { SkiaDisposable } from "./disposable";
import { createRoundRectPath } from "./nodeRendererClip";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { DropShadowEffect } from "./types";

type BorderRadius = number | [number, number, number, number];
type SkiaPaint = Paint;

function parseSkiaColor(color: Float32Array): string {
  const r = Math.round(color[0] * 255);
  const g = Math.round(color[1] * 255);
  const b = Math.round(color[2] * 255);
  return `rgb(${r},${g},${b})`;
}

function hexToSkiaColor(hex: string, alpha: number): Float32Array {
  const c = colord(hex);
  const rgb = c.toRgb();
  return Float32Array.of(rgb.r / 255, rgb.g / 255, rgb.b / 255, alpha);
}

function drawStrokeShape(
  ck: CanvasKit,
  canvas: Canvas,
  paint: SkiaPaint,
  inset: number,
  width: number,
  height: number,
  br: BorderRadius,
  hasRadius: boolean,
  isArrayRadius: boolean,
): void {
  const strokeRect = ck.LTRBRect(inset, inset, width - inset, height - inset);
  if (hasRadius) {
    if (isArrayRadius) {
      const radii = br as [number, number, number, number];
      const innerRadii: [number, number, number, number] = [
        Math.max(0, radii[0] - inset),
        Math.max(0, radii[1] - inset),
        Math.max(0, radii[2] - inset),
        Math.max(0, radii[3] - inset),
      ];
      const path = createRoundRectPath(
        ck,
        inset,
        inset,
        width - inset * 2,
        height - inset * 2,
        innerRadii,
      );
      canvas.drawPath(path, paint);
      path.delete();
    } else {
      const adjustedRadius = Math.max(0, (br as number) - inset);
      const rrect = ck.RRectXY(strokeRect, adjustedRadius, adjustedRadius);
      canvas.drawRRect(rrect, paint);
    }
  } else {
    canvas.drawRect(strokeRect, paint);
  }
}

function renderSolidBorder(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  paint: SkiaPaint,
  sw: number,
  br: BorderRadius,
  hasRadius: boolean,
  isArrayRadius: boolean,
  strokeStyle: "solid" | "dashed" | "dotted" | undefined,
): void {
  // Final safety: Skia paint doesn't always respect alpha=0 — skip transparent strokes
  const strokeColor = node.box!.strokeColor!;
  if (strokeColor[3] <= 0) return;
  const inset = sw / 2;
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(sw);
  paint.setColor(strokeColor);

  let dashEffect: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
  if (strokeStyle === "dashed") {
    const dashLen = Math.max(sw * 3, 4);
    const gapLen = Math.max(sw * 2, 3);
    dashEffect = ck.PathEffect.MakeDash([dashLen, gapLen]);
    paint.setPathEffect(dashEffect);
  } else if (strokeStyle === "dotted") {
    dashEffect = ck.PathEffect.MakeDash([sw, sw * 1.5]);
    paint.setPathEffect(dashEffect);
    paint.setStrokeCap(ck.StrokeCap.Round);
  }

  drawStrokeShape(
    ck,
    canvas,
    paint,
    inset,
    node.width,
    node.height,
    br,
    hasRadius,
    isArrayRadius,
  );

  if (dashEffect) {
    paint.setPathEffect(null);
    dashEffect.delete();
  }
}

function renderDoubleBorder(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  paint: SkiaPaint,
  sw: number,
  br: BorderRadius,
  hasRadius: boolean,
  isArrayRadius: boolean,
): void {
  // Final safety: skip transparent strokes
  if (node.box!.strokeColor![3] <= 0) return;
  if (sw < 3) {
    renderSolidBorder(
      ck,
      canvas,
      node,
      paint,
      sw,
      br,
      hasRadius,
      isArrayRadius,
      "solid",
    );
    return;
  }

  const lineW = sw / 3;
  const color = node.box!.strokeColor!;

  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setColor(color);
  paint.setStrokeWidth(lineW);

  drawStrokeShape(
    ck,
    canvas,
    paint,
    lineW / 2,
    node.width,
    node.height,
    br,
    hasRadius,
    isArrayRadius,
  );
  drawStrokeShape(
    ck,
    canvas,
    paint,
    sw - lineW / 2,
    node.width,
    node.height,
    br,
    hasRadius,
    isArrayRadius,
  );
}

function renderGrooveRidgeBorder(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  paint: SkiaPaint,
  sw: number,
  br: BorderRadius,
  hasRadius: boolean,
  isArrayRadius: boolean,
  style: "groove" | "ridge",
): void {
  const halfSw = sw / 2;
  const color = node.box!.strokeColor!;
  // Final safety: skip transparent strokes
  if (color[3] <= 0) return;
  const alpha = color[3];
  const baseHex = parseSkiaColor(color);

  const darkColor = hexToSkiaColor(colord(baseHex).darken(0.3).toHex(), alpha);
  const lightColor = hexToSkiaColor(
    colord(baseHex).lighten(0.3).toHex(),
    alpha,
  );

  const outerColor = style === "groove" ? darkColor : lightColor;
  const innerColor = style === "groove" ? lightColor : darkColor;

  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(halfSw);

  paint.setColor(outerColor);
  drawStrokeShape(
    ck,
    canvas,
    paint,
    halfSw / 2,
    node.width,
    node.height,
    br,
    hasRadius,
    isArrayRadius,
  );

  paint.setColor(innerColor);
  drawStrokeShape(
    ck,
    canvas,
    paint,
    halfSw + halfSw / 2,
    node.width,
    node.height,
    br,
    hasRadius,
    isArrayRadius,
  );
}

function renderInsetOutsetBorder(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  paint: SkiaPaint,
  sw: number,
  br: BorderRadius,
  hasRadius: boolean,
  isArrayRadius: boolean,
  style: "inset" | "outset",
): void {
  const color = node.box!.strokeColor!;
  const alpha = color[3];
  // Final safety: skip transparent strokes
  if (alpha <= 0) return;
  const baseHex = parseSkiaColor(color);

  const darkColor = hexToSkiaColor(colord(baseHex).darken(0.3).toHex(), alpha);
  const lightColor = hexToSkiaColor(
    colord(baseHex).lighten(0.3).toHex(),
    alpha,
  );

  const tlColor = style === "inset" ? darkColor : lightColor;
  const brColor = style === "inset" ? lightColor : darkColor;
  const inset = sw / 2;

  canvas.save();
  const tlClipPath = new ck.Path();
  tlClipPath.moveTo(0, 0);
  tlClipPath.lineTo(node.width, 0);
  tlClipPath.lineTo(node.width - sw, sw);
  tlClipPath.lineTo(sw, sw);
  tlClipPath.lineTo(sw, node.height - sw);
  tlClipPath.lineTo(0, node.height);
  tlClipPath.close();
  canvas.clipPath(tlClipPath, ck.ClipOp.Intersect, true);
  tlClipPath.delete();

  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(sw);
  paint.setColor(tlColor);
  drawStrokeShape(
    ck,
    canvas,
    paint,
    inset,
    node.width,
    node.height,
    br,
    hasRadius,
    isArrayRadius,
  );
  canvas.restore();

  canvas.save();
  const brClipPath = new ck.Path();
  brClipPath.moveTo(node.width, node.height);
  brClipPath.lineTo(0, node.height);
  brClipPath.lineTo(sw, node.height - sw);
  brClipPath.lineTo(node.width - sw, node.height - sw);
  brClipPath.lineTo(node.width - sw, sw);
  brClipPath.lineTo(node.width, 0);
  brClipPath.close();
  canvas.clipPath(brClipPath, ck.ClipOp.Intersect, true);
  brClipPath.delete();

  paint.setColor(brColor);
  drawStrokeShape(
    ck,
    canvas,
    paint,
    inset,
    node.width,
    node.height,
    br,
    hasRadius,
    isArrayRadius,
  );
  canvas.restore();
}

/**
 * G1+G2: Box-shadow를 border-radius에 맞는 RRect로 직접 렌더.
 * spread는 RRect 크기 확대로 처리 (dilate/erode 대체).
 * CSS 스펙 레이어 순서: shadow → background → border
 */
function renderBoxShadows(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  if (!node.box?.shadows?.length) return;

  const br = node.box.borderRadius;
  const baseRadius =
    typeof br === "number" ? br : Array.isArray(br) ? br[0] : 0;

  for (const shadow of node.box.shadows) {
    if (shadow.inner) continue; // outer shadow만 처리

    const spread = shadow.spread ?? 0;
    const shadowRect = ck.LTRBRect(
      -spread,
      -spread,
      node.width + spread,
      node.height + spread,
    );

    const paint = new ck.Paint();
    paint.setAntiAlias(true);
    paint.setColor(shadow.color);

    if (shadow.sigmaX > 0 || shadow.sigmaY > 0) {
      paint.setImageFilter(
        ck.ImageFilter.MakeBlur(
          shadow.sigmaX,
          shadow.sigmaY,
          ck.TileMode.Decal,
          null,
        ),
      );
    }

    canvas.save();
    canvas.translate(shadow.dx, shadow.dy);

    // CSS 스펙: shadow radius = max(0, border-radius + spread)
    const shadowRadius = Math.max(0, baseRadius + spread);
    if (shadowRadius > 0) {
      canvas.drawRRect(
        ck.RRectXY(shadowRect, shadowRadius, shadowRadius),
        paint,
      );
    } else {
      canvas.drawRect(shadowRect, paint);
    }

    paint.delete();
    canvas.restore();
  }
}

/**
 * inset(inner) box-shadow 를 box RRect 지오메트리로 직접 렌더한다.
 *
 * effects.ts 의 saveLayer/MakeDropShadow 는 캡처된 콘텐츠(컨테이너 배경 + 자식) 실루엣에서
 * shadow 를 casting 하므로 컨테이너 inner edge shadow 를 만들 수 없다. inner shadow 는 fill 위
 * · content 아래에 box 내부로 clip 하여 그린다(CSS inset 대칭 · border 아래 레이어). 기법:
 * donut(외곽 rect − dx/dy 오프셋 구멍, even-odd)을 blur 해 box 내부로 clip → 오프셋된 solid
 * 밴드의 침입부만 남아 edge shadow 가 된다. inset 0 +2px → 상단 inner edge (CSS 대칭).
 *
 * 입력은 node.effects 의 inner drop-shadow (effects.ts 는 inner 를 skip). box.shadows 경로는
 * build*NodeData 에서 미populate → 미사용.
 */
function renderInnerBoxShadows(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  const inner = (node.effects ?? []).filter(
    (e): e is DropShadowEffect => e.type === "drop-shadow" && e.inner === true,
  );
  if (inner.length === 0) return;

  const w = node.width;
  const h = node.height;
  const br = node.box?.borderRadius;
  const baseRadius =
    typeof br === "number" ? br : Array.isArray(br) ? (br[0] ?? 0) : 0;

  for (const shadow of inner) {
    const spread = shadow.spread ?? 0;
    // 구멍 = box 내부를 spread 만큼 수축 후 dx/dy 오프셋. holeRadius 는 spread 만큼 축소.
    const holeLeft = spread + shadow.dx;
    const holeTop = spread + shadow.dy;
    const holeRight = w - spread + shadow.dx;
    const holeBottom = h - spread + shadow.dy;
    const holeRadius = Math.max(0, baseRadius - spread);

    // blur/offset spill 까지 덮는 외곽 rect (donut 의 solid 영역).
    const pad =
      Math.max(Math.abs(shadow.dx), Math.abs(shadow.dy)) +
      Math.max(shadow.sigmaX, shadow.sigmaY) * 3 +
      2;

    const path = new ck.Path();
    path.addRect(ck.LTRBRect(-pad, -pad, w + pad, h + pad));
    if (holeRadius > 0) {
      path.addRRect(
        ck.RRectXY(
          ck.LTRBRect(holeLeft, holeTop, holeRight, holeBottom),
          holeRadius,
          holeRadius,
        ),
      );
    } else {
      path.addRect(ck.LTRBRect(holeLeft, holeTop, holeRight, holeBottom));
    }
    path.setFillType(ck.FillType.EvenOdd);

    const paint = new ck.Paint();
    paint.setAntiAlias(true);
    paint.setColor(shadow.color);
    if (shadow.sigmaX > 0 || shadow.sigmaY > 0) {
      paint.setImageFilter(
        ck.ImageFilter.MakeBlur(
          shadow.sigmaX,
          shadow.sigmaY,
          ck.TileMode.Decal,
          null,
        ),
      );
    }

    canvas.save();
    // box 내부로 clip → 오프셋 donut 의 침입부(=inner edge shadow)만 남는다.
    if (baseRadius > 0) {
      canvas.clipRRect(
        ck.RRectXY(ck.LTRBRect(0, 0, w, h), baseRadius, baseRadius),
        ck.ClipOp.Intersect,
        true,
      );
    } else {
      canvas.clipRect(ck.LTRBRect(0, 0, w, h), ck.ClipOp.Intersect, true);
    }
    canvas.drawPath(path, paint);
    canvas.restore();

    path.delete();
    paint.delete();
  }
}

export function renderBox(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
): void {
  if (!node.box) return;

  const scope = new SkiaDisposable();
  try {
    // G1+G2: box-shadow는 fill 아래에 렌더 (CSS 스펙: shadow → background → border)
    renderBoxShadows(ck, canvas, node);

    const paint = scope.track(new ck.Paint());
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Fill);

    let fillShader: { delete(): void } | null = null;
    if (node.box.fill) {
      fillShader = applyFill(ck, paint, node.box.fill);
      if (!fillShader) {
        paint.setColor(node.box.fillColor);
      }
    } else {
      paint.setColor(node.box.fillColor);
    }

    const rect = ck.LTRBRect(0, 0, node.width, node.height);
    const br = node.box.borderRadius;
    const isArrayRadius = Array.isArray(br);
    const hasRadius = isArrayRadius ? br.some((r) => r > 0) : br > 0;

    if (hasRadius) {
      if (isArrayRadius) {
        const path = createRoundRectPath(ck, 0, 0, node.width, node.height, br);
        canvas.drawPath(path, paint);
        path.delete();
      } else {
        const rrect = ck.RRectXY(rect, br, br);
        canvas.drawRRect(rrect, paint);
      }
    } else {
      canvas.drawRect(rect, paint);
    }

    if (fillShader) {
      paint.setShader(null);
      fillShader.delete();
    }

    // inset(inner) box-shadow: fill 위 · content(자식)/border 아래, box 내부 clip (CSS 대칭).
    renderInnerBoxShadows(ck, canvas, node);

    if (
      node.box.strokeColor &&
      node.box.strokeWidth &&
      node.box.strokeColor[3] > 0
    ) {
      const sw = node.box.strokeWidth;
      const strokeStyle = node.box.strokeStyle;
      paint.setShader(null);

      if (strokeStyle === "double") {
        renderDoubleBorder(
          ck,
          canvas,
          node,
          paint,
          sw,
          br,
          hasRadius,
          isArrayRadius,
        );
      } else if (strokeStyle === "groove" || strokeStyle === "ridge") {
        renderGrooveRidgeBorder(
          ck,
          canvas,
          node,
          paint,
          sw,
          br,
          hasRadius,
          isArrayRadius,
          strokeStyle,
        );
      } else if (strokeStyle === "inset" || strokeStyle === "outset") {
        renderInsetOutsetBorder(
          ck,
          canvas,
          node,
          paint,
          sw,
          br,
          hasRadius,
          isArrayRadius,
          strokeStyle,
        );
      } else {
        renderSolidBorder(
          ck,
          canvas,
          node,
          paint,
          sw,
          br,
          hasRadius,
          isArrayRadius,
          strokeStyle,
        );
      }
    }

    if (
      node.box.outlineColor &&
      node.box.outlineWidth &&
      node.box.outlineWidth > 0 &&
      node.box.outlineColor[3] > 0
    ) {
      const ow = node.box.outlineWidth;
      const oo = node.box.outlineOffset ?? 0;
      const expansion = oo + ow / 2;
      const ox = -expansion;
      const oy = -expansion;
      const ow2 = node.width + expansion * 2;
      const oh2 = node.height + expansion * 2;

      const outlinePaint = scope.track(new ck.Paint());
      outlinePaint.setAntiAlias(true);
      outlinePaint.setStyle(ck.PaintStyle.Stroke);
      outlinePaint.setStrokeWidth(ow);
      outlinePaint.setColor(node.box.outlineColor);

      const outlineRadius = node.box.borderRadius;
      const isArrayBr = Array.isArray(outlineRadius);
      const hasBr = isArrayBr
        ? outlineRadius.some((r) => r > 0)
        : outlineRadius > 0;

      if (hasBr) {
        if (isArrayBr) {
          const radii = outlineRadius as [number, number, number, number];
          const expanded: [number, number, number, number] = [
            Math.max(0, radii[0] + oo),
            Math.max(0, radii[1] + oo),
            Math.max(0, radii[2] + oo),
            Math.max(0, radii[3] + oo),
          ];
          const path = createRoundRectPath(ck, ox, oy, ow2, oh2, expanded);
          canvas.drawPath(path, outlinePaint);
          path.delete();
        } else {
          const expandedR = Math.max(0, (outlineRadius as number) + oo);
          const outlineRect = ck.LTRBRect(ox, oy, ox + ow2, oy + oh2);
          canvas.drawRRect(
            ck.RRectXY(outlineRect, expandedR, expandedR),
            outlinePaint,
          );
        }
      } else {
        canvas.drawRect(ck.LTRBRect(ox, oy, ox + ow2, oy + oh2), outlinePaint);
      }
    }

    if (node.arc && node.arc.strokeColor[3] > 0) {
      const arcPaint = new ck.Paint();
      arcPaint.setAntiAlias(true);
      arcPaint.setStyle(ck.PaintStyle.Stroke);
      arcPaint.setStrokeWidth(node.arc.strokeWidth);
      arcPaint.setColor(node.arc.strokeColor);

      if (node.arc.strokeCap === "round") {
        arcPaint.setStrokeCap(ck.StrokeCap.Round);
      } else if (node.arc.strokeCap === "square") {
        arcPaint.setStrokeCap(ck.StrokeCap.Square);
      } else {
        arcPaint.setStrokeCap(ck.StrokeCap.Butt);
      }

      const { cx, cy, radius, startAngle, sweepAngle } = node.arc;
      const arcPath = new ck.Path();
      const oval = ck.LTRBRect(
        cx - radius,
        cy - radius,
        cx + radius,
        cy + radius,
      );
      arcPath.addArc(oval, startAngle, sweepAngle);
      canvas.drawPath(arcPath, arcPaint);

      arcPath.delete();
      arcPaint.delete();
    }
  } finally {
    scope.dispose();
  }
}
