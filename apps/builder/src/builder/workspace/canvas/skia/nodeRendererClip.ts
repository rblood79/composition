import type { CanvasKit } from "canvaskit-wasm";
import type { ClipPathShape } from "../sprites/styleConverter";
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
 * 코너 반경 4개를 `[0, min(w,h)/2]` 로 clamp 한다.
 *
 * 이 상한을 넘기면 `arcToTangent` 가 퇴화 경로를 만든다 — clip 경로와
 * partial border 경로가 같은 기하 규칙을 쓰도록 한 곳에 둔다.
 */
export function clampCornerRadii(
  radii: readonly [number, number, number, number],
  width: number,
  height: number,
): [number, number, number, number] {
  const maxRadius = Math.min(width, height) / 2;
  const clamp = (r: number) => Math.min(Math.max(0, r), maxRadius);
  return [clamp(radii[0]), clamp(radii[1]), clamp(radii[2]), clamp(radii[3])];
}

export function createRoundRectPath(
  ck: CanvasKit,
  x: number,
  y: number,
  width: number,
  height: number,
  radii: [number, number, number, number],
): ReturnType<CanvasKit["Path"]["prototype"]["constructor"]> {
  const [rTL, rTR, rBR, rBL] = clampCornerRadii(radii, width, height);

  const path = new ck.Path();
  path.moveTo(x + rTL, y);
  path.lineTo(x + width - rTR, y);

  if (rTR > 0) {
    path.arcToTangent(x + width, y, x + width, y + rTR, rTR);
  } else {
    path.lineTo(x + width, y);
  }

  path.lineTo(x + width, y + height - rBR);

  if (rBR > 0) {
    path.arcToTangent(x + width, y + height, x + width - rBR, y + height, rBR);
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
  return path;
}

export function buildClipPath(
  ck: CanvasKit,
  shape: ClipPathShape,
  width: number,
  height: number,
): ReturnType<CanvasKit["Path"]["prototype"]["constructor"]> | null {
  switch (shape.type) {
    case "inset": {
      const { top, right, bottom, left, borderRadius } = shape;
      const x = left;
      const y = top;
      const w = width - left - right;
      const h = height - top - bottom;
      if (w <= 0 || h <= 0) return null;
      const path = new ck.Path();
      if (borderRadius > 0) {
        const r = Math.min(borderRadius, Math.min(w, h) / 2);
        const rrect = ck.RRectXY(ck.LTRBRect(x, y, x + w, y + h), r, r);
        path.addRRect(rrect);
      } else {
        path.addRect(ck.LTRBRect(x, y, x + w, y + h));
      }
      return path;
    }
    case "circle": {
      const { radius, cx, cy } = shape;
      const path = new ck.Path();
      path.addCircle(cx, cy, radius);
      return path;
    }
    case "ellipse": {
      const { rx, ry, cx, cy } = shape;
      const path = new ck.Path();
      path.addOval(ck.LTRBRect(cx - rx, cy - ry, cx + rx, cy + ry));
      return path;
    }
    case "polygon": {
      const { points } = shape;
      if (points.length < 3) return null;
      const path = new ck.Path();
      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i].x, points[i].y);
      }
      path.close();
      return path;
    }
    default:
      return null;
  }
}
