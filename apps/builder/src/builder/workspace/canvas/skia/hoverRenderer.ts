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
  const scope = new SkiaDisposable();
  let dashEffect: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
  try {
    const sw = dashed ? 1 / zoom : 2 / zoom;
    const paint = acquireScopedPaint(scope, ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(sw);
    paint.setColor(getSemanticOverlayColor(ck, semanticRole, HOVER_ALPHA));

    if (dashed) {
      dashEffect = ck.PathEffect.MakeDash([4 / zoom, 3 / zoom]);
      paint.setPathEffect(dashEffect);
    }

    const rect = ck.LTRBRect(
      bounds.x,
      bounds.y,
      bounds.x + bounds.width,
      bounds.y + bounds.height,
    );

    canvas.drawRect(rect, paint);
  } finally {
    dashEffect?.delete();
    scope.dispose();
  }
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

const HATCHING_ALPHA = 0.35;
const HATCHING_LINE_SPACING = 6; // 화면 px 간격
const MAX_HATCHING_LINES = 200; // GPU 과부하 방지 상한

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

    // 자식 bounds 내로 추가 클리핑
    const childRect = ck.LTRBRect(
      cb.x,
      cb.y,
      cb.x + cb.width,
      cb.y + cb.height,
    );
    canvas.clipRect(childRect, ck.ClipOp.Intersect, true);

    // 대각선 45도 해칭 라인
    const paint = acquireScopedPaint(scope, ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(1.5 / zoom);
    // --focus-ring 토큰 색상 (blue-500 = #3b82f6)
    paint.setColor(
      ck.Color4f(
        OVERLAY_BLUE_R,
        OVERLAY_BLUE_G,
        OVERLAY_BLUE_B,
        HATCHING_ALPHA,
      ),
    );

    const spacing = HATCHING_LINE_SPACING / zoom;
    const left = cb.x;
    const top = cb.y;
    const right = cb.x + cb.width;
    const bottom = cb.y + cb.height;
    const totalSpan = right - left + (bottom - top);

    // 라인 수 상한 — 큰 요소에서 GPU 과부하 방지
    const effectiveSpacing =
      totalSpan / spacing > MAX_HATCHING_LINES
        ? totalSpan / MAX_HATCHING_LINES
        : spacing;

    const path = scope.track(new ck.Path());
    for (let d = -(bottom - top); d < right - left; d += effectiveSpacing) {
      // 우하향(\) 45도 대각선
      const x0 = left + d;
      const y0 = top;
      const x1 = left + d + (bottom - top);
      const y1 = bottom;
      path.moveTo(x0, y0);
      path.lineTo(x1, y1);
    }
    canvas.drawPath(path, paint);

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
  const scope = new SkiaDisposable();
  let dashEffect: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
  try {
    const sw = 1 / zoom;
    const paint = acquireScopedPaint(scope, ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(sw);
    paint.setColor(ck.Color4f(CONTEXT_R, CONTEXT_G, CONTEXT_B, CONTEXT_ALPHA));

    dashEffect = ck.PathEffect.MakeDash([6 / zoom, 4 / zoom]);
    paint.setPathEffect(dashEffect);

    const rect = ck.LTRBRect(
      bounds.x,
      bounds.y,
      bounds.x + bounds.width,
      bounds.y + bounds.height,
    );
    canvas.drawRect(rect, paint);
  } finally {
    dashEffect?.delete();
    scope.dispose();
  }
}
