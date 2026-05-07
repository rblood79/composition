/**
 * Skia Drop Indicator 렌더러
 *
 * 드래그 중 drop 대상 컨테이너의 아웃라인 + 삽입 위치 라인을
 * CanvasKit으로 렌더링한다.
 * Pencil eQ.render() 패턴 참조 (scenegraph.txt L932-976).
 * 카메라 변환(translate + scale) 내부에서 씬-로컬 좌표로 호출된다.
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";
import type { BoundingBox } from "../selection/types";

// blue-500 (#3b82f6) — same-parent reorder
const DROP_R = 0x3b / 255;
const DROP_G = 0x82 / 255;
const DROP_B = 0xf6 / 255;

// green-500 (#22c55e) — cross-container reparent
const REPARENT_R = 0x22 / 255;
const REPARENT_G = 0xc5 / 255;
const REPARENT_B = 0x5e / 255;

export interface DropIndicatorState {
  targetBounds: BoundingBox;
  insertIndex: number;
  childBounds: BoundingBox[];
  isHorizontal: boolean;
  isReparent?: boolean;
  /** 드래그 요소의 주축 크기 — 삽입 라인 위치를 animated gap 중앙으로 보정 */
  dragSize?: number;
  /** scene 좌표계의 실제 삽입 라인 위치. 있으면 child/container 추정보다 우선한다. */
  insertionLinePosition?: number;
  /** 드롭 시 드래그 요소가 차지할 scene 좌표계 placeholder box. */
  placeholderBounds?: BoundingBox;
}

/**
 * Drop indicator를 CanvasKit으로 렌더링한다.
 *
 * 1. 타겟 컨테이너 반투명 배경 오버레이 (alpha 0.06)
 * 2. 타겟 컨테이너 아웃라인 (2/zoom 두께, blue-500, alpha 0.8)
 * 3. 삽입 위치 solid line (2/zoom 두께, 양끝 원형 캡)
 */
export function renderDropIndicator(
  ck: CanvasKit,
  canvas: Canvas,
  state: DropIndicatorState,
  zoom: number,
): void {
  const { targetBounds, insertIndex, childBounds, isHorizontal } = state;

  // reparent 여부에 따라 색상 선택 (green-500 vs blue-500)
  const R = state.isReparent ? REPARENT_R : DROP_R;
  const G = state.isReparent ? REPARENT_G : DROP_G;
  const B = state.isReparent ? REPARENT_B : DROP_B;

  const sw = 2 / zoom;
  if (state.isReparent) {
    // C-1: 컨테이너 반투명 배경 오버레이
    const bgPaint = new ck.Paint();
    bgPaint.setColor(ck.Color4f(R, G, B, 0.06));
    bgPaint.setAntiAlias(true);
    bgPaint.setStyle(ck.PaintStyle.Fill);
    canvas.drawRect4f(
      targetBounds.x,
      targetBounds.y,
      targetBounds.x + targetBounds.width,
      targetBounds.y + targetBounds.height,
      bgPaint,
    );
    bgPaint.delete();

    // C-2: 타겟 컨테이너 아웃라인 (2/zoom, alpha 0.8)
    const outlinePaint = new ck.Paint();
    outlinePaint.setColor(ck.Color4f(R, G, B, 0.8));
    outlinePaint.setAntiAlias(true);
    outlinePaint.setStyle(ck.PaintStyle.Stroke);
    outlinePaint.setStrokeWidth(sw);
    canvas.drawRect4f(
      targetBounds.x - sw / 2,
      targetBounds.y - sw / 2,
      targetBounds.x + targetBounds.width + sw / 2,
      targetBounds.y + targetBounds.height + sw / 2,
      outlinePaint,
    );
    outlinePaint.delete();
  }

  // C-3: 삽입 라인 (solid, round cap, 양끝 원)
  if (insertIndex >= 0) {
    const bStart = (b: BoundingBox) => (isHorizontal ? b.x : b.y);
    const bEnd = (b: BoundingBox) =>
      isHorizontal ? b.x + b.width : b.y + b.height;

    let linePos = state.insertionLinePosition;
    if (linePos === undefined && childBounds.length > 0 && insertIndex === 0) {
      linePos = (bStart(targetBounds) + bStart(childBounds[0])) / 2;
    } else if (
      linePos === undefined &&
      childBounds.length > 0 &&
      insertIndex >= childBounds.length
    ) {
      linePos = bEnd(childBounds[childBounds.length - 1]);
    } else if (linePos === undefined && childBounds.length > 0) {
      linePos =
        (bEnd(childBounds[insertIndex - 1]) +
          bStart(childBounds[insertIndex])) /
        2;
    }

    if (linePos === undefined) {
      return;
    }

    if (state.placeholderBounds) {
      const placeholder = state.placeholderBounds;
      const placeholderFill = new ck.Paint();
      placeholderFill.setColor(ck.Color4f(R, G, B, 0.08));
      placeholderFill.setAntiAlias(true);
      placeholderFill.setStyle(ck.PaintStyle.Fill);
      canvas.drawRect4f(
        placeholder.x,
        placeholder.y,
        placeholder.x + placeholder.width,
        placeholder.y + placeholder.height,
        placeholderFill,
      );
      placeholderFill.delete();

      const placeholderStroke = new ck.Paint();
      placeholderStroke.setColor(ck.Color4f(R, G, B, 0.55));
      placeholderStroke.setAntiAlias(true);
      placeholderStroke.setStyle(ck.PaintStyle.Stroke);
      placeholderStroke.setStrokeWidth(1.5 / zoom);
      canvas.drawRect4f(
        placeholder.x,
        placeholder.y,
        placeholder.x + placeholder.width,
        placeholder.y + placeholder.height,
        placeholderStroke,
      );
      placeholderStroke.delete();
    }

    const linePaint = new ck.Paint();
    linePaint.setColor(ck.Color4f(R, G, B, 1));
    linePaint.setAntiAlias(true);
    linePaint.setStyle(ck.PaintStyle.Stroke);
    linePaint.setStrokeWidth(2 / zoom);
    linePaint.setStrokeCap(ck.StrokeCap.Round);

    if (isHorizontal) {
      canvas.drawLine(
        linePos,
        targetBounds.y,
        linePos,
        targetBounds.y + targetBounds.height,
        linePaint,
      );
    } else {
      canvas.drawLine(
        targetBounds.x,
        linePos,
        targetBounds.x + targetBounds.width,
        linePos,
        linePaint,
      );
    }
    linePaint.delete();

    // 양끝 원
    const circleR = 3 / zoom;
    const circlePaint = new ck.Paint();
    circlePaint.setColor(ck.Color4f(R, G, B, 1));
    circlePaint.setAntiAlias(true);
    circlePaint.setStyle(ck.PaintStyle.Fill);

    if (isHorizontal) {
      // 세로 라인 → 상단/하단에 원
      canvas.drawCircle(linePos, targetBounds.y, circleR, circlePaint);
      canvas.drawCircle(
        linePos,
        targetBounds.y + targetBounds.height,
        circleR,
        circlePaint,
      );
    } else {
      // 가로 라인 → 좌측/우측에 원
      canvas.drawCircle(targetBounds.x, linePos, circleR, circlePaint);
      canvas.drawCircle(
        targetBounds.x + targetBounds.width,
        linePos,
        circleR,
        circlePaint,
      );
    }
    circlePaint.delete();
  }
}
