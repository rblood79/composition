import type {
  PanelFrameGeometry,
  PanelId,
  PanelSnapEdge,
} from "../panels/core/types";

export type { PanelFrameGeometry as PanelGeometry, PanelSnapEdge };

export interface PanelSnapTarget {
  panelId: PanelId;
  geometry: PanelFrameGeometry;
}

export interface PanelSnapCandidate {
  targetPanelId: PanelId;
  edge: PanelSnapEdge;
  position: { x: number; y: number };
  targetGeometry: PanelFrameGeometry;
  distance: number;
}

export const PANEL_SNAP_GAP = 4;
export const PANEL_SNAP_THRESHOLD = 28;

export function panelDragMovedBeyondSnapThreshold(
  start: PanelFrameGeometry,
  current: PanelFrameGeometry,
  threshold = PANEL_SNAP_THRESHOLD,
): boolean {
  return Math.hypot(current.x - start.x, current.y - start.y) > threshold;
}

function candidatePositions(
  source: PanelFrameGeometry,
  target: PanelSnapTarget,
): Array<Omit<PanelSnapCandidate, "distance">> {
  const { geometry } = target;
  return [
    {
      targetPanelId: target.panelId,
      edge: "top",
      position: {
        x: geometry.x,
        y: geometry.y - source.height - PANEL_SNAP_GAP,
      },
      targetGeometry: geometry,
    },
    {
      targetPanelId: target.panelId,
      edge: "right",
      position: {
        x: geometry.x + geometry.width + PANEL_SNAP_GAP,
        y: geometry.y,
      },
      targetGeometry: geometry,
    },
    {
      targetPanelId: target.panelId,
      edge: "bottom",
      position: {
        x: geometry.x,
        y: geometry.y + geometry.height + PANEL_SNAP_GAP,
      },
      targetGeometry: geometry,
    },
    {
      targetPanelId: target.panelId,
      edge: "left",
      position: {
        x: geometry.x - source.width - PANEL_SNAP_GAP,
        y: geometry.y,
      },
      targetGeometry: geometry,
    },
  ];
}

export function resolvePanelSnap(
  source: PanelFrameGeometry,
  targets: PanelSnapTarget[],
  threshold = PANEL_SNAP_THRESHOLD,
): PanelSnapCandidate | null {
  let closest: PanelSnapCandidate | null = null;

  for (const target of targets) {
    for (const candidate of candidatePositions(source, target)) {
      const horizontal =
        candidate.edge === "top" || candidate.edge === "bottom";
      const sourceCrossStart = horizontal ? source.x : source.y;
      const sourceCrossEnd = horizontal
        ? source.x + source.width
        : source.y + source.height;
      const targetCrossStart = horizontal
        ? target.geometry.x
        : target.geometry.y;
      const targetCrossEnd = horizontal
        ? target.geometry.x + target.geometry.width
        : target.geometry.y + target.geometry.height;
      const crossDistance = Math.max(
        0,
        targetCrossStart - sourceCrossEnd,
        sourceCrossStart - targetCrossEnd,
      );
      const axisDistance = horizontal
        ? Math.abs(source.y - candidate.position.y)
        : Math.abs(source.x - candidate.position.x);
      const distance = Math.hypot(axisDistance, crossDistance);
      if (distance > threshold) continue;
      if (closest && closest.distance <= distance) continue;
      closest = { ...candidate, distance };
    }
  }

  return closest;
}
