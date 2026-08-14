import type { CanvasKit, Canvas, FontMgr } from "canvaskit-wasm";
import type { EditingSemanticsRole } from "../../../utils/editingSemantics";
import type { BoundingBox } from "../selection/types";
import { SkiaDisposable } from "./disposable";
import { acquireScopedPaint } from "./paints";
import { getSemanticOverlayColor } from "./semanticOverlayColors";
import {
  acquireOverlayFont,
  measureGlyphRunWidth,
} from "./selectionRenderer";

const SLOT_HATCH_ALPHA = 0.42;
const SLOT_HATCH_SPACING = 7;
const SLOT_HATCH_MAX_LINES = 180;
const SLOT_BORDER_ALPHA = 0.95;

export function renderSlotHatchPattern(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: BoundingBox,
  zoom: number,
  role: EditingSemanticsRole | null,
  showHatch = true,
): void {
  if (bounds.width <= 0 || bounds.height <= 0) return;

  const scope = new SkiaDisposable();
  try {
    const rect = ck.LTRBRect(
      bounds.x,
      bounds.y,
      bounds.x + bounds.width,
      bounds.y + bounds.height,
    );

    if (showHatch) {
      canvas.save();
      canvas.clipRect(rect, ck.ClipOp.Intersect, true);

      const paint = acquireScopedPaint(scope, ck);
      paint.setAntiAlias(true);
      paint.setStyle(ck.PaintStyle.Stroke);
      paint.setStrokeWidth(1.5 / zoom);
      paint.setColor(getSemanticOverlayColor(ck, role, SLOT_HATCH_ALPHA));

      const spacing = SLOT_HATCH_SPACING / zoom;
      const totalSpan = bounds.width + bounds.height;
      const effectiveSpacing =
        totalSpan / spacing > SLOT_HATCH_MAX_LINES
          ? totalSpan / SLOT_HATCH_MAX_LINES
          : spacing;

      const path = scope.track(new ck.Path());
      for (let d = -bounds.height; d < bounds.width; d += effectiveSpacing) {
        const x0 = bounds.x + d;
        const y0 = bounds.y;
        const x1 = bounds.x + d + bounds.height;
        const y1 = bounds.y + bounds.height;
        path.moveTo(x0, y0);
        path.lineTo(x1, y1);
      }

      canvas.drawPath(path, paint);
      canvas.restore();
    }

    const borderPaint = acquireScopedPaint(scope, ck);
    borderPaint.setAntiAlias(true);
    borderPaint.setStyle(ck.PaintStyle.Stroke);
    borderPaint.setStrokeWidth(1.5 / zoom);
    borderPaint.setColor(getSemanticOverlayColor(ck, role, SLOT_BORDER_ALPHA));
    canvas.drawRect(rect, borderPaint);
  } finally {
    scope.dispose();
  }
}

const REMAINDER_LABEL_FONT_SIZE = 12;
const REMAINDER_LABEL_ALPHA = 0.95;

/**
 * ADR-157: data-bound collection 샘플 window 밖 나머지 영역 마커 — 사선 hatch(+border) 위에
 * "+N more" 라벨(줌 독립 고정 폰트). hatch 는 slot marker 와 동일 시각 언어(빌더 저작 보조 시각,
 * D3 대칭 비대상)이며 role=null(중립 blue). Preview/Publish 는 실데이터를 그대로 렌더한다.
 */
export function renderCollectionRemainderMarker(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: BoundingBox,
  hiddenRows: number,
  zoom: number,
  fontMgr?: FontMgr,
): void {
  if (bounds.width <= 0 || bounds.height <= 0) return;
  // 사선 hatch + 테두리 (slot marker 동형, role=null → 중립 blue).
  renderSlotHatchPattern(ck, canvas, bounds, zoom, null, true);
  if (!fontMgr || hiddenRows <= 0) return;

  const label = `+${hiddenRows} more`;
  const scope = new SkiaDisposable();
  try {
    // 캐시 소유 Font — scope.track 금지 (acquireOverlayFont 주석 참조).
    const font = acquireOverlayFont(
      ck,
      fontMgr,
      ck.FontWeight.Medium,
      REMAINDER_LABEL_FONT_SIZE,
    );
    if (!font) return;

    const paint = acquireScopedPaint(scope, ck);
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Fill);
    paint.setColor(getSemanticOverlayColor(ck, null, REMAINDER_LABEL_ALPHA));

    const textWidth = measureGlyphRunWidth(font, label);

    // 나머지 영역 중앙에 줌 독립 고정 폰트로 배치 (scene 좌표 → invZoom 스케일 후 screen px).
    const invZoom = 1 / zoom;
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    canvas.save();
    canvas.translate(centerX, centerY);
    canvas.scale(invZoom, invZoom);
    canvas.drawText(
      label,
      -textWidth / 2,
      REMAINDER_LABEL_FONT_SIZE * 0.35,
      paint,
      font,
    );
    canvas.restore();
  } finally {
    scope.dispose();
  }
}
