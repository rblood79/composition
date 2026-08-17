import type { PageTitleBounds } from "../skia/skiaOverlayHelpers";

export function isPointInPageTitleBounds(
  point: { x: number; y: number },
  bounds: PageTitleBounds,
): boolean {
  return (
    point.x >= bounds.sceneX &&
    point.x <= bounds.sceneX + bounds.sceneWidth &&
    point.y >= bounds.sceneY &&
    point.y <= bounds.sceneY + bounds.sceneHeight
  );
}

export function resolvePageTitleEditorRect(
  bounds: PageTitleBounds,
  zoom: number,
  panOffset: { x: number; y: number },
): { left: number; top: number; width: number; height: number } {
  return {
    left: bounds.textSceneX * zoom + panOffset.x,
    top: bounds.textSceneY * zoom + panOffset.y,
    width: bounds.textSceneWidth * zoom,
    height: bounds.textSceneHeight * zoom,
  };
}
