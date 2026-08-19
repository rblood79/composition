import type { PanelId, PanelResizeEdge } from "../panels/core/types";
import {
  MAX_PANEL_WORKSPACE_COLUMNS,
  PANEL_WORKSPACE_GAP,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import {
  createDefaultPanelWorkspaceLayoutV3,
  normalizePanelWorkspaceLayoutV3,
  PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL,
  type PanelWorkspaceClusterV3,
  type PanelWorkspaceColumnV3,
  type PanelWorkspaceLayoutV3,
  type PanelWorkspaceRowV3,
} from "./panelWorkspaceLayoutV3";

export interface PanelWorkspacePolicyResultV3 {
  layout: PanelWorkspaceLayoutV3;
  affectedPanelIds: PanelId[];
}

interface PanelPlacementV3 {
  clusterIndex: number;
  columnIndex: number;
  rowIndex: number;
}

function failure(error: string): PanelWorkspaceResult<never> {
  return { ok: false, error };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
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
      const rowIndex =
        cluster.columns[columnIndex]?.rows.findIndex(
          (row) => row.panelId === panelId,
        ) ?? -1;
      if (rowIndex >= 0) return { clusterIndex, columnIndex, rowIndex };
    }
  }
  return null;
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

function registryEntry(
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
): PanelWorkspaceRegistryEntry | null {
  return registry.find((entry) => entry.id === panelId) ?? null;
}

function panelIdsInCluster(cluster: PanelWorkspaceClusterV3): PanelId[] {
  return cluster.columns.flatMap((column) =>
    column.rows.map((row) => row.panelId),
  );
}

function visibleColumnHeight(
  layout: PanelWorkspaceLayoutV3,
  column: PanelWorkspaceColumnV3,
): number {
  const rows = column.rows.filter(
    (row) => layout.visibility[row.panelId] === true,
  );
  return (
    rows.reduce((sum, row) => sum + row.height, 0) +
    PANEL_WORKSPACE_GAP * Math.max(0, rows.length - 1)
  );
}

function columnCanFit(
  layout: PanelWorkspaceLayoutV3,
  column: PanelWorkspaceColumnV3,
  row: PanelWorkspaceRowV3,
  surfaceRect: PanelWorkspaceRect,
): boolean {
  const visibleRows = column.rows.filter(
    (candidate) => layout.visibility[candidate.panelId] === true,
  );
  return (
    visibleRows.reduce((sum, candidate) => sum + candidate.height, 0) +
      row.height +
      PANEL_WORKSPACE_GAP * visibleRows.length <=
    surfaceRect.height
  );
}

function normalizeResult(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  affectedPanelIds: readonly PanelId[],
): PanelWorkspaceResult<PanelWorkspacePolicyResultV3> {
  const normalized = normalizePanelWorkspaceLayoutV3(
    layout,
    registry,
    surfaceRect,
  );
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    value: {
      layout: normalized.value,
      affectedPanelIds: [...new Set(affectedPanelIds)],
    },
  };
}

function placeOverflowRow(
  layout: PanelWorkspaceLayoutV3,
  cluster: PanelWorkspaceClusterV3,
  placement: PanelPlacementV3,
  side: "left" | "right",
  surfaceRect: PanelWorkspaceRect,
): void {
  const sourceColumn = cluster.columns[placement.columnIndex];
  const row = sourceColumn?.rows[placement.rowIndex];
  if (!sourceColumn || !row) return;
  if (visibleColumnHeight(layout, sourceColumn) <= surfaceRect.height) return;

  sourceColumn.rows.splice(placement.rowIndex, 1);
  const sourceWidth = sourceColumn.width;
  const orderedColumns =
    side === "left" ? [...cluster.columns] : [...cluster.columns].reverse();
  const target = orderedColumns.find(
    (column) =>
      column !== sourceColumn && columnCanFit(layout, column, row, surfaceRect),
  );
  if (target) {
    target.rows.push(row);
    target.width = Math.max(target.width, sourceWidth);
    return;
  }

  if (cluster.columns.length < MAX_PANEL_WORKSPACE_COLUMNS) {
    const column: PanelWorkspaceColumnV3 = {
      id: `${cluster.id}:column:${row.panelId}`,
      width: sourceWidth,
      rows: [row],
    };
    if (side === "left") cluster.columns.push(column);
    else cluster.columns.unshift(column);
    return;
  }

  sourceColumn.rows.splice(placement.rowIndex, 0, row);
}

export function activatePanelWorkspacePanelV3(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspacePolicyResultV3> {
  if (!registryEntry(registry, panelId)) {
    return failure(`Unknown panel "${panelId}"`);
  }
  const normalized = normalizePanelWorkspaceLayoutV3(
    layout,
    registry,
    surfaceRect,
  );
  if (!normalized.ok) return normalized;
  const next = cloneLayout(normalized.value);
  const placement = findPlacement(next, panelId);
  if (!placement) return failure(`Panel "${panelId}" has no placement`);
  const cluster = next.clusters[placement.clusterIndex];
  if (!cluster) return failure(`Panel "${panelId}" placement is invalid`);
  const affected = panelIdsInCluster(cluster);

  if (next.visibility[panelId] === true) {
    next.visibility[panelId] = false;
    return normalizeResult(next, registry, surfaceRect, affected);
  }

  const entry = registryEntry(registry, panelId);
  const column = cluster.columns[placement.columnIndex];
  const columnHasVisiblePanel = column?.rows.some(
    (row) => next.visibility[row.panelId] === true,
  );
  if (entry && column && !columnHasVisiblePanel) {
    column.width = entry.defaultWidth;
  }
  next.visibility[panelId] = true;
  const side = railSideForPanel(next, panelId);
  if (
    (side === "left" || side === "right") &&
    cluster.placementZone === PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL[side]
  ) {
    placeOverflowRow(next, cluster, placement, side, surfaceRect);
  }
  next.clusterFocusOrder = [
    ...next.clusterFocusOrder.filter((clusterId) => clusterId !== cluster.id),
    cluster.id,
  ];
  return normalizeResult(next, registry, surfaceRect, affected);
}

export function resetPanelWorkspaceLayoutV3(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspacePolicyResultV3> {
  const reset = createDefaultPanelWorkspaceLayoutV3(
    registry,
    surfaceRect,
    layout.visibility,
  );
  if (!reset.ok) return reset;
  return {
    ok: true,
    value: {
      layout: reset.value,
      affectedPanelIds: registry.map((entry) => entry.id),
    },
  };
}

function visibleRowNeighbor(
  column: PanelWorkspaceColumnV3,
  rowIndex: number,
  direction: -1 | 1,
  visibility: Partial<Record<PanelId, boolean>>,
): PanelWorkspaceRowV3 | undefined {
  for (
    let index = rowIndex + direction;
    index >= 0 && index < column.rows.length;
    index += direction
  ) {
    const candidate = column.rows[index];
    if (candidate && visibility[candidate.panelId] === true) return candidate;
  }
  return undefined;
}

function visibleColumnNeighbor(
  cluster: PanelWorkspaceClusterV3,
  columnIndex: number,
  direction: -1 | 1,
  visibility: Partial<Record<PanelId, boolean>>,
): PanelWorkspaceColumnV3 | undefined {
  for (
    let index = columnIndex + direction;
    index >= 0 && index < cluster.columns.length;
    index += direction
  ) {
    const candidate = cluster.columns[index];
    if (candidate?.rows.some((row) => visibility[row.panelId] === true)) {
      return candidate;
    }
  }
  return undefined;
}

function rowBounds(
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
  surfaceRect: PanelWorkspaceRect,
): { min: number; max: number } | null {
  const entry = registryEntry(registry, panelId);
  if (!entry) return null;
  const min = Math.min(entry.minHeight, surfaceRect.height);
  return {
    min,
    // 패널 height는 surface가 허용하는 브라우저 높이까지 확장 가능해야 한다.
    // PanelConfig.maxHeight는 콘텐츠 기본 크기 메타데이터이며 workspace resize 상한이 아니다.
    max: surfaceRect.height,
  };
}

function columnBounds(
  registry: readonly PanelWorkspaceRegistryEntry[],
  column: PanelWorkspaceColumnV3,
  visibility: Partial<Record<PanelId, boolean>>,
  surfaceRect: PanelWorkspaceRect,
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
  const min = Math.min(
    Math.max(...entries.map((entry) => entry.minWidth)),
    surfaceRect.width,
  );
  return {
    min,
    max: Math.max(
      min,
      Math.min(surfaceRect.width, ...entries.map((entry) => entry.maxWidth)),
    ),
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

export function resizePanelWorkspaceBoundaryV3(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  panelId: PanelId,
  edge: PanelResizeEdge,
  deltaX: number,
  deltaY: number,
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspacePolicyResultV3> {
  const normalized = normalizePanelWorkspaceLayoutV3(
    layout,
    registry,
    surfaceRect,
  );
  if (!normalized.ok) return normalized;
  const next = cloneLayout(normalized.value);
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
    const neighbor = visibleRowNeighbor(
      column,
      placement.rowIndex,
      edge === "top" ? -1 : 1,
      next.visibility,
    );
    const sourceBounds = rowBounds(registry, panelId, surfaceRect);
    if (!sourceBounds) return failure(`Unknown panel "${panelId}"`);
    if (neighbor) {
      const neighborBounds = rowBounds(registry, neighbor.panelId, surfaceRect);
      if (!neighborBounds) {
        return failure(`Unknown panel "${neighbor.panelId}"`);
      }
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
      const visibleOthers = column.rows.filter(
        (candidate) =>
          candidate !== row && next.visibility[candidate.panelId] === true,
      );
      const available =
        surfaceRect.height -
        visibleOthers.reduce((sum, candidate) => sum + candidate.height, 0) -
        PANEL_WORKSPACE_GAP * visibleOthers.length;
      const maximum = Math.max(
        sourceBounds.min,
        Math.min(sourceBounds.max, available),
      );
      const signedDelta = edge === "top" ? -deltaY : deltaY;
      row.height = clamp(row.height + signedDelta, sourceBounds.min, maximum);
    }
  } else {
    const neighbor = visibleColumnNeighbor(
      cluster,
      placement.columnIndex,
      edge === "left" ? -1 : 1,
      next.visibility,
    );
    const sourceBounds = columnBounds(
      registry,
      column,
      next.visibility,
      surfaceRect,
    );
    if (!sourceBounds) {
      return failure(`Column for "${panelId}" has no panels`);
    }
    if (neighbor) {
      const neighborBounds = columnBounds(
        registry,
        neighbor,
        next.visibility,
        surfaceRect,
      );
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
      affected.push(
        ...before.rows.map((candidate) => candidate.panelId),
        ...after.rows.map((candidate) => candidate.panelId),
      );
    } else {
      const visibleOthers = cluster.columns.filter(
        (candidate) =>
          candidate !== column &&
          candidate.rows.some(
            (candidateRow) => next.visibility[candidateRow.panelId] === true,
          ),
      );
      const available =
        surfaceRect.width -
        visibleOthers.reduce((sum, candidate) => sum + candidate.width, 0) -
        PANEL_WORKSPACE_GAP * visibleOthers.length;
      const maximum = Math.max(
        sourceBounds.min,
        Math.min(sourceBounds.max, available),
      );
      const signedDelta = edge === "left" ? -deltaX : deltaX;
      column.width = clamp(
        column.width + signedDelta,
        sourceBounds.min,
        maximum,
      );
      affected.push(...column.rows.map((candidate) => candidate.panelId));
    }
  }

  return normalizeResult(next, registry, surfaceRect, affected);
}
