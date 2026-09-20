/**
 * Skia 호버 하이라이트 렌더러
 *
 * 마우스 오버 시 요소 테두리를 CanvasKit으로 렌더링한다.
 * selectionRenderer.ts와 동일한 패턴(순수 함수 + SkiaDisposable).
 * 카메라 변환(translate + scale) 내부에서 씬-로컬 좌표로 호출된다.
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";
import { SkiaDisposable } from "./disposable";
import { acquireScopedPaint } from "./paints";
import type { BoundingBox } from "../selection/types";
import type { EditingSemanticsRole } from "../../../utils/editingSemantics";
import type {
  OverflowContentInfo,
  ChildOverflowContext,
} from "./skiaFrameHelpers";
import { HATCH_ALPHA, drawDiagonalHatch } from "./hatchPattern";
import {
  getSemanticOverlayColor,
  OVERLAY_BLUE_R,
  OVERLAY_BLUE_G,
  OVERLAY_BLUE_B,
} from "./semanticOverlayColors";

const HOVER_ALPHA = 0.5;

// ============================================
// Constants — overflow content (blue-500, 낮은 alpha)
// ============================================

const OVERFLOW_FILL_ALPHA = 0.08;
const OVERFLOW_STROKE_ALPHA = 0.25;

// ============================================
// Constants — editingContext 경계 (gray-400, alpha 0.3)
// ============================================

const CONTEXT_R = 0x9c / 255;
const CONTEXT_G = 0xa3 / 255;
const CONTEXT_B = 0xaf / 255;
const CONTEXT_ALPHA = 0.3;

// ============================================
// Hover Highlight
// ============================================

/**
 * bounds 테두리를 1회 stroke 하는 공통 루틴.
 *
 * dash 는 WASM 객체라 paint 를 풀에 돌려주기 전에 떼고 지워야 한다 —
 * 그 수명 처리를 한 곳에 가둬 오버레이가 늘어도 반복되지 않게 한다.
 * (selectionRenderer 의 선택 박스도 같은 루틴을 쓴다)
 */
export function strokeBoundsRect(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: BoundingBox,
  color: Float32Array,
  strokeWidth: number,
  dashIntervals: number[] | null,
): void {
  const scope = new SkiaDisposable();
  let dashEffect: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
  try {
    const paint = acquireScopedPaint(scope, ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(strokeWidth);
    paint.setColor(color);

    if (dashIntervals) {
      dashEffect = ck.PathEffect.MakeDash(dashIntervals);
      paint.setPathEffect(dashEffect);
    }

    canvas.drawRect(
      ck.LTRBRect(
        bounds.x,
        bounds.y,
        bounds.x + bounds.width,
        bounds.y + bounds.height,
      ),
      paint,
    );
  } finally {
    dashEffect?.delete();
    scope.dispose();
  }
}

/**
 * 호버 요소의 테두리를 CanvasKit으로 렌더링한다.
 *
 * 씬-로컬 좌표계에서 호출. strokeWidth = 1/zoom으로 화면상 1px 유지.
 * dashed=true이면 그룹 내부 리프 노드 스타일 (점선).
 */
export function renderHoverHighlight(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: BoundingBox,
  zoom: number,
  dashed = false,
  semanticRole: EditingSemanticsRole | null = null,
): void {
  strokeBoundsRect(
    ck,
    canvas,
    bounds,
    getSemanticOverlayColor(ck, semanticRole, HOVER_ALPHA),
    (dashed ? 1 : 2) / zoom,
    dashed ? [4 / zoom, 3 / zoom] : null,
  );
}

// ============================================
// Overflow Content (Figma-style)
// ============================================

/**
 * overflow 컨테이너 밖으로 벗어난 자식 영역을 반투명으로 렌더링한다.
 *
 * 컨테이너 내부는 클리핑(Difference)하여 컨테이너 밖 영역만 표시한다.
 * 씬-로컬 좌표계에서 호출. strokeWidth = 1/zoom으로 화면상 1px 유지.
 */
export function renderOverflowContent(
  ck: CanvasKit,
  canvas: Canvas,
  info: OverflowContentInfo,
  zoom: number,
): void {
  const scope = new SkiaDisposable();
  try {
    const { containerBounds: c, overflowChildren } = info;

    // 컨테이너 내부를 제외한 영역에만 렌더 (Difference clipping)
    canvas.save();
    const clipRect = ck.LTRBRect(c.x, c.y, c.x + c.width, c.y + c.height);
    canvas.clipRect(clipRect, ck.ClipOp.Difference, true);

    const fillPaint = acquireScopedPaint(scope, ck);
    fillPaint.setAntiAlias(true);
    fillPaint.setStyle(ck.PaintStyle.Fill);
    fillPaint.setColor(
      ck.Color4f(
        OVERLAY_BLUE_R,
        OVERLAY_BLUE_G,
        OVERLAY_BLUE_B,
        OVERFLOW_FILL_ALPHA,
      ),
    );

    const strokePaint = acquireScopedPaint(scope, ck);
    strokePaint.setAntiAlias(true);
    strokePaint.setStyle(ck.PaintStyle.Stroke);
    strokePaint.setStrokeWidth(1 / zoom);
    strokePaint.setColor(
      ck.Color4f(
        OVERLAY_BLUE_R,
        OVERLAY_BLUE_G,
        OVERLAY_BLUE_B,
        OVERFLOW_STROKE_ALPHA,
      ),
    );

    for (const child of overflowChildren) {
      const { bounds: b } = child;
      const rect = ck.LTRBRect(b.x, b.y, b.x + b.width, b.y + b.height);
      canvas.drawRect(rect, fillPaint);
      canvas.drawRect(rect, strokePaint);
    }

    canvas.restore();
  } finally {
    scope.dispose();
  }
}

// ============================================
// Overflow Hatching Pattern (scroll/auto 선택 시)
// ============================================

/**
 * 선택된 자식 요소가 scroll/auto 부모의 경계를 벗어날 때 해칭 패턴 표시.
 * 자식 bounds에서 부모 컨테이너 밖 영역에만 45도 사선 렌더링.
 */
export function renderOverflowHatching(
  ck: CanvasKit,
  canvas: Canvas,
  ctx: ChildOverflowContext,
  zoom: number,
): void {
  const scope = new SkiaDisposable();
  try {
    const { containerBounds: c, childBounds: cb } = ctx;

    // 부모 컨테이너 밖 영역만 (Difference clipping)
    canvas.save();
    const containerRect = ck.LTRBRect(c.x, c.y, c.x + c.width, c.y + c.height);
    canvas.clipRect(containerRect, ck.ClipOp.Difference, true);

    // 자식 bounds 안 — 사선 패턴은 padding·gap hover · slot 마커와 한 정본 (`hatchPattern.ts`).
    drawDiagonalHatch(
      ck,
      canvas,
      cb,
      ck.Color4f(OVERLAY_BLUE_R, OVERLAY_BLUE_G, OVERLAY_BLUE_B, HATCH_ALPHA),
      zoom,
    );

    canvas.restore();
  } finally {
    scope.dispose();
  }
}

// ============================================
// Editing Context Border
// ============================================

/**
 * editingContext(그룹 편집 모드)의 경계를 점선으로 렌더링한다.
 *
 * 씬-로컬 좌표계에서 호출. strokeWidth = 1/zoom으로 화면상 1px 유지.
 */
export function renderEditingContextBorder(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: BoundingBox,
  zoom: number,
): void {
  strokeBoundsRect(
    ck,
    canvas,
    bounds,
    ck.Color4f(CONTEXT_R, CONTEXT_G, CONTEXT_B, CONTEXT_ALPHA),
    1 / zoom,
    [6 / zoom, 4 / zoom],
  );
}
