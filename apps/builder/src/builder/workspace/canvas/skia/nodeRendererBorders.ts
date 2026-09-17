import type { CanvasKit, Canvas, Paint } from "canvaskit-wasm";
import { colord } from "colord";
import { buildPath } from "./buildPath";
import { applyFill } from "./fills";
import { SkiaDisposable } from "./disposable";
import {
  acquirePooledPaint,
  acquireScopedPaint,
  releasePooledPaint,
} from "./paints";
import { createRoundRectPath, rrectFromRadii } from "./nodeRendererClip";
import {
  cssDashPattern,
  renderSidedStroke,
  roundRectPerimeter,
} from "./nodeRendererShapes";
import type { SkiaNodeData } from "./nodeRendererTypes";
import {
  resolveCssCornerRadii,
  resolveInnerCornerRadii,
} from "../styleConversion/borderGeometry";
import type { DropShadowEffect, FillStyle } from "./types";

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

  if (strokeStyle === "dashed" || strokeStyle === "dotted") {
    // Chrome 실측 패턴 + 둘레 맞춤 (cssDashPattern) — ADR-219 G2 대조군 0.040 의 병인이
    //   종전 고정식 `[3w,2w]`/`[w,1.5w]` 와 rrect 시작점 위상. 경로는 TL 호 끝에서 시작하는
    //   createRoundRectPath 하나 (dash 위상 기준), solid 는 아래 종전 경로 그대로 (HC1).
    const radii: [number, number, number, number] = isArrayRadius
      ? (br as [number, number, number, number])
      : [br as number, br as number, br as number, br as number];
    const outer = resolveCssCornerRadii(radii, node.width, node.height);
    const center: [number, number, number, number] = [
      Math.max(0, outer[0] - inset),
      Math.max(0, outer[1] - inset),
      Math.max(0, outer[2] - inset),
      Math.max(0, outer[3] - inset),
    ];
    const cw = node.width - sw;
    const ch = node.height - sw;
    const dashEffect = ck.PathEffect.MakeDash(
      cssDashPattern(strokeStyle, sw, roundRectPerimeter(cw, ch, center)),
    );
    paint.setPathEffect(dashEffect);
    if (strokeStyle === "dotted") paint.setStrokeCap(ck.StrokeCap.Round);
    const path = createRoundRectPath(ck, inset, inset, cw, ch, center);
    canvas.drawPath(path, paint);
    path.delete();
    paint.setPathEffect(null);
    dashEffect.delete();
    return;
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
}

/**
 * ADR-219 — 비균일 폭 + solid: 바깥 rrect − 안쪽 rrect 를 even-odd 로 채운다 (Chrome
 * `BoxBorderPainter` 의 double-rrect 경로). 안쪽 코너는 타원 (`rx = r − 세로변 폭`,
 * `ry = r − 가로변 폭`) 이라 폭 0 변 쪽 코너 띠가 가늘어지고, 한 번에 칠하므로 반투명
 * 코너 겹침이 없다. double/groove/ridge/inset/outset 은 지원 밖이라 이 경로로 강등.
 */
function renderSidedSolidBorder(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  paint: SkiaPaint,
  widths: [number, number, number, number],
  br: BorderRadius,
): void {
  const strokeColor = node.box!.strokeColor!;
  if (strokeColor[3] <= 0) return;
  const w = node.width;
  const h = node.height;
  const outer = resolveCssCornerRadii(
    Array.isArray(br) ? br : [br, br, br, br],
    w,
    h,
  );
  const inner = resolveInnerCornerRadii(outer, widths);
  const [wt, wr, wb, wl] = widths;

  paint.setStyle(ck.PaintStyle.Fill);
  paint.setColor(strokeColor);
  const path = buildPath(ck, (path) => {
    path.addRRect(rrectFromRadii(0, 0, w, h, outer));
    const iw = w - wl - wr;
    const ih = h - wt - wb;
    if (iw > 0 && ih > 0) {
      path.addRRect(rrectFromRadii(wl, wt, iw, ih, inner.rx, inner.ry));
    }
    path.setFillType(ck.FillType.EvenOdd);
  });
  canvas.drawPath(path, paint);
  path.delete();
}

/** ADR-219 — 비균일 폭 + dashed/dotted: 변마다 자기 폭의 stroke, 코너는 wedge 소유권 */
function renderSidedDashedBorder(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  widths: [number, number, number, number],
  br: BorderRadius,
  strokeStyle: "dashed" | "dotted",
): void {
  const strokeColor = node.box!.strokeColor!;
  if (strokeColor[3] <= 0) return;
  const w = node.width;
  const h = node.height;
  renderSidedStroke(ck, canvas, {
    x: 0,
    y: 0,
    width: w,
    height: h,
    radii: resolveCssCornerRadii(
      Array.isArray(br) ? br : [br, br, br, br],
      w,
      h,
    ),
    widths,
    color: strokeColor,
    // 균일 경로 (renderSolidBorder) 와 같은 Chrome 실측 dash 식 (둘레 맞춤)
    dashFor: (sw, len) => cssDashPattern(strokeStyle, sw, len),
    roundCap: strokeStyle === "dotted",
  });
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
  const tlClipPath = buildPath(ck, (path) => {
    path.moveTo(0, 0);
    path.lineTo(node.width, 0);
    path.lineTo(node.width - sw, sw);
    path.lineTo(sw, sw);
    path.lineTo(sw, node.height - sw);
    path.lineTo(0, node.height);
    path.close();
  });
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
  const brClipPath = buildPath(ck, (path) => {
    path.moveTo(node.width, node.height);
    path.lineTo(0, node.height);
    path.lineTo(sw, node.height - sw);
    path.lineTo(node.width - sw, node.height - sw);
    path.lineTo(node.width - sw, sw);
    path.lineTo(node.width, 0);
    path.close();
  });
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
  // ADR-219 — 배열 반경은 4 코너 그대로 (종전엔 첫 값만 읽었다)
  const cornerRadii = Array.isArray(br)
    ? resolveCssCornerRadii(br, node.width, node.height)
    : null;
  const baseRadius = typeof br === "number" ? br : 0;

  for (const shadow of node.box.shadows) {
    if (shadow.inner) continue; // outer shadow만 처리

    const spread = shadow.spread ?? 0;
    const shadowRect = ck.LTRBRect(
      -spread,
      -spread,
      node.width + spread,
      node.height + spread,
    );

    const paint = acquirePooledPaint(ck);
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
    if (cornerRadii) {
      const expanded = cornerRadii.map((r) =>
        r > 0 ? Math.max(0, r + spread) : 0,
      ) as [number, number, number, number];
      if (expanded.some((r) => r > 0)) {
        canvas.drawRRect(
          rrectFromRadii(
            -spread,
            -spread,
            node.width + spread * 2,
            node.height + spread * 2,
            expanded,
          ),
          paint,
        );
      } else {
        canvas.drawRect(shadowRect, paint);
      }
    } else {
      const shadowRadius = Math.max(0, baseRadius + spread);
      if (shadowRadius > 0) {
        canvas.drawRRect(
          ck.RRectXY(shadowRect, shadowRadius, shadowRadius),
          paint,
        );
      } else {
        canvas.drawRect(shadowRect, paint);
      }
    }

    releasePooledPaint(paint);
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
  // ADR-219 — 배열 반경은 4 코너 그대로 (종전엔 첫 값만 읽었다)
  const cornerRadii = Array.isArray(br)
    ? resolveCssCornerRadii(br, w, h)
    : null;
  const baseRadius = typeof br === "number" ? br : 0;

  for (const shadow of inner) {
    const spread = shadow.spread ?? 0;
    // 구멍 = box 내부를 spread 만큼 수축 후 dx/dy 오프셋. holeRadius 는 spread 만큼 축소.
    const holeLeft = spread + shadow.dx;
    const holeTop = spread + shadow.dy;
    const holeRight = w - spread + shadow.dx;
    const holeBottom = h - spread + shadow.dy;
    const holeRadius = Math.max(0, baseRadius - spread);
    const holeRadii = cornerRadii
      ? (cornerRadii.map((r) => Math.max(0, r - spread)) as [
          number,
          number,
          number,
          number,
        ])
      : null;

    // blur/offset spill 까지 덮는 외곽 rect (donut 의 solid 영역).
    const pad =
      Math.max(Math.abs(shadow.dx), Math.abs(shadow.dy)) +
      Math.max(shadow.sigmaX, shadow.sigmaY) * 3 +
      2;

    const path = buildPath(ck, (path) => {
      path.addRect(ck.LTRBRect(-pad, -pad, w + pad, h + pad));
      if (holeRadii && holeRadii.some((r) => r > 0)) {
        path.addRRect(
          rrectFromRadii(
            holeLeft,
            holeTop,
            holeRight - holeLeft,
            holeBottom - holeTop,
            holeRadii,
          ),
        );
      } else if (holeRadius > 0) {
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
    });

    const paint = acquirePooledPaint(ck);
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
    if (cornerRadii && cornerRadii.some((r) => r > 0)) {
      canvas.clipRRect(
        rrectFromRadii(0, 0, w, h, cornerRadii),
        ck.ClipOp.Intersect,
        true,
      );
    } else if (baseRadius > 0) {
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
    releasePooledPaint(paint);
  }
}

/** fill 층 하나 — shader 층은 applyFill, 못 만들거나 없으면 fillColor 단색 */
function paintBoxFill(
  ck: CanvasKit,
  canvas: Canvas,
  paint: Paint,
  rect: Float32Array,
  node: SkiaNodeData,
  layer: FillStyle | undefined,
): void {
  const box = node.box!;
  const shader = layer ? applyFill(ck, paint, layer) : null;
  if (!shader && layer?.type !== "color") paint.setColor(box.fillColor);

  const br = box.borderRadius;
  if (Array.isArray(br)) {
    if (br.some((r) => r > 0)) {
      const path = createRoundRectPath(ck, 0, 0, node.width, node.height, br);
      canvas.drawPath(path, paint);
      path.delete();
    } else {
      canvas.drawRect(rect, paint);
    }
  } else if (br > 0) {
    canvas.drawRRect(ck.RRectXY(rect, br, br), paint);
  } else {
    canvas.drawRect(rect, paint);
  }

  if (shader) {
    paint.setShader(null);
    shader.delete();
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

    const paint = acquireScopedPaint(scope, ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Fill);

    const rect = ck.LTRBRect(0, 0, node.width, node.height);
    const br = node.box.borderRadius;
    const isArrayRadius = Array.isArray(br);
    const hasRadius = isArrayRadius ? br.some((r) => r > 0) : br > 0;

    // 다층 fill — 아래 층 (아래 → 위) 을 같은 기하로 한 번씩 칠한 뒤 맨 위 층은 종전 단층
    //   채널 (box.fill shader 또는 fillColor) 로 (DOM background-image 층 쌓기 대칭).
    const underlays = node.box.fillUnderlays;
    if (underlays) {
      for (const layer of underlays) {
        paintBoxFill(ck, canvas, paint, rect, node, layer);
      }
    }
    paintBoxFill(ck, canvas, paint, rect, node, node.box.fill);

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

      const sided = node.box.strokeWidths;
      if (sided) {
        // ADR-219 — 비균일 폭. 균일 노드는 이 분기에 들어오지 않는다 (HC1).
        if (strokeStyle === "dashed" || strokeStyle === "dotted") {
          renderSidedDashedBorder(ck, canvas, node, sided, br, strokeStyle);
        } else {
          renderSidedSolidBorder(ck, canvas, node, paint, sided, br);
        }
      } else if (strokeStyle === "double") {
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

      const outlinePaint = acquireScopedPaint(scope, ck);
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
      const arcPaint = acquirePooledPaint(ck);
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
      const oval = ck.LTRBRect(
        cx - radius,
        cy - radius,
        cx + radius,
        cy + radius,
      );
      const arcPath = buildPath(ck, (path) => {
        path.addArc(oval, startAngle, sweepAngle);
      });
      canvas.drawPath(arcPath, arcPaint);

      arcPath.delete();
      releasePooledPaint(arcPaint);
    }
  } finally {
    scope.dispose();
  }
}
