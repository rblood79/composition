import type { PanelFrameGeometry, PanelId } from "../panels/core/types";
import {
  PANEL_SNAP_THRESHOLD,
  resolvePanelSnap,
  type PanelSnapCandidate,
  type PanelSnapTarget,
} from "./panelSnap";
import type { PanelWorkspaceLayoutSnapshot } from "./panelWorkspaceLayoutCoordinator";

export type PanelWorkspaceGeometryField = "x" | "y" | "width" | "height";

export type PanelWorkspaceShadowMismatch =
  | {
      panelId: PanelId;
      kind: "missing-shadow" | "unexpected-shadow";
    }
  | {
      panelId: PanelId;
      kind: "geometry";
      fields: readonly PanelWorkspaceGeometryField[];
      observed: Readonly<PanelFrameGeometry>;
      shadow: Readonly<PanelFrameGeometry>;
    };

const GEOMETRY_FIELDS: readonly PanelWorkspaceGeometryField[] = [
  "x",
  "y",
  "width",
  "height",
];

function plainGeometry(
  geometry: PanelFrameGeometry,
): Readonly<PanelFrameGeometry> {
  return Object.freeze({
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
  });
}

export function comparePanelWorkspaceShadowFrames(
  snapshot: PanelWorkspaceLayoutSnapshot,
  observedFrames: ReadonlyMap<PanelId, PanelFrameGeometry>,
  tolerance = 0.01,
): PanelWorkspaceShadowMismatch[] {
  const safeTolerance = Math.max(0, tolerance);
  const orderedPanelIds = new Set<PanelId>([
    ...snapshot.panelOrder,
    ...observedFrames.keys(),
    ...snapshot.frameGeometries.keys(),
  ]);
  const mismatches: PanelWorkspaceShadowMismatch[] = [];
  for (const panelId of orderedPanelIds) {
    const observed = observedFrames.get(panelId);
    const shadow = snapshot.frameGeometries.get(panelId);
    if (observed && !shadow) {
      mismatches.push({ panelId, kind: "missing-shadow" });
      continue;
    }
    if (!observed && shadow) {
      mismatches.push({ panelId, kind: "unexpected-shadow" });
      continue;
    }
    if (!observed || !shadow) continue;
    const fields = GEOMETRY_FIELDS.filter(
      (field) => Math.abs(observed[field] - shadow[field]) > safeTolerance,
    );
    if (fields.length === 0) continue;
    mismatches.push({
      panelId,
      kind: "geometry",
      fields: Object.freeze(fields),
      observed: plainGeometry(observed),
      shadow: plainGeometry(shadow),
    });
  }
  return mismatches;
}

export function resolvePanelSnapFromSnapshot(
  snapshot: PanelWorkspaceLayoutSnapshot,
  sourcePanelId: PanelId,
  sourceGeometry: PanelFrameGeometry,
  threshold = PANEL_SNAP_THRESHOLD,
): PanelSnapCandidate | null {
  const targets: PanelSnapTarget[] = snapshot.panelOrder.flatMap((panelId) => {
    if (panelId === sourcePanelId) return [];
    const geometry = snapshot.frameGeometries.get(panelId);
    return geometry ? [{ panelId, geometry: plainGeometry(geometry) }] : [];
  });
  return resolvePanelSnap(sourceGeometry, targets, threshold);
}
