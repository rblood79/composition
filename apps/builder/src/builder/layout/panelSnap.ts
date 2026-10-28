import type { PanelFrameGeometry } from "../panels/core/types";

/** A panel drag stays snapped to its cluster until it moves this far (px) — also the zone drop's edge band. */
export const PANEL_SNAP_THRESHOLD = 28;

export function panelDragMovedBeyondSnapThreshold(
  start: PanelFrameGeometry,
  current: PanelFrameGeometry,
  threshold = PANEL_SNAP_THRESHOLD,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}
