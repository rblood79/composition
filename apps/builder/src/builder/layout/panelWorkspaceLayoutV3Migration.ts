import type { PanelId } from "../panels/core/types";
import {
  PANEL_WORKSPACE_GAP,
  panelWorkspaceFloatingOriginY,
  parsePanelWorkspaceLayoutV2,
  solvePanelWorkspaceLayoutV2,
  type PanelWorkspaceClusterV2,
  type PanelWorkspaceFloatingClusterV2,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceLayoutSolution,
  type PanelWorkspaceRailSide,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import {
  normalizePanelWorkspaceLayoutV3,
  PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL,
  PANEL_WORKSPACE_LAYOUT_V3_VERSION,
  PANEL_WORKSPACE_PLACEMENT_ZONES,
  validatePanelWorkspacePlacementSurface,
  type PanelWorkspaceClusterV3,
  type PanelWorkspaceColumnV3,
  type PanelWorkspaceLayoutV3,
  type PanelWorkspacePlacementZone,
} from "./panelWorkspaceLayoutV3";

export interface MigratePanelWorkspaceLayoutV2ToV3Options {
  surfaceRect: PanelWorkspaceRect;
  migrationId: string;
}

interface ClusterGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FloatingMigrationEntry {
  cluster: PanelWorkspaceFloatingClusterV2;
  clusterIndex: number;
  geometry: ClusterGeometry;
}

const RAIL_SIDES: readonly PanelWorkspaceRailSide[] = [
  "left",
  "right",
  "bottom",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function rawFloatingFocusOrder(input: unknown): string[] {
  if (!isRecord(input) || !Array.isArray(input.floatingFocusOrder)) return [];
  const result: string[] = [];
  for (const value of input.floatingFocusOrder) {
    if (!isNonEmptyString(value) || result.includes(value)) continue;
    result.push(value);
  }
  return result;
}

function clusterPanelIds(cluster: PanelWorkspaceClusterV2): PanelId[] {
  return cluster.columns.flatMap((column) =>
    column.rows.map((row) => row.panelId),
  );
}

function storedClusterGeometry(
  cluster: PanelWorkspaceFloatingClusterV2,
  surfaceRect: PanelWorkspaceRect,
): ClusterGeometry {
  const width = Math.min(
    surfaceRect.width,
    cluster.columns.reduce((sum, column) => sum + column.width, 0) +
      PANEL_WORKSPACE_GAP * Math.max(0, cluster.columns.length - 1),
  );
  const height = Math.min(
    surfaceRect.height,
    Math.max(
      0,
      ...cluster.columns.map(
        (column) =>
          column.rows.reduce((sum, row) => sum + row.height, 0) +
          PANEL_WORKSPACE_GAP * Math.max(0, column.rows.length - 1),
      ),
    ),
  );
  return {
    x: clamp(cluster.position.x, 0, Math.max(0, surfaceRect.width - width)),
    y: clamp(
      panelWorkspaceFloatingOriginY(cluster),
      0,
      Math.max(0, surfaceRect.height - height),
    ),
    width,
    height,
  };
}

function solvedClusterGeometry(
  cluster: PanelWorkspaceFloatingClusterV2,
  solution: PanelWorkspaceLayoutSolution,
  surfaceRect: PanelWorkspaceRect,
): ClusterGeometry {
  const frames = clusterPanelIds(cluster)
    .map((panelId) => solution.frameGeometries.get(panelId))
    .filter((frame) => frame !== undefined);
  if (frames.length === 0) {
    return storedClusterGeometry(cluster, surfaceRect);
  }
  const left = Math.min(...frames.map((frame) => frame.x));
  const top = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function zoneAnchor(zone: PanelWorkspacePlacementZone): {
  x: number;
  y: number;
} {
  const column =
    zone.endsWith("left") || zone === "left"
      ? 0
      : zone.endsWith("right") || zone === "right"
        ? 1
        : 0.5;
  const row =
    zone.startsWith("top") || zone === "top"
      ? 0
      : zone.startsWith("bottom") || zone === "bottom"
        ? 1
        : 0.5;
  return { x: column, y: row };
}

function nearestAvailableZone(
  geometry: ClusterGeometry,
  surfaceRect: PanelWorkspaceRect,
  occupied: ReadonlySet<PanelWorkspacePlacementZone>,
): PanelWorkspacePlacementZone | null {
  const center = {
    x: (geometry.x + geometry.width / 2) / surfaceRect.width,
    y: (geometry.y + geometry.height / 2) / surfaceRect.height,
  };
  let winner: PanelWorkspacePlacementZone | null = null;
  let winnerDistance = Number.POSITIVE_INFINITY;
  for (const zone of PANEL_WORKSPACE_PLACEMENT_ZONES) {
    if (occupied.has(zone)) continue;
    const anchor = zoneAnchor(zone);
    const distance = (center.x - anchor.x) ** 2 + (center.y - anchor.y) ** 2;
    if (distance < winnerDistance) {
      winner = zone;
      winnerDistance = distance;
    }
  }
  return winner;
}

function cloneClusterAsV3(
  cluster: PanelWorkspaceClusterV2,
  placementZone: PanelWorkspacePlacementZone,
): PanelWorkspaceClusterV3 {
  return {
    id: cluster.id,
    placementZone,
    columns: cluster.columns.map((column) => ({
      id: column.id,
      width: column.width,
      rows: column.rows.map((row) => ({ ...row })),
    })),
  };
}

function railMembership(
  layout: PanelWorkspaceLayoutV2,
): Map<PanelId, PanelWorkspaceRailSide> {
  const membership = new Map<PanelId, PanelWorkspaceRailSide>();
  for (const side of RAIL_SIDES) {
    for (const panelId of layout.railOrder[side]) {
      membership.set(panelId, side);
    }
  }
  return membership;
}

function mergeColumnForSide(
  target: PanelWorkspaceClusterV3,
  side: PanelWorkspaceRailSide,
  sourceColumn: PanelWorkspaceColumnV3,
): PanelWorkspaceColumnV3 {
  if (target.columns.length === 0) {
    const column = {
      id: `${target.id}:migration:column:0`,
      width: sourceColumn.width,
      rows: [],
    };
    target.columns.push(column);
    return column;
  }
  return side === "left"
    ? target.columns[target.columns.length - 1]!
    : target.columns[0]!;
}

function routeOverflowClusters(
  overflow: readonly FloatingMigrationEntry[],
  outputClusters: PanelWorkspaceClusterV3[],
  membership: ReadonlyMap<PanelId, PanelWorkspaceRailSide>,
): void {
  const byZone = new Map(
    outputClusters.map((cluster) => [cluster.placementZone, cluster]),
  );
  const sorted = [...overflow].sort(
    (left, right) => left.clusterIndex - right.clusterIndex,
  );
  for (const { cluster } of sorted) {
    for (const sourceColumn of cluster.columns) {
      for (const sourceRow of sourceColumn.rows) {
        const side = membership.get(sourceRow.panelId);
        if (!side) continue;
        const placementZone = PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL[side];
        let target = byZone.get(placementZone);
        if (!target) {
          target = {
            id: `migration:${placementZone}`,
            placementZone,
            columns: [],
          };
          byZone.set(placementZone, target);
          outputClusters.push(target);
        }
        const mergeColumn = mergeColumnForSide(target, side, {
          id: sourceColumn.id,
          width: sourceColumn.width,
          rows: [],
        });
        mergeColumn.width = Math.max(mergeColumn.width, sourceColumn.width);
        mergeColumn.rows.push({ ...sourceRow });
      }
    }
  }
}

function migrationFocusOrder(
  layout: PanelWorkspaceLayoutV2,
  rawFocusOrder: readonly string[],
  outputClusters: readonly PanelWorkspaceClusterV3[],
): string[] {
  const sourceIds = new Set(layout.clusters.map((cluster) => cluster.id));
  const validFocus = rawFocusOrder.filter((clusterId) =>
    sourceIds.has(clusterId),
  );
  const validFocusSet = new Set(validFocus);
  const missing = layout.clusters
    .map((cluster) => cluster.id)
    .filter((clusterId) => !validFocusSet.has(clusterId));
  const outputIds = new Set(outputClusters.map((cluster) => cluster.id));
  return [...missing, ...validFocus].filter((clusterId) =>
    outputIds.has(clusterId),
  );
}

export function migratePanelWorkspaceLayoutV2ToV3(
  input: unknown,
  registry: readonly PanelWorkspaceRegistryEntry[],
  options: MigratePanelWorkspaceLayoutV2ToV3Options,
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const surface = validatePanelWorkspacePlacementSurface(options.surfaceRect);
  if (!surface.ok) return surface;
  if (!isNonEmptyString(options.migrationId)) {
    return { ok: false, error: "Panel workspace migration id is empty" };
  }
  const rawFocusOrder = rawFloatingFocusOrder(input);
  const parsed = parsePanelWorkspaceLayoutV2(input, registry);
  if (!parsed.ok) return parsed;
  const layout = parsed.value;
  const solved = solvePanelWorkspaceLayoutV2(layout, registry, {
    workspaceRect: surface.value,
    railSizes: { left: 0, right: 0, bottom: 0 },
  });
  if (!solved.ok) return solved;

  const assignments = new Map<string, PanelWorkspacePlacementZone>();
  const occupied = new Set<PanelWorkspacePlacementZone>();
  const floatingEntries: FloatingMigrationEntry[] = [];
  layout.clusters.forEach((cluster, clusterIndex) => {
    if (cluster.anchor !== "floating") {
      const zone = PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL[cluster.anchor];
      assignments.set(cluster.id, zone);
      occupied.add(zone);
      return;
    }
    floatingEntries.push({
      cluster,
      clusterIndex,
      geometry: solvedClusterGeometry(cluster, solved.value, surface.value),
    });
  });

  const floatingById = new Map(
    floatingEntries.map((entry) => [entry.cluster.id, entry]),
  );
  const validFocus = rawFocusOrder.filter((clusterId) =>
    floatingById.has(clusterId),
  );
  const validFocusSet = new Set(validFocus);
  const priority = [
    ...[...validFocus]
      .reverse()
      .map((clusterId) => floatingById.get(clusterId)!),
    ...floatingEntries.filter((entry) => !validFocusSet.has(entry.cluster.id)),
  ];
  const overflow: FloatingMigrationEntry[] = [];
  for (const entry of priority) {
    const zone = nearestAvailableZone(entry.geometry, surface.value, occupied);
    if (zone === null) {
      overflow.push(entry);
      continue;
    }
    assignments.set(entry.cluster.id, zone);
    occupied.add(zone);
  }

  const outputClusters = layout.clusters.flatMap((cluster) => {
    const placementZone = assignments.get(cluster.id);
    return placementZone ? [cloneClusterAsV3(cluster, placementZone)] : [];
  });
  routeOverflowClusters(overflow, outputClusters, railMembership(layout));

  return normalizePanelWorkspaceLayoutV3(
    {
      version: PANEL_WORKSPACE_LAYOUT_V3_VERSION,
      migrationSource: { version: 2, migrationId: options.migrationId },
      visibility: { ...layout.visibility },
      railOrder: {
        left: [...layout.railOrder.left],
        right: [...layout.railOrder.right],
        bottom: [...layout.railOrder.bottom],
      },
      clusters: outputClusters,
      clusterFocusOrder: migrationFocusOrder(
        layout,
        rawFocusOrder,
        outputClusters,
      ),
    },
    registry,
    surface.value,
  );
}
