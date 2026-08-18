import type { PanelId } from "../panels/core/types";

export type PanelSnapEdge = "top" | "right" | "bottom" | "left";

export interface PanelGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanelSnapTarget {
  panelId: PanelId;
  geometry: PanelGeometry;
}

export interface PanelSnapCandidate {
  targetPanelId: PanelId;
  edge: PanelSnapEdge;
  position: { x: number; y: number };
  distance: number;
}

export const PANEL_SNAP_GAP = 4;
export const PANEL_SNAP_THRESHOLD = 28;

function candidatePositions(
  source: PanelGeometry,
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
    },
    {
      targetPanelId: target.panelId,
      edge: "right",
      position: {
        x: geometry.x + geometry.width + PANEL_SNAP_GAP,
        y: geometry.y,
      },
    },
    {
      targetPanelId: target.panelId,
      edge: "bottom",
      position: {
        x: geometry.x,
        y: geometry.y + geometry.height + PANEL_SNAP_GAP,
      },
    },
    {
      targetPanelId: target.panelId,
      edge: "left",
      position: {
        x: geometry.x - source.width - PANEL_SNAP_GAP,
        y: geometry.y,
      },
    },
  ];
}

export function resolvePanelSnap(
  source: PanelGeometry,
  targets: PanelSnapTarget[],
  threshold = PANEL_SNAP_THRESHOLD,
): PanelSnapCandidate | null {
  let closest: PanelSnapCandidate | null = null;

  for (const target of targets) {
    for (const candidate of candidatePositions(source, target)) {
      const distance = Math.hypot(
        source.x - candidate.position.x,
        source.y - candidate.position.y,
      );
      if (distance > threshold) continue;
      if (closest && closest.distance <= distance) continue;
      closest = { ...candidate, distance };
    }
  }

  return closest;
}
