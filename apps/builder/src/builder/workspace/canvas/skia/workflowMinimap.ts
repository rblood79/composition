/**
 * Workflow Minimap Renderer (CanvasKit)
 *
 * 워크플로우 캔버스의 미니맵을 렌더링한다.
 * 전체 페이지 프레임 레이아웃, 엣지, 현재 뷰포트를 축소하여 표시.
 *
 * selectionRenderer.ts / workflowRenderer.ts와 동일한 패턴
 * (순수 함수 + SkiaDisposable).
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";
import { SkiaDisposable } from "./disposable";
import { acquireScopedPaint } from "./paints";
import {
  OVERLAY_BLUE_RGB,
  EVENT_NAV_PURPLE_RGB,
} from "./semanticOverlayColors";
import type { PageFrame } from "./workflowRenderer";
import type { WorkflowEdge } from "./workflowEdges";

// ============================================
// Types
// ============================================

export interface MinimapConfig {
  screenRight: number;
  screenBottom: number;
  width: number;
  height: number;
  bgColor: [number, number, number, number];
  borderRadius: number;
  borderColor: [number, number, number, number];
}

export interface MinimapTransform {
  sceneMinX: number;
  sceneMinY: number;
  sceneMaxX: number;
  sceneMaxY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface MinimapCamera {
  zoom: number;
  panX: number;
  panY: number;
}

export interface MinimapRenderData {
  pageFrames: Map<string, PageFrame>;
  edges: WorkflowEdge[];
  focusedPageId: string | null;
  viewportBounds: { x: number; y: number; width: number; height: number };
}

// ============================================
// Default Config
// ============================================

export const DEFAULT_MINIMAP_CONFIG: MinimapConfig = {
  screenRight: 16,
  screenBottom: 16,
  width: 200,
  height: 150,
  bgColor: [0.1, 0.1, 0.1, 0.85],
  borderRadius: 8,
  borderColor: [0.3, 0.3, 0.3, 0.5],
};

/** 캔버스 대비 미니맵 비율 (10%) */
export const MINIMAP_CANVAS_RATIO = 0.1;
/** 미니맵 최소/최대 크기 (px) */
export const MINIMAP_MIN_WIDTH = 80;
export const MINIMAP_MAX_WIDTH = 200;
export const MINIMAP_MIN_HEIGHT = 60;
export const MINIMAP_MAX_HEIGHT = 140;

// ============================================
// Colors
// ============================================

/** gray-700 (#374151) */
const PAGE_DEFAULT_COLOR: [number, number, number] = [
  0x37 / 255,
  0x41 / 255,
  0x51 / 255,
];

/** blue-500 (#3b82f6) */
const PAGE_FOCUSED_COLOR = OVERLAY_BLUE_RGB;

/** blue-500 for navigation edges */
const NAVIGATION_COLOR = OVERLAY_BLUE_RGB;

/** purple-500 (#a855f7) for event-navigation edges — 렌더러와 공용 (semanticOverlayColors 정본) */
const EVENT_NAV_COLOR = EVENT_NAV_PURPLE_RGB;

// ============================================
// Transform Computation
// ============================================

/**
 * 페이지 프레임들의 바운딩 박스를 계산하고,
 * 미니맵 영역에 맞추기 위한 스케일/오프셋 변환을 반환한다.
 *
 * minimapWidth, minimapHeight는 씬 좌표 기준 (이미 zoom으로 나눈 값).
 */
export function computeMinimapTransform(
  pageFrames: Map<string, PageFrame>,
  minimapWidth: number,
  minimapHeight: number,
): MinimapTransform {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const frame of pageFrames.values()) {
    minX = Math.min(minX, frame.x);
    minY = Math.min(minY, frame.y);
    maxX = Math.max(maxX, frame.x + frame.width);
    maxY = Math.max(maxY, frame.y + frame.height);
  }

  // 프레임이 없으면 기본값 반환
  if (!isFinite(minX)) {
    return {
      sceneMinX: 0,
      sceneMinY: 0,
      sceneMaxX: 1,
      sceneMaxY: 1,
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    };
  }

  // 10% 패딩 추가
  const extentX = maxX - minX;
  const extentY = maxY - minY;
  const padX = extentX * 0.1;
  const padY = extentY * 0.1;

  minX -= padX;
  minY -= padY;
  maxX += padX;
  maxY += padY;

  const sceneW = maxX - minX;
  const sceneH = maxY - minY;

  // 미니맵 영역에 맞추기 위한 스케일 (가로/세로 중 작은 쪽)
  const scale = Math.min(
    minimapWidth / Math.max(sceneW, 1),
    minimapHeight / Math.max(sceneH, 1),
  );

  // 중앙 정렬 오프셋
  const offsetX = (minimapWidth - sceneW * scale) / 2;
  const offsetY = (minimapHeight - sceneH * scale) / 2;

  return {
    sceneMinX: minX,
    sceneMinY: minY,
    sceneMaxX: maxX,
    sceneMaxY: maxY,
    scale,
    offsetX,
    offsetY,
  };
}

// ============================================
// Minimap Renderer
// ============================================

/**
 * 워크플로우 미니맵을 CanvasKit으로 렌더링한다.
 *
 * 카메라 변환 외부(스크린 고정)에서 호출된다.
 * 모든 크기는 1/zoom으로 스케일하여 씬 좌표에서 화면상 일정 크기를 유지한다.
 */
export function renderWorkflowMinimap(
  ck: CanvasKit,
  canvas: Canvas,
  data: MinimapRenderData,
  config: MinimapConfig,
  camera: MinimapCamera,
  containerSize: { width: number; height: number },
  zoom: number,
): void {
  if (data.pageFrames.size === 0) return;

  const scope = new SkiaDisposable();
  try {
    // 미니맵의 씬-공간 위치 계산
    const screenX = containerSize.width - config.screenRight - config.width;
    const screenY = containerSize.height - config.screenBottom - config.height;
    const mmSceneX = (screenX - camera.panX) / zoom;
    const mmSceneY = (screenY - camera.panY) / zoom;
    const mmSceneW = config.width / zoom;
    const mmSceneH = config.height / zoom;

    const borderRadius = config.borderRadius / zoom;

    // ── 배경 RRect ──
    const bgRect = ck.XYWHRect(mmSceneX, mmSceneY, mmSceneW, mmSceneH);
    const bgRRect = ck.RRectXY(bgRect, borderRadius, borderRadius);

    const bgPaint = acquireScopedPaint(scope, ck);
    bgPaint.setAntiAlias(true);
    bgPaint.setStyle(ck.PaintStyle.Fill);
    bgPaint.setColor(
      ck.Color4f(
        config.bgColor[0],
        config.bgColor[1],
        config.bgColor[2],
        config.bgColor[3],
      ),
    );
    canvas.drawRRect(bgRRect, bgPaint);

    // ── 보더 ──
    const borderPaint = acquireScopedPaint(scope, ck);
    borderPaint.setAntiAlias(true);
    borderPaint.setStyle(ck.PaintStyle.Stroke);
    borderPaint.setStrokeWidth(1 / zoom);
    borderPaint.setColor(
      ck.Color4f(
        config.borderColor[0],
        config.borderColor[1],
        config.borderColor[2],
        config.borderColor[3],
      ),
    );
    canvas.drawRRect(bgRRect, borderPaint);

    // ── 미니맵 영역으로 클리핑 (컨텐츠가 밖으로 넘치지 않도록) ──
    canvas.save();
    canvas.clipRRect(bgRRect, ck.ClipOp.Intersect, true);

    // ── 미니맵 변환 계산 ──
    const transform = computeMinimapTransform(
      data.pageFrames,
      mmSceneW,
      mmSceneH,
    );

    // 씬 좌표를 미니맵 내부 좌표로 변환하는 헬퍼
    const toMmX = (sx: number) =>
      mmSceneX +
      transform.offsetX +
      (sx - transform.sceneMinX) * transform.scale;
    const toMmY = (sy: number) =>
      mmSceneY +
      transform.offsetY +
      (sy - transform.sceneMinY) * transform.scale;

    // ── 페이지 프레임 렌더링 ──
    const defaultPagePaint = acquireScopedPaint(scope, ck);
    defaultPagePaint.setAntiAlias(true);
    defaultPagePaint.setStyle(ck.PaintStyle.Fill);
    defaultPagePaint.setColor(
      ck.Color4f(
        PAGE_DEFAULT_COLOR[0],
        PAGE_DEFAULT_COLOR[1],
        PAGE_DEFAULT_COLOR[2],
        1,
      ),
    );

    const focusedPagePaint = acquireScopedPaint(scope, ck);
    focusedPagePaint.setAntiAlias(true);
    focusedPagePaint.setStyle(ck.PaintStyle.Fill);
    focusedPagePaint.setColor(
      ck.Color4f(
        PAGE_FOCUSED_COLOR[0],
        PAGE_FOCUSED_COLOR[1],
        PAGE_FOCUSED_COLOR[2],
        1,
      ),
    );

    for (const [pageId, frame] of data.pageFrames) {
      const rx = toMmX(frame.x);
      const ry = toMmY(frame.y);
      const rw = frame.width * transform.scale;
      const rh = frame.height * transform.scale;

      const paint =
        pageId === data.focusedPageId ? focusedPagePaint : defaultPagePaint;
      canvas.drawRect(ck.XYWHRect(rx, ry, rw, rh), paint);
    }

    // ── 엣지 렌더링 (직선) ──
    const navEdgePaint = acquireScopedPaint(scope, ck);
    navEdgePaint.setAntiAlias(true);
    navEdgePaint.setStyle(ck.PaintStyle.Stroke);
    navEdgePaint.setStrokeWidth(1 / zoom);
    navEdgePaint.setColor(
      ck.Color4f(
        NAVIGATION_COLOR[0],
        NAVIGATION_COLOR[1],
        NAVIGATION_COLOR[2],
        1,
      ),
    );

    const eventEdgePaint = acquireScopedPaint(scope, ck);
    eventEdgePaint.setAntiAlias(true);
    eventEdgePaint.setStyle(ck.PaintStyle.Stroke);
    eventEdgePaint.setStrokeWidth(1 / zoom);
    eventEdgePaint.setColor(
      ck.Color4f(EVENT_NAV_COLOR[0], EVENT_NAV_COLOR[1], EVENT_NAV_COLOR[2], 1),
    );

    for (const edge of data.edges) {
      const sourceFrame = data.pageFrames.get(edge.sourcePageId);
      const targetFrame = data.pageFrames.get(edge.targetPageId);
      if (!sourceFrame || !targetFrame) continue;

      // 소스/타겟 프레임 중심
      const sx = toMmX(sourceFrame.x + sourceFrame.width / 2);
      const sy = toMmY(sourceFrame.y + sourceFrame.height / 2);
      const ex = toMmX(targetFrame.x + targetFrame.width / 2);
      const ey = toMmY(targetFrame.y + targetFrame.height / 2);

      const paint =
        edge.type === "event-navigation" ? eventEdgePaint : navEdgePaint;
      canvas.drawLine(sx, sy, ex, ey, paint);
    }

    // ── 뷰포트 인디케이터 ──
    const vb = data.viewportBounds;
    const vpX = toMmX(vb.x);
    const vpY = toMmY(vb.y);
    const vpW = vb.width * transform.scale;
    const vpH = vb.height * transform.scale;

    // 뷰포트 밖 영역 어둡게 (dim mask) — 현재 보이는 영역을 명확히 표시
    const dimPaint = acquireScopedPaint(scope, ck);
    dimPaint.setAntiAlias(true);
    dimPaint.setStyle(ck.PaintStyle.Fill);
    dimPaint.setColor(ck.Color4f(0, 0, 0, 0.45));

    // 상단 (미니맵 상단 ~ 뷰포트 상단)
    canvas.drawRect(
      ck.XYWHRect(mmSceneX, mmSceneY, mmSceneW, vpY - mmSceneY),
      dimPaint,
    );
    // 하단 (뷰포트 하단 ~ 미니맵 하단)
    const vpBottom = vpY + vpH;
    canvas.drawRect(
      ck.XYWHRect(mmSceneX, vpBottom, mmSceneW, mmSceneY + mmSceneH - vpBottom),
      dimPaint,
    );
    // 좌측 (뷰포트 좌측 왼쪽, 뷰포트 높이 범위)
    canvas.drawRect(ck.XYWHRect(mmSceneX, vpY, vpX - mmSceneX, vpH), dimPaint);
    // 우측 (뷰포트 우측 오른쪽, 뷰포트 높이 범위)
    const vpRight = vpX + vpW;
    canvas.drawRect(
      ck.XYWHRect(vpRight, vpY, mmSceneX + mmSceneW - vpRight, vpH),
      dimPaint,
    );

    // 뷰포트 테두리
    const vpStrokePaint = acquireScopedPaint(scope, ck);
    vpStrokePaint.setAntiAlias(true);
    vpStrokePaint.setStyle(ck.PaintStyle.Stroke);
    vpStrokePaint.setStrokeWidth(1.5 / zoom);
    vpStrokePaint.setColor(
      ck.Color4f(
        PAGE_FOCUSED_COLOR[0],
        PAGE_FOCUSED_COLOR[1],
        PAGE_FOCUSED_COLOR[2],
        1,
      ),
    );
    canvas.drawRect(ck.XYWHRect(vpX, vpY, vpW, vpH), vpStrokePaint);

    // ── 클리핑 해제 ──
    canvas.restore();
  } finally {
    scope.dispose();
  }
}

// ============================================
// Hit Testing
// ============================================

/**
 * 스크린 좌표가 미니맵 영역 내부인지 판정한다.
 */
export function isPointInMinimap(
  screenX: number,
  screenY: number,
  config: MinimapConfig,
  containerSize: { width: number; height: number },
): boolean {
  const mmLeft = containerSize.width - config.screenRight - config.width;
  const mmTop = containerSize.height - config.screenBottom - config.height;

  return (
    screenX >= mmLeft &&
    screenX <= mmLeft + config.width &&
    screenY >= mmTop &&
    screenY <= mmTop + config.height
  );
}

// ============================================
// Coordinate Conversion
// ============================================

/**
 * 미니맵 내부의 스크린 좌표를 씬(월드) 좌표로 변환한다.
 *
 * useWorkflowInteraction에서 미니맵 클릭 시 카메라 이동에 사용.
 */
export function minimapScreenToWorld(
  screenX: number,
  screenY: number,
  config: MinimapConfig,
  transform: MinimapTransform,
  containerSize: { width: number; height: number },
): { worldX: number; worldY: number } {
  // 미니맵의 스크린 좌상단
  const mmLeft = containerSize.width - config.screenRight - config.width;
  const mmTop = containerSize.height - config.screenBottom - config.height;

  // 미니맵 내부 로컬 좌표 (px)
  const localX = screenX - mmLeft;
  const localY = screenY - mmTop;

  // 오프셋/스케일 역변환 → 씬 좌표
  const worldX =
    transform.sceneMinX + (localX - transform.offsetX) / transform.scale;
  const worldY =
    transform.sceneMinY + (localY - transform.offsetY) / transform.scale;

  return { worldX, worldY };
}
