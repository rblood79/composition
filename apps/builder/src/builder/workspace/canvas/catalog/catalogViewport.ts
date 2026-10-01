import type { BoundingBox } from "../selection/types";
import { getViewportController } from "../viewport/ViewportController";
import {
  computeCenteredViewport,
  computeFillViewport,
  computeFitViewport,
} from "../viewport/viewportActions";

/**
 * ADR-248 Phase 4e: fit a page frame (scene rect) into the Canvas container — the Canvas's first
 * view and ⌘0 (zoom to fit). The catalog page frames sit on the page grid (not at the origin).
 */
export function fitCatalogPageFrame(
  frame: { x: number; y: number; width: number; height: number },
  containerSize: { width: number; height: number },
  /** Largest zoom (a small component opens at its real size, not blown up to the screen). */
  maxZoom = Infinity,
): void {
  if (!containerSize.width || !containerSize.height) return;
  let fitted = computeFitViewport({ canvasSize: frame, containerSize });
  if (fitted.scale > maxZoom)
    fitted = computeCenteredViewport({
      canvasSize: frame,
      containerSize,
      zoom: maxZoom,
    });
  getViewportController().setPosition(
    fitted.x - frame.x * fitted.scale,
    fitted.y - frame.y * fitted.scale,
    fitted.scale,
  );
}

/** Fill the container with a page frame (the zoom menu's Fill — the frame may overflow). */
export function fillCatalogPageFrame(
  frame: { x: number; y: number; width: number; height: number },
  containerSize: { width: number; height: number },
): void {
  if (!containerSize.width || !containerSize.height) return;
  const filled = computeFillViewport({ canvasSize: frame, containerSize });
  getViewportController().setPosition(
    filled.x - frame.x * filled.scale,
    filled.y - frame.y * filled.scale,
    filled.scale,
  );
}

/**
 * Zoom to selection (⇧2): the union of the selected elements' scene boxes — fitted like a page
 * frame (90 % of the container, centered; the old Canvas's rule). `undefined` = nothing to fit
 * (no box, or an empty one).
 */
export function catalogUnionRect(
  boxes: readonly (BoundingBox | undefined)[],
): BoundingBox | undefined {
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const box of boxes) {
    if (!box) continue;
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
  }
  if (!(right > left && bottom > top)) return undefined;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
