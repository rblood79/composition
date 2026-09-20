/**
 * 빌더 저작 보조 사선 (hatch) — **한 패턴**.
 *
 * padding·gap hover 띠 (ADR-222) · 빈 slot 마커 · collection 나머지 (ADR-157) · overflow 영역이
 * 각각 자기 상수 (간격 4/7/6 · 굵기 1/1.5/1.5 · alpha 0.35/0.42/0.35) 로 같은 45° 사선을 따로 그려
 * 한 화면에 세 가지 결이 섞였다 (사용자 지적 2026-09-20 — slot 과 padding 의 패턴이 다르다).
 * 여기 하나로 통일한다: 색 (의미) 만 호출부가 정하고 간격·굵기·alpha·상한은 공통이다.
 * 기준값은 ADR-222 breakdown §1.2 의 사선 간격 4 화면 px (가장 나중에 사용자 live 확인).
 */
import type { CanvasKit, Canvas } from "canvaskit-wasm";
import type { BoundingBox } from "../selection/types";
import { buildPath } from "./buildPath";
import { SkiaDisposable } from "./disposable";
import { acquireScopedPaint } from "./paints";

/** 사선 간격 (화면 px) */
export const HATCH_SPACING_PX = 4;
/** 사선 굵기 (화면 px) */
export const HATCH_STROKE_PX = 1;
/** 사선 alpha — 호출부 색에 곱한다 */
export const HATCH_ALPHA = 0.35;
/** 큰 영역의 GPU 상한 — 넘으면 간격을 늘려 줄 수를 고정한다 */
export const HATCH_MAX_LINES = 400;

/**
 * `rect` (scene 좌표) 안에 우하향 (\) 45° 사선을 채운다. clip 은 rect ∩ 현재 clip — 호출부가
 * 더 좁은 clip (가시 영역 · Difference) 을 먼저 걸어도 된다. 색은 `Float32Array` Color4f (alpha 포함).
 */
export function drawDiagonalHatch(
  ck: CanvasKit,
  canvas: Canvas,
  rect: BoundingBox,
  color: Float32Array,
  zoom: number,
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const scope = new SkiaDisposable();
  try {
    canvas.save();
    canvas.clipRect(
      ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height),
      ck.ClipOp.Intersect,
      true,
    );
    const paint = acquireScopedPaint(scope, ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(HATCH_STROKE_PX / zoom);
    paint.setColor(color);
    const spacing = HATCH_SPACING_PX / zoom;
    const span = rect.width + rect.height;
    const step =
      span / spacing > HATCH_MAX_LINES ? span / HATCH_MAX_LINES : spacing;
    const path = scope.track(
      buildPath(ck, (sink) => {
        for (let d = -rect.height; d < rect.width; d += step) {
          sink.moveTo(rect.x + d, rect.y);
          sink.lineTo(rect.x + d + rect.height, rect.y + rect.height);
        }
      }),
    );
    canvas.drawPath(path, paint);
    canvas.restore();
  } finally {
    scope.dispose();
  }
}
