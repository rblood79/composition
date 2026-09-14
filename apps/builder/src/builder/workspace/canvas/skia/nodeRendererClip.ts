import type { CanvasKit, Path } from "canvaskit-wasm";
import type { ClipPathShape } from "../styleConversion/styleConverter";
import { buildPath } from "./buildPath";
import {
  resolveCssCornerRadii,
  type CornerRadii,
} from "../styleConversion/borderGeometry";
import type { SkiaNodeData } from "./nodeRendererTypes";

export function sortByStackingOrder(children: SkiaNodeData[]): SkiaNodeData[] {
  const indexed = children.map((child, i) => ({ child, originalIndex: i }));
  indexed.sort((a, b) => {
    const zA = a.child.zIndex ?? 0;
    const zB = b.child.zIndex ?? 0;
    if (zA !== zB) return zA - zB;
    return a.originalIndex - b.originalIndex;
  });
  return indexed.map((item) => item.child);
}

/**
 * CanvasKit 12-float rrect `[L, T, R, B, tlx, tly, trx, try, brx, bry, blx, bly]`.
 *
 * `ck.RRectXY` 는 균일 반경만 받는다 — 코너별·타원 반경은 이 형태로 `addRRect` /
 * `drawRRect` 에 넘긴다 (ADR-219, 반경은 `resolveCssCornerRadii` 를 거친 값이어야 한다).
 */
export function rrectFromRadii(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: readonly [number, number, number, number],
  ry: readonly [number, number, number, number] = rx,
): Float32Array {
  return Float32Array.of(
    x,
    y,
    x + width,
    y + height,
    rx[0],
    ry[0],
    rx[1],
    ry[1],
    rx[2],
    ry[2],
    rx[3],
    ry[3],
  );
}

export function createRoundRectPath(
  ck: CanvasKit,
  x: number,
  y: number,
  width: number,
  height: number,
  radii: [number, number, number, number],
): Path {
  // ADR-219 — 코너 축소는 CSS §4.5 비례 규칙 (균일 반경은 종전 min(w,h)/2 와 같은 값)
  const [rTL, rTR, rBR, rBL] = resolveCssCornerRadii(radii, width, height);

  return buildPath(ck, (path) => {
    path.moveTo(x + rTL, y);
    path.lineTo(x + width - rTR, y);

    if (rTR > 0) {
      path.arcToTangent(x + width, y, x + width, y + rTR, rTR);
    } else {
      path.lineTo(x + width, y);
    }

    path.lineTo(x + width, y + height - rBR);

    if (rBR > 0) {
      path.arcToTangent(
        x + width,
        y + height,
        x + width - rBR,
        y + height,
        rBR,
      );
    } else {
      path.lineTo(x + width, y + height);
    }

    path.lineTo(x + rBL, y + height);

    if (rBL > 0) {
      path.arcToTangent(x, y + height, x, y + height - rBL, rBL);
    } else {
      path.lineTo(x, y + height);
    }

    path.lineTo(x, y + rTL);

    if (rTL > 0) {
      path.arcToTangent(x, y, x + rTL, y, rTL);
    } else {
      path.lineTo(x, y);
    }

    path.close();
  });
}

export function buildClipPath(
  ck: CanvasKit,
  shape: ClipPathShape,
  width: number,
  height: number,
): Path | null {
  switch (shape.type) {
    case "inset": {
      const { top, right, bottom, left, borderRadius } = shape;
      const x = left;
      const y = top;
      const w = width - left - right;
      const h = height - top - bottom;
      if (w <= 0 || h <= 0) return null;
      return buildPath(ck, (path) => {
        if (typeof borderRadius === "number") {
          if (borderRadius > 0) {
            const r = Math.min(borderRadius, Math.min(w, h) / 2);
            const rrect = ck.RRectXY(ck.LTRBRect(x, y, x + w, y + h), r, r);
            path.addRRect(rrect);
          } else {
            path.addRect(ck.LTRBRect(x, y, x + w, y + h));
          }
          return;
        }
        // ADR-219 — `round <tl> <tr> <br> <bl>` 4 반경 (CSS §4.5 축소)
        const radii: CornerRadii = resolveCssCornerRadii(borderRadius, w, h);
        if (radii.some((r) => r > 0)) {
          path.addRRect(rrectFromRadii(x, y, w, h, radii));
        } else {
          path.addRect(ck.LTRBRect(x, y, x + w, y + h));
        }
      });
    }
    case "circle": {
      const { radius, cx, cy } = shape;
      return buildPath(ck, (path) => {
        path.addCircle(cx, cy, radius);
      });
    }
    case "ellipse": {
      const { rx, ry, cx, cy } = shape;
      return buildPath(ck, (path) => {
        path.addOval(ck.LTRBRect(cx - rx, cy - ry, cx + rx, cy + ry));
      });
    }
    case "polygon": {
      const { points } = shape;
      if (points.length < 3) return null;
      return buildPath(ck, (path) => {
        path.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
          path.lineTo(points[i].x, points[i].y);
        }
        path.close();
      });
    }
    default:
      return null;
  }
}
