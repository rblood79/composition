import type {
  PanelFrameGeometry,
  PanelId,
  PanelResizeEdge,
  PanelSide,
  PanelSize,
  PanelSnapEdge,
} from "../panels/core/types";
import {
  normalizePanelWorkspaceLayoutV2,
  type PanelWorkspaceClusterV2,
  type PanelWorkspaceColumnV2,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";

export interface PanelWorkspaceInteractionResult {
  layout: PanelWorkspaceLayoutV2;
  affectedPanelIds: PanelId[];
}

interface PanelPlacement {
  clusterIndex: number;
  columnIndex: number;
  rowIndex: number;
}

interface DetachedPanel {
  layout: PanelWorkspaceLayoutV2;
  width: number;
  height: number;
  affectedPanelIds: PanelId[];
}

function failure(error: string): PanelWorkspaceResult<never> {
  return { ok: false, error };
}

function cloneLayout(layout: PanelWorkspaceLayoutV2): PanelWorkspaceLayoutV2 {
  return {
    version: 2,
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
      ...cluster,
      ...(cluster.anchor === "floating"
        ? { position: { ...cluster.position } }
        : {}),
      columns: cluster.columns.map((column) => ({
        ...column,
        rows: column.rows.map((row) => ({ ...row })),
      })),
    })) as PanelWorkspaceClusterV2[],
    floatingFocusOrder: [...layout.floatingFocusOrder],
  };
}

function findPlacement(
  layout: PanelWorkspaceLayoutV2,
  panelId: PanelId,
): PanelPlacement | null {
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

function panelIdsInCluster(cluster: PanelWorkspaceClusterV2): PanelId[] {
  return cluster.columns.flatMap((column) =>
    column.rows.map((row) => row.panelId),
  );
}

function uniquePanelIds(panelIds: readonly PanelId[]): PanelId[] {
  return [...new Set(panelIds)];
}

function registryEntry(
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
): PanelWorkspaceRegistryEntry | null {
  return registry.find((entry) => entry.id === panelId) ?? null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

function normalizeResult(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  affectedPanelIds: readonly PanelId[],
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  const normalized = normalizePanelWorkspaceLayoutV2(layout, registry);
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    value: {
      layout: normalized.value,
      affectedPanelIds: uniquePanelIds(affectedPanelIds),
    },
  };
}

function detachPanel(
  layout: PanelWorkspaceLayoutV2,
  panelId: PanelId,
): PanelWorkspaceResult<DetachedPanel> {
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
    next.floatingFocusOrder = next.floatingFocusOrder.filter(
      (clusterId) => clusterId !== cluster.id,
    );
  }
  return {
    ok: true,
    value: { layout: next, width, height, affectedPanelIds },
  };
}

function uniqueClusterId(layout: PanelWorkspaceLayoutV2, base: string): string {
  const used = new Set(layout.clusters.map((cluster) => cluster.id));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}#${suffix}`)) suffix += 1;
  return `${base}#${suffix}`;
}

export function detachPanelToFloatingCluster(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
  geometry: PanelFrameGeometry,
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  const entry = registryEntry(registry, panelId);
  if (!entry) return failure(`Unknown panel "${panelId}"`);
  const detached = detachPanel(layout, panelId);
  if (!detached.ok) return detached;
  const { layout: next } = detached.value;
  const clusterId = uniqueClusterId(next, `floating:${panelId}`);
  next.clusters.push({
    id: clusterId,
    anchor: "floating",
    position: {
      x: Number.isFinite(geometry.x) ? geometry.x : 0,
      y: Number.isFinite(geometry.y) ? geometry.y : 0,
    },
    columns: [
      {
        id: `${clusterId}:column:0`,
        width: clamp(geometry.width, entry.minWidth, entry.maxWidth),
        rows: [
          {
            panelId,
            height: clamp(geometry.height, entry.minHeight, entry.maxHeight),
          },
        ],
      },
    ],
  });
  next.floatingFocusOrder = [
    ...next.floatingFocusOrder.filter((id) => id !== clusterId),
    clusterId,
  ];
  next.visibility[panelId] = true;
  return normalizeResult(next, registry, [
    ...detached.value.affectedPanelIds,
    panelId,
  ]);
}

export function snapPanelWorkspacePanel(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  sourcePanelId: PanelId,
  targetPanelId: PanelId,
  edge: PanelSnapEdge,
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  if (sourcePanelId === targetPanelId) {
    return failure("A panel cannot snap to itself");
  }
  const detached = detachPanel(layout, sourcePanelId);
  if (!detached.ok) return detached;
  const next = detached.value.layout;
  const targetPlacement = findPlacement(next, targetPanelId);
  if (!targetPlacement) {
    return failure(`Target panel "${targetPanelId}" has no placement`);
  }
  const targetCluster = next.clusters[targetPlacement.clusterIndex];
  const targetColumn = targetCluster?.columns[targetPlacement.columnIndex];
  if (!targetCluster || !targetColumn) {
    return failure(`Target panel "${targetPanelId}" placement is invalid`);
  }
  const beforePanelIds = panelIdsInCluster(targetCluster);
  if (edge === "top" || edge === "bottom") {
    const insertIndex = targetPlacement.rowIndex + (edge === "bottom" ? 1 : 0);
    targetColumn.rows.splice(insertIndex, 0, {
      panelId: sourcePanelId,
      height: detached.value.height,
    });
  } else {
    if (targetCluster.columns.length >= 2) {
      return failure("Panel clusters support at most two columns");
    }
    const insertIndex =
      targetPlacement.columnIndex + (edge === "right" ? 1 : 0);
    targetCluster.columns.splice(insertIndex, 0, {
      id: `${targetCluster.id}:column:${sourcePanelId}`,
      width: detached.value.width,
      rows: [{ panelId: sourcePanelId, height: detached.value.height }],
    });
  }
  next.visibility[sourcePanelId] = true;
  return normalizeResult(next, registry, [
    ...detached.value.affectedPanelIds,
    ...beforePanelIds,
    ...panelIdsInCluster(targetCluster),
  ]);
}

function rowBounds(
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
): { min: number; max: number } | null {
  const entry = registryEntry(registry, panelId);
  return entry ? { min: entry.minHeight, max: entry.maxHeight } : null;
}

function columnBounds(
  registry: readonly PanelWorkspaceRegistryEntry[],
  column: PanelWorkspaceColumnV2,
  visibility: Partial<Record<PanelId, boolean>>,
): { min: number; max: number } | null {
  const visibleRows = column.rows.filter(
    (row) => visibility[row.panelId] === true,
  );
  const rows = visibleRows.length > 0 ? visibleRows : column.rows.slice(0, 1);
  const entries = rows.flatMap((row) => {
    const entry = registryEntry(registry, row.panelId);
    return entry ? [entry] : [];
  });
  if (entries.length === 0) return null;
  const min = Math.max(...entries.map((entry) => entry.minWidth));
  return {
    min,
    max: Math.max(min, Math.min(...entries.map((entry) => entry.maxWidth))),
  };
}

function pairedDelta(
  requested: number,
  beforeSize: number,
  beforeBounds: { min: number; max: number },
  afterSize: number,
  afterBounds: { min: number; max: number },
): number {
  const minimum = Math.max(
    beforeBounds.min - beforeSize,
    afterSize - afterBounds.max,
  );
  const maximum = Math.min(
    beforeBounds.max - beforeSize,
    afterSize - afterBounds.min,
  );
  return clamp(requested, minimum, maximum);
}

export function resizePanelWorkspaceBoundary(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
  edge: PanelResizeEdge,
  deltaX: number,
  deltaY: number,
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  const next = cloneLayout(layout);
  const placement = findPlacement(next, panelId);
  if (!placement) return failure(`Panel "${panelId}" has no placement`);
  const cluster = next.clusters[placement.clusterIndex];
  const column = cluster?.columns[placement.columnIndex];
  const row = column?.rows[placement.rowIndex];
  if (!cluster || !column || !row) {
    return failure(`Panel "${panelId}" placement is invalid`);
  }
  const affected: PanelId[] = [panelId];

  if (edge === "top" || edge === "bottom") {
    const neighborIndex = placement.rowIndex + (edge === "top" ? -1 : 1);
    const neighbor = column.rows[neighborIndex];
    const sourceBounds = rowBounds(registry, panelId);
    if (!sourceBounds) return failure(`Unknown panel "${panelId}"`);
    if (neighbor) {
      const neighborBounds = rowBounds(registry, neighbor.panelId);
      if (!neighborBounds)
        return failure(`Unknown panel "${neighbor.panelId}"`);
      const before = edge === "top" ? neighbor : row;
      const beforeBounds = edge === "top" ? neighborBounds : sourceBounds;
      const after = edge === "top" ? row : neighbor;
      const afterBounds = edge === "top" ? sourceBounds : neighborBounds;
      const delta = pairedDelta(
        deltaY,
        before.height,
        beforeBounds,
        after.height,
        afterBounds,
      );
      before.height += delta;
      after.height -= delta;
      affected.push(neighbor.panelId);
    } else {
      const signedDelta = edge === "top" ? -deltaY : deltaY;
      const previousHeight = row.height;
      row.height = clamp(
        row.height + signedDelta,
        sourceBounds.min,
        sourceBounds.max,
      );
      if (cluster.anchor === "floating" && edge === "top") {
        cluster.position.y += previousHeight - row.height;
      }
    }
  } else {
    const neighborIndex = placement.columnIndex + (edge === "left" ? -1 : 1);
    const neighbor = cluster.columns[neighborIndex];
    const sourceBounds = columnBounds(registry, column, next.visibility);
    if (!sourceBounds) return failure(`Column for "${panelId}" has no panels`);
    if (neighbor) {
      const neighborBounds = columnBounds(registry, neighbor, next.visibility);
      if (!neighborBounds) return failure("Neighbor column has no panels");
      const before = edge === "left" ? neighbor : column;
      const beforeBounds = edge === "left" ? neighborBounds : sourceBounds;
      const after = edge === "left" ? column : neighbor;
      const afterBounds = edge === "left" ? sourceBounds : neighborBounds;
      const delta = pairedDelta(
        deltaX,
        before.width,
        beforeBounds,
        after.width,
        afterBounds,
      );
      before.width += delta;
      after.width -= delta;
      affected.push(...neighbor.rows.map((candidate) => candidate.panelId));
      affected.push(...column.rows.map((candidate) => candidate.panelId));
    } else {
      const signedDelta = edge === "left" ? -deltaX : deltaX;
      const previousWidth = column.width;
      column.width = clamp(
        column.width + signedDelta,
        sourceBounds.min,
        sourceBounds.max,
      );
      if (cluster.anchor === "floating" && edge === "left") {
        cluster.position.x += previousWidth - column.width;
      }
      affected.push(...column.rows.map((candidate) => candidate.panelId));
    }
  }

  return normalizeResult(next, registry, affected);
}

export function setPanelWorkspacePanelVisibility(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
  visible: boolean,
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  if (!registryEntry(registry, panelId)) {
    return failure(`Unknown panel "${panelId}"`);
  }
  const next = cloneLayout(layout);
  next.visibility[panelId] = visible;
  return normalizeResult(next, registry, [panelId]);
}

export function movePanelWorkspacePanelToAnchor(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
  anchor: PanelSide,
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  const detached = detachPanel(layout, panelId);
  if (!detached.ok) return detached;
  const next = detached.value.layout;
  let targetCluster = next.clusters.find(
    (cluster) => cluster.anchor === anchor,
  );
  if (!targetCluster) {
    targetCluster = {
      id: uniqueClusterId(next, `anchor:${anchor}`),
      anchor,
      columns: [],
    };
    next.clusters.push(targetCluster);
  }
  const visibleColumns = targetCluster.columns.filter((column) =>
    column.rows.some((row) => next.visibility[row.panelId] === true),
  );
  let targetColumn = targetCluster.columns[0];
  if (
    anchor !== "bottom" &&
    visibleColumns.length > 0 &&
    targetCluster.columns.length < 2
  ) {
    targetColumn = {
      id: `${targetCluster.id}:column:${panelId}`,
      width: detached.value.width,
      rows: [],
    };
    targetCluster.columns.push(targetColumn);
  }
  if (!targetColumn) {
    targetColumn = {
      id: `${targetCluster.id}:column:0`,
      width: detached.value.width,
      rows: [],
    };
    targetCluster.columns.push(targetColumn);
  }
  targetColumn.rows.push({ panelId, height: detached.value.height });
  next.visibility[panelId] = true;
  for (const side of ["left", "right", "bottom"] as const) {
    next.railOrder[side] = next.railOrder[side].filter(
      (candidate) => candidate !== panelId,
    );
  }
  next.railOrder[anchor].push(panelId);
  return normalizeResult(next, registry, [
    ...detached.value.affectedPanelIds,
    ...panelIdsInCluster(targetCluster),
  ]);
}

export function updatePanelWorkspacePanelSize(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
  size: PanelSize,
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  const next = cloneLayout(layout);
  const placement = findPlacement(next, panelId);
  if (!placement) return failure(`Panel "${panelId}" has no placement`);
  const column =
    next.clusters[placement.clusterIndex]?.columns[placement.columnIndex];
  const row = column?.rows[placement.rowIndex];
  const entry = registryEntry(registry, panelId);
  if (!column || !row || !entry) return failure(`Unknown panel "${panelId}"`);
  const bounds = columnBounds(registry, column, next.visibility);
  if (!bounds) return failure(`Column for "${panelId}" has no panels`);
  column.width = clamp(size.width, bounds.min, bounds.max);
  row.height = clamp(size.height, entry.minHeight, entry.maxHeight);
  return normalizeResult(
    next,
    registry,
    column.rows.map((candidate) => candidate.panelId),
  );
}

export function focusPanelWorkspaceFloatingCluster(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  const next = cloneLayout(layout);
  const placement = findPlacement(next, panelId);
  const cluster =
    placement === null ? undefined : next.clusters[placement.clusterIndex];
  if (!cluster) return failure(`Panel "${panelId}" has no placement`);
  if (cluster.anchor === "floating") {
    next.floatingFocusOrder = [
      ...next.floatingFocusOrder.filter((id) => id !== cluster.id),
      cluster.id,
    ];
  }
  return normalizeResult(next, registry, panelIdsInCluster(cluster));
}

export function hidePanelWorkspaceFloatingClusters(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelWorkspaceResult<PanelWorkspaceInteractionResult> {
  const next = cloneLayout(layout);
  const affected = next.clusters
    .filter((cluster) => cluster.anchor === "floating")
    .flatMap(panelIdsInCluster);
  for (const panelId of affected) next.visibility[panelId] = false;
  return normalizeResult(next, registry, affected);
}
