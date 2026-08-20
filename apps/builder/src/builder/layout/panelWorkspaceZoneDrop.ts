import type {
  PanelFrameGeometry,
  PanelId,
  PanelSnapEdge,
} from "../panels/core/types";
import {
  MAX_PANEL_WORKSPACE_COLUMNS,
  PANEL_WORKSPACE_GAP,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import {
  normalizePanelWorkspaceLayoutV3,
  PANEL_WORKSPACE_PLACEMENT_ZONES,
  solvePanelWorkspaceLayoutV3,
  type PanelWorkspaceClusterV3,
  type PanelWorkspaceLayoutV3,
  type PanelWorkspacePlacementZone,
  type PanelWorkspaceSolvedFrameGeometryV3,
} from "./panelWorkspaceLayoutV3";
import { PANEL_SNAP_THRESHOLD } from "./panelSnap";

export type PanelDropCandidate =
  | { kind: "panel-edge"; panelId: PanelId; edge: PanelSnapEdge }
  | { kind: "zone"; zone: PanelWorkspacePlacementZone }
  | null;

export interface PanelWorkspacePointerPosition {
  x: number;
  y: number;
}

export interface PanelWorkspaceDragSession {
  panelId: PanelId;
  baseLayout: PanelWorkspaceLayoutV3;
  previewGeometry: PanelFrameGeometry;
  candidate: PanelDropCandidate;
  candidateLayout: PanelWorkspaceLayoutV3;
  candidateFrameGeometries: ReadonlyMap<
    PanelId,
    PanelWorkspaceSolvedFrameGeometryV3
  >;
}

export interface PanelWorkspaceDragCommitResult {
  layout: PanelWorkspaceLayoutV3;
  committed: boolean;
  commitCount: 0 | 1;
  candidate: PanelDropCandidate;
  affectedPanelIds: readonly PanelId[];
}

interface PanelPlacementV3 {
  clusterIndex: number;
  columnIndex: number;
  rowIndex: number;
}

interface DetachedPanelV3 {
  layout: PanelWorkspaceLayoutV3;
  width: number;
  height: number;
  affectedPanelIds: PanelId[];
}

interface ScoredPanelCandidate {
  candidate: Exclude<PanelDropCandidate, null | { kind: "zone" }>;
  distance: number;
}

const PANEL_DROP_HYSTERESIS = 6;

function failure(error: string): PanelWorkspaceResult<never> {
  return { ok: false, error };
}

function cloneLayout(layout: PanelWorkspaceLayoutV3): PanelWorkspaceLayoutV3 {
  return {
    version: 3,
    ...(layout.migrationSource
      ? { migrationSource: { ...layout.migrationSource } }
      : {}),
    visibility: { ...layout.visibility },
    railOrder: {
      left: [...layout.railOrder.left],
      right: [...layout.railOrder.right],
      bottom: [...layout.railOrder.bottom],
    },
    clusters: layout.clusters.map((cluster) => ({
      id: cluster.id,
      placementZone: cluster.placementZone,
      ...(cluster.originOffset
        ? { originOffset: { ...cluster.originOffset } }
        : {}),
      columns: cluster.columns.map((column) => ({
        id: column.id,
        width: column.width,
        rows: column.rows.map((row) => ({ ...row })),
      })),
    })),
    clusterFocusOrder: [...layout.clusterFocusOrder],
  };
}

function findPlacement(
  layout: PanelWorkspaceLayoutV3,
  panelId: PanelId,
): PanelPlacementV3 | null {
  for (
    let clusterIndex = 0;
    clusterIndex < layout.clusters.length;
    clusterIndex += 1
  ) {
    const cluster = layout.clusters[clusterIndex];
    if (!cluster) continue;
    for (
      let columnIndex = 0;
      columnIndex < cluster.columns.length;
      columnIndex += 1
    ) {
      const column = cluster.columns[columnIndex];
      const rowIndex =
        column?.rows.findIndex((row) => row.panelId === panelId) ?? -1;
      if (rowIndex >= 0) return { clusterIndex, columnIndex, rowIndex };
    }
  }
  return null;
}

function panelIdsInCluster(cluster: PanelWorkspaceClusterV3): PanelId[] {
  return cluster.columns.flatMap((column) =>
    column.rows.map((row) => row.panelId),
  );
}

const registryLookupCache = new WeakMap<
  readonly PanelWorkspaceRegistryEntry[],
  ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>
>();

function registryEntry(
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
): PanelWorkspaceRegistryEntry | null {
  let lookup = registryLookupCache.get(registry);
  if (!lookup) {
    lookup = new Map(registry.map((entry) => [entry.id, entry]));
    registryLookupCache.set(registry, lookup);
  }
  return lookup.get(panelId) ?? null;
}

function visibleRowIndexes(
  layout: PanelWorkspaceLayoutV3,
  clusterIndex: number,
  columnIndex: number,
): number[] {
  const column = layout.clusters[clusterIndex]?.columns[columnIndex];
  if (!column) return [];
  return column.rows.flatMap((row, rowIndex) =>
    layout.visibility[row.panelId] === true ? [rowIndex] : [],
  );
}

function visibleColumnIndexes(
  layout: PanelWorkspaceLayoutV3,
  clusterIndex: number,
): number[] {
  const cluster = layout.clusters[clusterIndex];
  if (!cluster) return [];
  return cluster.columns.flatMap((column, columnIndex) =>
    column.rows.some((row) => layout.visibility[row.panelId] === true)
      ? [columnIndex]
      : [],
  );
}

function railSideForPanel(
  layout: PanelWorkspaceLayoutV3,
  panelId: PanelId,
): "left" | "right" | "bottom" | null {
  for (const side of ["left", "right", "bottom"] as const) {
    if (layout.railOrder[side].includes(panelId)) return side;
  }
  return null;
}

function rowEdgeFits(
  session: PanelWorkspaceDragSession,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  placement: PanelPlacementV3,
): boolean {
  const sourceEntry = registryEntry(registry, session.panelId);
  const column =
    session.candidateLayout.clusters[placement.clusterIndex]?.columns[
      placement.columnIndex
    ];
  if (!sourceEntry || !column) return false;
  const visibleRows = column.rows.filter(
    (row) => session.candidateLayout.visibility[row.panelId] === true,
  );
  const minimumHeight =
    visibleRows.reduce(
      (sum, row) =>
        sum + (registryEntry(registry, row.panelId)?.minHeight ?? 0),
      sourceEntry.minHeight,
    ) +
    PANEL_WORKSPACE_GAP * visibleRows.length;
  return minimumHeight <= surfaceRect.height;
}

function columnEdgeFits(
  session: PanelWorkspaceDragSession,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  placement: PanelPlacementV3,
): boolean {
  const sourceEntry = registryEntry(registry, session.panelId);
  const cluster = session.candidateLayout.clusters[placement.clusterIndex];
  if (
    !sourceEntry ||
    !cluster ||
    cluster.columns.length >= MAX_PANEL_WORKSPACE_COLUMNS
  ) {
    return false;
  }
  const visibleColumns = visibleColumnIndexes(
    session.candidateLayout,
    placement.clusterIndex,
  );
  const minimumWidth =
    visibleColumns.reduce((sum, columnIndex) => {
      const column = cluster.columns[columnIndex];
      const minimum = Math.max(
        0,
        ...(column?.rows
          .filter(
            (row) => session.candidateLayout.visibility[row.panelId] === true,
          )
          .map((row) => registryEntry(registry, row.panelId)?.minWidth ?? 0) ??
          []),
      );
      return sum + minimum;
    }, sourceEntry.minWidth) +
    PANEL_WORKSPACE_GAP * visibleColumns.length;
  return minimumWidth <= surfaceRect.width;
}

function availableEdges(
  session: PanelWorkspaceDragSession,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  targetPanelId: PanelId,
): PanelSnapEdge[] {
  const placement = findPlacement(session.candidateLayout, targetPanelId);
  if (!placement) return [];
  const rows = visibleRowIndexes(
    session.candidateLayout,
    placement.clusterIndex,
    placement.columnIndex,
  );
  const columns = visibleColumnIndexes(
    session.candidateLayout,
    placement.clusterIndex,
  );
  const edges: PanelSnapEdge[] = [];
  if (
    rows[0] === placement.rowIndex &&
    rowEdgeFits(session, registry, surfaceRect, placement)
  ) {
    edges.push("top");
  }
  if (
    rows.at(-1) === placement.rowIndex &&
    rowEdgeFits(session, registry, surfaceRect, placement)
  ) {
    edges.push("bottom");
  }
  if (
    columns[0] === placement.columnIndex &&
    columnEdgeFits(session, registry, surfaceRect, placement)
  ) {
    edges.push("left");
  }
  if (
    columns.at(-1) === placement.columnIndex &&
    columnEdgeFits(session, registry, surfaceRect, placement)
  ) {
    edges.push("right");
  }
  return edges;
}

function pointerEdgeDistance(
  pointer: PanelWorkspacePointerPosition,
  target: PanelFrameGeometry,
  edge: PanelSnapEdge,
): number {
  const horizontal = edge === "top" || edge === "bottom";
  const axisDistance = horizontal
    ? Math.abs(
        pointer.y - (edge === "top" ? target.y : target.y + target.height),
      )
    : Math.abs(
        pointer.x - (edge === "left" ? target.x : target.x + target.width),
      );
  const crossStart = horizontal ? target.x : target.y;
  const crossEnd = horizontal
    ? target.x + target.width
    : target.y + target.height;
  const crossPoint = horizontal ? pointer.x : pointer.y;
  const crossAxisDistance = Math.max(
    0,
    crossStart - crossPoint,
    crossPoint - crossEnd,
  );
  return Math.hypot(axisDistance, crossAxisDistance);
}

function resolvePanelEdgeCandidate(
  session: PanelWorkspaceDragSession,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  pointer: PanelWorkspacePointerPosition,
): ScoredPanelCandidate | null {
  let closest: ScoredPanelCandidate | null = null;
  for (const [panelId, target] of session.candidateFrameGeometries) {
    if (panelId === session.panelId) continue;
    for (const edge of availableEdges(
      session,
      registry,
      surfaceRect,
      panelId,
    )) {
      const distance = pointerEdgeDistance(pointer, target, edge);
      const isCurrent =
        session.candidate?.kind === "panel-edge" &&
        session.candidate.panelId === panelId &&
        session.candidate.edge === edge;
      const limit =
        PANEL_SNAP_THRESHOLD + (isCurrent ? PANEL_DROP_HYSTERESIS : 0);
      if (distance > limit) continue;
      if (closest && closest.distance <= distance) continue;
      closest = {
        candidate: { kind: "panel-edge", panelId, edge },
        distance,
      };
    }
  }
  return closest;
}

function zoneForPoint(
  surfaceRect: PanelWorkspaceRect,
  pointer: PanelWorkspacePointerPosition,
): PanelWorkspacePlacementZone | null {
  if (
    !Number.isFinite(pointer.x) ||
    !Number.isFinite(pointer.y) ||
    pointer.x < 0 ||
    pointer.y < 0 ||
    pointer.x > surfaceRect.width ||
    pointer.y > surfaceRect.height
  ) {
    return null;
  }
  const column = Math.min(2, Math.floor((pointer.x * 3) / surfaceRect.width));
  const row = Math.min(2, Math.floor((pointer.y * 3) / surfaceRect.height));
  const zone = PANEL_WORKSPACE_PLACEMENT_ZONES[row * 3 + column] ?? null;
  return zone === "center" ? null : zone;
}

function zoneIsAvailable(
  layout: PanelWorkspaceLayoutV3,
  zone: PanelWorkspacePlacementZone,
): boolean {
  const cluster = layout.clusters.find(
    (candidate) => candidate.placementZone === zone,
  );
  return (
    !cluster ||
    !cluster.columns.some((column) =>
      column.rows.some((row) => layout.visibility[row.panelId] === true),
    )
  );
}

function pointInsideExpandedZone(
  surfaceRect: PanelWorkspaceRect,
  pointer: PanelWorkspacePointerPosition,
  zone: PanelWorkspacePlacementZone,
): boolean {
  const zoneIndex = PANEL_WORKSPACE_PLACEMENT_ZONES.indexOf(zone);
  const column = zoneIndex % 3;
  const row = Math.floor(zoneIndex / 3);
  const left = (surfaceRect.width * column) / 3 - PANEL_DROP_HYSTERESIS;
  const right = (surfaceRect.width * (column + 1)) / 3 + PANEL_DROP_HYSTERESIS;
  const top = (surfaceRect.height * row) / 3 - PANEL_DROP_HYSTERESIS;
  const bottom = (surfaceRect.height * (row + 1)) / 3 + PANEL_DROP_HYSTERESIS;
  return (
    pointer.x >= left &&
    pointer.x <= right &&
    pointer.y >= top &&
    pointer.y <= bottom
  );
}

function resolveZoneCandidate(
  session: PanelWorkspaceDragSession,
  surfaceRect: PanelWorkspaceRect,
  pointer: PanelWorkspacePointerPosition,
): PanelDropCandidate {
  if (
    session.candidate?.kind === "zone" &&
    zoneIsAvailable(session.candidateLayout, session.candidate.zone) &&
    pointInsideExpandedZone(surfaceRect, pointer, session.candidate.zone)
  ) {
    return session.candidate;
  }
  const zone = zoneForPoint(surfaceRect, pointer);
  return zone && zoneIsAvailable(session.candidateLayout, zone)
    ? { kind: "zone", zone }
    : null;
}

function detachPanel(
  layout: PanelWorkspaceLayoutV3,
  panelId: PanelId,
): PanelWorkspaceResult<DetachedPanelV3> {
  const next = cloneLayout(layout);
  const placement = findPlacement(next, panelId);
  if (!placement) return failure(`Panel "${panelId}" has no placement`);
  const cluster = next.clusters[placement.clusterIndex];
  const column = cluster?.columns[placement.columnIndex];
  const row = column?.rows[placement.rowIndex];
  if (!cluster || !column || !row) {
    return failure(`Panel "${panelId}" placement is invalid`);
  }
  const affectedPanelIds = panelIdsInCluster(cluster);
  const width = column.width;
  const height = row.height;
  column.rows.splice(placement.rowIndex, 1);
  if (column.rows.length === 0)
    cluster.columns.splice(placement.columnIndex, 1);
  if (cluster.columns.length === 0) {
    next.clusters.splice(placement.clusterIndex, 1);
    next.clusterFocusOrder = next.clusterFocusOrder.filter(
      (clusterId) => clusterId !== cluster.id,
    );
  }
  return {
    ok: true,
    value: { layout: next, width, height, affectedPanelIds },
  };
}

function uniqueClusterId(layout: PanelWorkspaceLayoutV3, base: string): string {
  const used = new Set(layout.clusters.map((cluster) => cluster.id));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}#${suffix}`)) suffix += 1;
  return `${base}#${suffix}`;
}

function insertPanelEdge(
  detached: DetachedPanelV3,
  session: PanelWorkspaceDragSession,
  candidate: Exclude<PanelDropCandidate, null | { kind: "zone" }>,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<readonly PanelId[]> {
  const targetPlacement = findPlacement(detached.layout, candidate.panelId);
  if (!targetPlacement) return failure("Panel edge target is unavailable");
  const targetCluster = detached.layout.clusters[targetPlacement.clusterIndex];
  const targetColumn = targetCluster?.columns[targetPlacement.columnIndex];
  if (!targetCluster || !targetColumn) {
    return failure("Panel edge target placement is invalid");
  }
  const allowed = availableEdges(
    session,
    registry,
    surfaceRect,
    candidate.panelId,
  );
  if (!allowed.includes(candidate.edge)) {
    return failure("Panel edge target is no longer available");
  }
  const beforePanelIds = panelIdsInCluster(targetCluster);
  if (candidate.edge === "top" || candidate.edge === "bottom") {
    const insertIndex =
      targetPlacement.rowIndex + (candidate.edge === "bottom" ? 1 : 0);
    targetColumn.rows.splice(insertIndex, 0, {
      panelId: session.panelId,
      height: detached.height,
    });
  } else {
    if (targetCluster.columns.length >= MAX_PANEL_WORKSPACE_COLUMNS) {
      return failure("Panel clusters support at most two columns");
    }
    const insertIndex =
      targetPlacement.columnIndex + (candidate.edge === "right" ? 1 : 0);
    targetCluster.columns.splice(insertIndex, 0, {
      id: `${targetCluster.id}:column:${session.panelId}`,
      width: detached.width,
      rows: [{ panelId: session.panelId, height: detached.height }],
    });
  }
  return {
    ok: true,
    value: [...beforePanelIds, ...panelIdsInCluster(targetCluster)],
  };
}

function insertPanelInZone(
  detached: DetachedPanelV3,
  session: PanelWorkspaceDragSession,
  zone: PanelWorkspacePlacementZone,
): readonly PanelId[] {
  const layout = detached.layout;
  let cluster = layout.clusters.find(
    (candidate) => candidate.placementZone === zone,
  );
  if (!cluster) {
    const clusterId = uniqueClusterId(layout, `zone:${zone}`);
    cluster = {
      id: clusterId,
      placementZone: zone,
      columns: [
        {
          id: `${clusterId}:column:0`,
          width: detached.width,
          rows: [{ panelId: session.panelId, height: detached.height }],
        },
      ],
    };
    layout.clusters.push(cluster);
  } else {
    // A zone drop establishes the zone's canonical origin; do not inherit a
    // previous resize displacement from a hidden/empty cluster.
    delete cluster.originOffset;
    const side = railSideForPanel(layout, session.panelId);
    const columnIndex =
      side === "left" ? Math.max(0, cluster.columns.length - 1) : 0;
    let column = cluster.columns[columnIndex];
    if (!column) {
      column = {
        id: `${cluster.id}:column:${columnIndex}`,
        width: detached.width,
        rows: [],
      };
      cluster.columns[columnIndex] = column;
    }
    column.width = Math.max(column.width, detached.width);
    column.rows.unshift({
      panelId: session.panelId,
      height: detached.height,
    });
  }
  layout.clusterFocusOrder = [
    ...layout.clusterFocusOrder.filter((clusterId) => clusterId !== cluster.id),
    cluster.id,
  ];
  return panelIdsInCluster(cluster);
}

export function beginPanelWorkspaceDragSession(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  panelId: PanelId,
): PanelWorkspaceResult<PanelWorkspaceDragSession> {
  const baseSolved = solvePanelWorkspaceLayoutV3(layout, registry, surfaceRect);
  if (!baseSolved.ok) return baseSolved;
  const previewGeometry = baseSolved.value.frameGeometries.get(panelId);
  if (!previewGeometry) return failure(`Panel "${panelId}" is not visible`);

  const candidateInput = cloneLayout(baseSolved.value.layout);
  candidateInput.visibility[panelId] = false;
  const candidateSolved = solvePanelWorkspaceLayoutV3(
    candidateInput,
    registry,
    surfaceRect,
  );
  if (!candidateSolved.ok) return candidateSolved;
  return {
    ok: true,
    value: {
      panelId,
      baseLayout: cloneLayout(baseSolved.value.layout),
      previewGeometry: {
        x: previewGeometry.x,
        y: previewGeometry.y,
        width: previewGeometry.width,
        height: previewGeometry.height,
      },
      candidate: null,
      candidateLayout: candidateSolved.value.layout,
      candidateFrameGeometries: candidateSolved.value.frameGeometries,
    },
  };
}

export function updatePanelWorkspaceDragSession(
  session: PanelWorkspaceDragSession,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  previewGeometry: PanelFrameGeometry,
  pointer: PanelWorkspacePointerPosition,
): PanelWorkspaceResult<PanelWorkspaceDragSession> {
  if (
    !Number.isFinite(previewGeometry.x) ||
    !Number.isFinite(previewGeometry.y) ||
    !Number.isFinite(previewGeometry.width) ||
    !Number.isFinite(previewGeometry.height) ||
    previewGeometry.width <= 0 ||
    previewGeometry.height <= 0
  ) {
    return failure("Panel drag preview geometry is invalid");
  }
  const next = { ...session, previewGeometry: { ...previewGeometry } };
  const panelCandidate = resolvePanelEdgeCandidate(
    next,
    registry,
    surfaceRect,
    pointer,
  );
  return {
    ok: true,
    value: {
      ...next,
      candidate:
        panelCandidate?.candidate ??
        resolveZoneCandidate(next, surfaceRect, pointer),
    },
  };
}

export function commitPanelWorkspaceDragSession(
  session: PanelWorkspaceDragSession,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceDragCommitResult> {
  if (session.candidate === null) {
    return {
      ok: true,
      value: {
        layout: session.baseLayout,
        committed: false,
        commitCount: 0,
        candidate: null,
        affectedPanelIds: [],
      },
    };
  }
  const detached = detachPanel(session.baseLayout, session.panelId);
  if (!detached.ok) return detached;
  let targetPanelIds: readonly PanelId[];
  if (session.candidate.kind === "panel-edge") {
    const inserted = insertPanelEdge(
      detached.value,
      session,
      session.candidate,
      registry,
      surfaceRect,
    );
    if (!inserted.ok) {
      return {
        ok: true,
        value: {
          layout: session.baseLayout,
          committed: false,
          commitCount: 0,
          candidate: null,
          affectedPanelIds: [],
        },
      };
    }
    targetPanelIds = inserted.value;
  } else {
    if (!zoneIsAvailable(session.candidateLayout, session.candidate.zone)) {
      return {
        ok: true,
        value: {
          layout: session.baseLayout,
          committed: false,
          commitCount: 0,
          candidate: null,
          affectedPanelIds: [],
        },
      };
    }
    targetPanelIds = insertPanelInZone(
      detached.value,
      session,
      session.candidate.zone,
    );
  }
  detached.value.layout.visibility[session.panelId] = true;
  const normalized = normalizePanelWorkspaceLayoutV3(
    detached.value.layout,
    registry,
    surfaceRect,
  );
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    value: {
      layout: normalized.value,
      committed: true,
      commitCount: 1,
      candidate: session.candidate,
      affectedPanelIds: [
        ...new Set([
          ...detached.value.affectedPanelIds,
          ...targetPanelIds,
          session.panelId,
        ]),
      ],
    },
  };
}
