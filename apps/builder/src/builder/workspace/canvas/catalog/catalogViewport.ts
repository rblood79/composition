import { getViewportController } from "../viewport/ViewportController";
import { computeFitViewport } from "../viewport/viewportActions";

/**
 * ADR-248 Phase 4e: fit a page frame (scene rect) into the Canvas container — the Canvas's first
 * view and ⌘0 (zoom to fit). The catalog page frames sit on the page grid (not at the origin).
 */
export function fitCatalogPageFrame(
  frame: { x: number; y: number; width: number; height: number },
  containerSize: { width: number; height: number },
): void {
  if (!containerSize.width || !containerSize.height) return;
  const fitted = computeFitViewport({ canvasSize: frame, containerSize });
  getViewportController().setPosition(
    fitted.x - frame.x * fitted.scale,
    fitted.y - frame.y * fitted.scale,
    fitted.scale,
  );
}
