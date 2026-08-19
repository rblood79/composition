import type { PanelFrameGeometry, PanelId } from "../panels/core/types";
import type { PanelWorkspaceLayoutSnapshot } from "./panelWorkspaceLayoutCoordinator";
import type { PanelWorkspaceLayoutV2 } from "./panelWorkspaceLayoutV2";
import { PANEL_SNAP_THRESHOLD } from "./panelSnap";

export type PanelDockDropPosition = "first" | "last";

export interface PanelDockDropTarget {
  clusterId: string;
  columnIndex: number;
  position: PanelDockDropPosition;
}

export interface PanelDockDropCandidate extends PanelDockDropTarget {
  distance: number;
}

function crossAxisDistance(
  sourceStart: number,
  sourceEnd: number,
  targetStart: number,
  targetEnd: number,
): number {
  return Math.max(0, targetStart - sourceEnd, sourceStart - targetEnd);
}

export function resolvePanelDockDropFromSnapshot(
  layout: PanelWorkspaceLayoutV2,
  snapshot: PanelWorkspaceLayoutSnapshot,
  sourcePanelId: PanelId,
  sourceGeometry: PanelFrameGeometry,
  threshold = PANEL_SNAP_THRESHOLD,
): PanelDockDropCandidate | null {
  let closest: PanelDockDropCandidate | null = null;

  for (const cluster of layout.clusters) {
    for (const [columnIndex, column] of cluster.columns.entries()) {
      const frames = column.rows.flatMap((row) => {
        if (row.panelId === sourcePanelId) return [];
        const frame = snapshot.frameGeometries.get(row.panelId);
        return frame ? [frame] : [];
      });
      if (frames.length === 0) continue;

      const left = Math.min(...frames.map((frame) => frame.x));
      const top = Math.min(...frames.map((frame) => frame.y));
      const right = Math.max(...frames.map((frame) => frame.x + frame.width));
      const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
      const crossDistance = crossAxisDistance(
        sourceGeometry.x,
        sourceGeometry.x + sourceGeometry.width,
        left,
        right,
      );

      for (const position of ["first", "last"] as const) {
        const axisDistance =
          position === "first"
            ? Math.abs(sourceGeometry.y + sourceGeometry.height - top)
            : Math.abs(sourceGeometry.y - bottom);
        const distance = Math.hypot(axisDistance, crossDistance);
        if (distance > threshold) continue;
        if (closest && closest.distance <= distance) continue;
        closest = {
          clusterId: cluster.id,
          columnIndex,
          position,
          distance,
        };
      }
    }
  }

  return closest;
}
