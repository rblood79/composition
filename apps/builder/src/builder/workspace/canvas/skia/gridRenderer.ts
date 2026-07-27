/**
 * CanvasKit/Skia 그리드 렌더러
 *
 * PixiJS Graphics 기반 GridLayer를 CanvasKit으로 마이그레이션.
 * 씬 좌표계(scene-space)에서 그리드를 렌더링한다.
 * 카메라 변환은 SkiaRenderer.renderScreenOverlay()에서 적용된다.
 *
 * 씬 좌표계 렌더링의 핵심:
 * - 그리드선이 요소의 left/top 값과 동일한 좌표에 위치
 * - Snap to Grid와 시각적 그리드가 항상 정렬됨
 * - 선 두께를 1/zoom으로 보정하여 화면상 1px 유지
 *
 * @see GridLayer.tsx (원본 PixiJS 구현)
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";
import { acquirePooledPaint, releasePooledPaint } from "./paints";

// ============================================
// Types
// ============================================

export interface GridRenderOptions {
  /** 씬 좌표계 가시 영역 (culling bounds) */
  cullingBounds: DOMRect;
  /** 기본 그리드 크기 (씬 좌표, 요소의 snap 단위와 동일) */
  gridSize: number;
  /** 현재 줌 레벨 */
  zoom: number;
  /** 그리드 표시 여부 */
  showGrid: boolean;
  /** 스냅 그리드 표시 여부 */
  showSnapGrid?: boolean;
  /** 스냅 그리드 크기 */
  snapSize?: number;
}

// ============================================
// Constants (GridLayer.tsx와 동일)
// ============================================

/** slate-200 */
const GRID_COLOR = [0xe2 / 255, 0xe8 / 255, 0xf0 / 255] as const;
const GRID_ALPHA = 0.5;

/** slate-400 */
const MAJOR_GRID_COLOR = [0x94 / 255, 0xa3 / 255, 0xb8 / 255] as const;
const MAJOR_GRID_ALPHA = 0.3;

/** slate-600 */
const CENTER_LINE_COLOR = [0x47 / 255, 0x55 / 255, 0x69 / 255] as const;
const CENTER_LINE_ALPHA = 0.6;
const CENTER_LINE_WIDTH = 1;

/** blue-500 */
const SNAP_GRID_COLOR = [0x3b / 255, 0x82 / 255, 0xf6 / 255] as const;
const SNAP_GRID_ALPHA = 0.2;

// ============================================
// Helper Functions
// ============================================

/**
 * 줌 레벨에 따른 적절한 그리드 간격 계산
 *
 * 항상 gridSize의 정수 배수를 반환하여
 * 표시되는 모든 그리드선이 유효한 snap 위치에 놓이도록 보장한다.
 */
function calculateGridInterval(baseSize: number, zoom: number): number {
  if (zoom < 0.25) return baseSize * 4;
  if (zoom < 0.5) return baseSize * 2;
  if (zoom > 2) return baseSize / 2;
  if (zoom > 4) return baseSize / 4;
  return baseSize;
}

// ============================================
// Renderer
// ============================================

/**
 * CanvasKit으로 씬 좌표계 그리드를 렌더링한다.
 *
 * SkiaRenderer의 screenOverlayNode로 설정되며,
 * renderScreenOverlay()에서 카메라 변환(translate + scale)이 적용된 후 호출된다.
 * 따라서 이 함수는 씬 좌표(요소와 동일한 좌표계)에서 그리드를 그린다.
 */
export function renderGrid(
  ck: CanvasKit,
  canvas: Canvas,
  options: GridRenderOptions,
): void {
  if (!options.showGrid) return;

  const { cullingBounds, gridSize, zoom } = options;
  const gridInterval = calculateGridInterval(gridSize, zoom);
  const majorGridInterval = gridInterval * 5;

  // 씬 좌표계에서의 선 두께: 화면상 항상 1px로 보이도록 zoom 보정
  const lineWidth = 1 / zoom;
  const halfLine = lineWidth / 2;

  // 가시 영역의 시작/끝 (그리드 간격으로 정렬)
  const startX = Math.floor(cullingBounds.x / gridInterval) * gridInterval;
  const endX =
    Math.ceil((cullingBounds.x + cullingBounds.width) / gridInterval) *
    gridInterval;
  const startY = Math.floor(cullingBounds.y / gridInterval) * gridInterval;
  const endY =
    Math.ceil((cullingBounds.y + cullingBounds.height) / gridInterval) *
    gridInterval;

  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(false);
  paint.setStyle(ck.PaintStyle.Fill);

  // === 일반 그리드 ===
  paint.setColor(
    ck.Color4f(GRID_COLOR[0], GRID_COLOR[1], GRID_COLOR[2], GRID_ALPHA),
  );

  // 수직선
  for (let x = startX; x <= endX; x += gridInterval) {
    if (x % majorGridInterval === 0) continue;
    canvas.drawRect(
      ck.XYWHRect(
        x - halfLine,
        cullingBounds.y,
        lineWidth,
        cullingBounds.height,
      ),
      paint,
    );
  }
  // 수평선
  for (let y = startY; y <= endY; y += gridInterval) {
    if (y % majorGridInterval === 0) continue;
    canvas.drawRect(
      ck.XYWHRect(
        cullingBounds.x,
        y - halfLine,
        cullingBounds.width,
        lineWidth,
      ),
      paint,
    );
  }

  // === 메이저 그리드 (5배 간격, 더 진한 색상) ===
  paint.setColor(
    ck.Color4f(
      MAJOR_GRID_COLOR[0],
      MAJOR_GRID_COLOR[1],
      MAJOR_GRID_COLOR[2],
      MAJOR_GRID_ALPHA,
    ),
  );

  const majorStartX =
    Math.floor(cullingBounds.x / majorGridInterval) * majorGridInterval;
  const majorEndX =
    Math.ceil((cullingBounds.x + cullingBounds.width) / majorGridInterval) *
    majorGridInterval;
  const majorStartY =
    Math.floor(cullingBounds.y / majorGridInterval) * majorGridInterval;
  const majorEndY =
    Math.ceil((cullingBounds.y + cullingBounds.height) / majorGridInterval) *
    majorGridInterval;

  for (let x = majorStartX; x <= majorEndX; x += majorGridInterval) {
    canvas.drawRect(
      ck.XYWHRect(
        x - halfLine,
        cullingBounds.y,
        lineWidth,
        cullingBounds.height,
      ),
      paint,
    );
  }
  for (let y = majorStartY; y <= majorEndY; y += majorGridInterval) {
    canvas.drawRect(
      ck.XYWHRect(
        cullingBounds.x,
        y - halfLine,
        cullingBounds.width,
        lineWidth,
      ),
      paint,
    );
  }

  // === 원점 중앙선 (씬 원점 0, 0) ===
  const centerLineWidth = CENTER_LINE_WIDTH / zoom;
  const halfCenter = centerLineWidth / 2;
  paint.setColor(
    ck.Color4f(
      CENTER_LINE_COLOR[0],
      CENTER_LINE_COLOR[1],
      CENTER_LINE_COLOR[2],
      CENTER_LINE_ALPHA,
    ),
  );

  // Y축 (x=0) — 가시 영역에 포함될 때만 렌더링
  if (cullingBounds.x <= 0 && cullingBounds.x + cullingBounds.width >= 0) {
    canvas.drawRect(
      ck.XYWHRect(
        -halfCenter,
        cullingBounds.y,
        centerLineWidth,
        cullingBounds.height,
      ),
      paint,
    );
  }
  // X축 (y=0)
  if (cullingBounds.y <= 0 && cullingBounds.y + cullingBounds.height >= 0) {
    canvas.drawRect(
      ck.XYWHRect(
        cullingBounds.x,
        -halfCenter,
        cullingBounds.width,
        centerLineWidth,
      ),
      paint,
    );
  }

  // === 스냅 그리드 (선택적) ===
  if (
    options.showSnapGrid &&
    options.snapSize &&
    options.snapSize !== gridInterval
  ) {
    paint.setColor(
      ck.Color4f(
        SNAP_GRID_COLOR[0],
        SNAP_GRID_COLOR[1],
        SNAP_GRID_COLOR[2],
        SNAP_GRID_ALPHA,
      ),
    );

    const snapSize = options.snapSize;
    const snapStartX = Math.floor(cullingBounds.x / snapSize) * snapSize;
    const snapEndX =
      Math.ceil((cullingBounds.x + cullingBounds.width) / snapSize) * snapSize;
    const snapStartY = Math.floor(cullingBounds.y / snapSize) * snapSize;
    const snapEndY =
      Math.ceil((cullingBounds.y + cullingBounds.height) / snapSize) * snapSize;
    const dotRadius = 1 / zoom;

    for (let x = snapStartX; x <= snapEndX; x += snapSize) {
      for (let y = snapStartY; y <= snapEndY; y += snapSize) {
        canvas.drawCircle(x, y, dotRadius, paint);
      }
    }
  }

  releasePooledPaint(paint);
}
