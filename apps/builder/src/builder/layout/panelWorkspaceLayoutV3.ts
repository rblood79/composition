import type { PanelFrameGeometry, PanelId } from "../panels/core/types";
import {
  MAX_PANEL_WORKSPACE_COLUMNS,
  PANEL_WORKSPACE_GAP,
  type PanelWorkspaceRailSide,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";

export const PANEL_WORKSPACE_LAYOUT_V3_VERSION = 3 as const;

export const PANEL_WORKSPACE_PLACEMENT_ZONES = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;

export type PanelWorkspacePlacementZone =
  (typeof PANEL_WORKSPACE_PLACEMENT_ZONES)[number];

export const PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL: Record<
  PanelWorkspaceRailSide,
  PanelWorkspacePlacementZone
> = {
  left: "top-left",
  right: "top-right",
  bottom: "bottom",
};

export interface PanelWorkspaceMigrationSourceV3 {
  version: 2;
  migrationId: string;
}

export interface PanelWorkspaceRowV3 {
  panelId: PanelId;
  height: number;
}

export interface PanelWorkspaceColumnV3 {
  id: string;
  width: number;
  rows: PanelWorkspaceRowV3[];
}

export interface PanelWorkspaceClusterV3 {
  id: string;
  placementZone: PanelWorkspacePlacementZone;
  columns: PanelWorkspaceColumnV3[];
}

export interface PanelWorkspaceLayoutV3 {
  version: typeof PANEL_WORKSPACE_LAYOUT_V3_VERSION;
  migrationSource?: PanelWorkspaceMigrationSourceV3;
  visibility: Partial<Record<PanelId, boolean>>;
  railOrder: Record<PanelWorkspaceRailSide, PanelId[]>;
  clusters: PanelWorkspaceClusterV3[];
  clusterFocusOrder: string[];
}

export interface PanelWorkspaceSolvedClusterGeometryV3 extends PanelFrameGeometry {
  clusterId: string;
  placementZone: PanelWorkspacePlacementZone;
}

export interface PanelWorkspaceSolvedFrameGeometryV3 extends PanelFrameGeometry {
  clusterId: string;
  placementZone: PanelWorkspacePlacementZone;
}

export interface PanelWorkspaceLayoutSolutionV3 {
  layout: PanelWorkspaceLayoutV3;
  surfaceRect: PanelWorkspaceRect;
  clusterGeometries: ReadonlyMap<string, PanelWorkspaceSolvedClusterGeometryV3>;
  frameGeometries: ReadonlyMap<PanelId, PanelWorkspaceSolvedFrameGeometryV3>;
  visiblePanelIds: ReadonlySet<PanelId>;
}

interface RawPanelWorkspaceRowV3 {
  panelId: string;
  height: number;
}

interface RawPanelWorkspaceColumnV3 {
  id: string;
  width: number;
  rows: RawPanelWorkspaceRowV3[];
}

interface RawPanelWorkspaceClusterV3 {
  id: string;
  placementZone: PanelWorkspacePlacementZone;
  columns: RawPanelWorkspaceColumnV3[];
}

interface RawPanelWorkspaceLayoutV3 {
  migrationSource?: PanelWorkspaceMigrationSourceV3;
  visibility: Record<string, boolean>;
  railOrder: Record<PanelWorkspaceRailSide, string[]>;
  clusters: RawPanelWorkspaceClusterV3[];
  clusterFocusOrder: string[];
}

const RAIL_SIDES: readonly PanelWorkspaceRailSide[] = [
  "left",
  "right",
  "bottom",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

export function panelWorkspaceZoneOrigin(
  placementZone: PanelWorkspacePlacementZone,
  surfaceRect: PanelWorkspaceRect,
  clusterSize: { width: number; height: number },
): { x: number; y: number } {
  const remainingWidth = Math.max(0, surfaceRect.width - clusterSize.width);
  const remainingHeight = Math.max(0, surfaceRect.height - clusterSize.height);
  const x =
    placementZone.endsWith("left") || placementZone === "left"
      ? 0
      : placementZone.endsWith("right") || placementZone === "right"
        ? remainingWidth
        : remainingWidth / 2;
  const y =
    placementZone.startsWith("top") || placementZone === "top"
      ? 0
      : placementZone.startsWith("bottom") || placementZone === "bottom"
        ? remainingHeight
        : remainingHeight / 2;
  return { x, y };
}

export function isPanelWorkspacePlacementZone(
  value: unknown,
): value is PanelWorkspacePlacementZone {
  return (
    typeof value === "string" &&
    PANEL_WORKSPACE_PLACEMENT_ZONES.includes(
      value as PanelWorkspacePlacementZone,
    )
  );
}

export function validatePanelWorkspacePlacementSurface(
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceRect> {
  if (
    !isFiniteNumber(surfaceRect.width) ||
    !isFiniteNumber(surfaceRect.height) ||
    surfaceRect.width <= 0 ||
    surfaceRect.height <= 0
  ) {
    return {
      ok: false,
      error: "Panel placement surface must have finite non-zero dimensions",
    };
  }
  return {
    ok: true,
    value: { width: surfaceRect.width, height: surfaceRect.height },
  };
}

function registryMap(
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelWorkspaceResult<Map<PanelId, PanelWorkspaceRegistryEntry>> {
  const entries = new Map<PanelId, PanelWorkspaceRegistryEntry>();
  for (const entry of registry) {
    if (entries.has(entry.id)) {
      return {
        ok: false,
        error: `Duplicate panel registry id "${entry.id}"`,
      };
    }
    if (
      !RAIL_SIDES.includes(entry.defaultPosition) ||
      !isFiniteNumber(entry.minWidth) ||
      !isFiniteNumber(entry.maxWidth) ||
      !isFiniteNumber(entry.defaultWidth) ||
      !isFiniteNumber(entry.minHeight) ||
      !isFiniteNumber(entry.maxHeight) ||
      !isFiniteNumber(entry.defaultHeight) ||
      entry.minWidth <= 0 ||
      entry.minHeight <= 0 ||
      entry.maxWidth < entry.minWidth ||
      entry.maxHeight < entry.minHeight
    ) {
      return {
        ok: false,
        error: `Invalid panel registry entry "${entry.id}"`,
      };
    }
    entries.set(entry.id, entry);
  }
  return { ok: true, value: entries };
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) return null;
  return [...value];
}

function parseRawLayout(
  input: unknown,
): PanelWorkspaceResult<RawPanelWorkspaceLayoutV3> {
  if (!isRecord(input) || input.version !== PANEL_WORKSPACE_LAYOUT_V3_VERSION) {
    return { ok: false, error: "Panel layout is not a v3 record" };
  }
  if (!isRecord(input.visibility) || !isRecord(input.railOrder)) {
    return { ok: false, error: "Invalid v3 visibility or railOrder" };
  }

  const visibility: Record<string, boolean> = {};
  for (const [panelId, visible] of Object.entries(input.visibility)) {
    if (typeof visible !== "boolean") {
      return { ok: false, error: `Invalid visibility for "${panelId}"` };
    }
    visibility[panelId] = visible;
  }

  const railOrder = {
    left: parseStringArray(input.railOrder.left),
    right: parseStringArray(input.railOrder.right),
    bottom: parseStringArray(input.railOrder.bottom),
  };
  if (!railOrder.left || !railOrder.right || !railOrder.bottom) {
    return { ok: false, error: "Invalid v3 rail order" };
  }

  if (!Array.isArray(input.clusters)) {
    return { ok: false, error: "Invalid v3 clusters" };
  }
  const clusters: RawPanelWorkspaceClusterV3[] = [];
  for (const clusterValue of input.clusters) {
    if (
      !isRecord(clusterValue) ||
      !isNonEmptyString(clusterValue.id) ||
      !isPanelWorkspacePlacementZone(clusterValue.placementZone) ||
      !Array.isArray(clusterValue.columns)
    ) {
      return { ok: false, error: "Invalid v3 cluster" };
    }
    const columns: RawPanelWorkspaceColumnV3[] = [];
    for (const columnValue of clusterValue.columns) {
      if (
        !isRecord(columnValue) ||
        !isNonEmptyString(columnValue.id) ||
        !isFiniteNumber(columnValue.width) ||
        !Array.isArray(columnValue.rows)
      ) {
        return { ok: false, error: "Invalid v3 column" };
      }
      const rows: RawPanelWorkspaceRowV3[] = [];
      for (const rowValue of columnValue.rows) {
        if (
          !isRecord(rowValue) ||
          !isNonEmptyString(rowValue.panelId) ||
          !isFiniteNumber(rowValue.height)
        ) {
          return { ok: false, error: "Invalid v3 row" };
        }
        rows.push({ panelId: rowValue.panelId, height: rowValue.height });
      }
      columns.push({ id: columnValue.id, width: columnValue.width, rows });
    }
    clusters.push({
      id: clusterValue.id,
      placementZone: clusterValue.placementZone,
      columns,
    });
  }

  const clusterFocusOrder = parseStringArray(input.clusterFocusOrder);
  if (!clusterFocusOrder) {
    return { ok: false, error: "Invalid v3 cluster focus order" };
  }

  let migrationSource: PanelWorkspaceMigrationSourceV3 | undefined;
  if (input.migrationSource !== undefined) {
    if (
      !isRecord(input.migrationSource) ||
      input.migrationSource.version !== 2 ||
      !isNonEmptyString(input.migrationSource.migrationId)
    ) {
      return { ok: false, error: "Invalid v3 migration source" };
    }
    migrationSource = {
      version: 2,
      migrationId: input.migrationSource.migrationId,
    };
  }

  return {
    ok: true,
    value: {
      ...(migrationSource ? { migrationSource } : {}),
      visibility,
      railOrder: {
        left: railOrder.left,
        right: railOrder.right,
        bottom: railOrder.bottom,
      },
      clusters,
      clusterFocusOrder,
    },
  };
}

function rawToTypedLayout(
  raw: RawPanelWorkspaceLayoutV3,
): PanelWorkspaceLayoutV3 {
  return {
    version: PANEL_WORKSPACE_LAYOUT_V3_VERSION,
    ...(raw.migrationSource
      ? { migrationSource: { ...raw.migrationSource } }
      : {}),
    visibility: Object.fromEntries(
      Object.entries(raw.visibility).map(([panelId, visible]) => [
        panelId as PanelId,
        visible,
      ]),
    ),
    railOrder: {
      left: raw.railOrder.left.map((panelId) => panelId as PanelId),
      right: raw.railOrder.right.map((panelId) => panelId as PanelId),
      bottom: raw.railOrder.bottom.map((panelId) => panelId as PanelId),
    },
    clusters: raw.clusters.map((cluster) => ({
      id: cluster.id,
      placementZone: cluster.placementZone,
      columns: cluster.columns.map((column) => ({
        id: column.id,
        width: column.width,
        rows: column.rows.map((row) => ({
          panelId: row.panelId as PanelId,
          height: row.height,
        })),
      })),
    })),
    clusterFocusOrder: [...raw.clusterFocusOrder],
  };
}

function uniqueId(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}#${suffix}`)) suffix += 1;
  const id = `${base}#${suffix}`;
  used.add(id);
  return id;
}

function fitTrackSizes(
  preferred: readonly number[],
  minimums: readonly number[],
  available: number,
): number[] {
  if (preferred.length === 0) return [];
  const fitted = preferred.map((value, index) =>
    Math.max(minimums[index] ?? 1, value),
  );
  let overflow = fitted.reduce((sum, value) => sum + value, 0) - available;
  if (overflow <= 0) return fitted;

  for (let index = fitted.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const minimum = minimums[index] ?? 1;
    const reducible = Math.max(0, (fitted[index] ?? 0) - minimum);
    const reduction = Math.min(reducible, overflow);
    fitted[index] = (fitted[index] ?? 0) - reduction;
    overflow -= reduction;
  }
  for (let index = fitted.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const reducible = Math.max(0, fitted[index] ?? 0);
    const reduction = Math.min(reducible, overflow);
    fitted[index] = (fitted[index] ?? 0) - reduction;
    overflow -= reduction;
  }
  return fitted;
}

function fitClusterToSurface(
  cluster: PanelWorkspaceClusterV3,
  entries: ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>,
  visibility: Partial<Record<PanelId, boolean>>,
  surfaceRect: PanelWorkspaceRect,
): void {
  const visibleColumnIndexes = cluster.columns.flatMap((column, columnIndex) =>
    column.rows.some((row) => visibility[row.panelId] === true)
      ? [columnIndex]
      : [],
  );
  const horizontalGap =
    PANEL_WORKSPACE_GAP * Math.max(0, visibleColumnIndexes.length - 1);
  const availableWidth = Math.max(0, surfaceRect.width - horizontalGap);
  const columnMinimums = cluster.columns.map((column) => {
    const visibleRows = column.rows.filter(
      (row) => visibility[row.panelId] === true,
    );
    const constrainingRows =
      visibleRows.length > 0 ? visibleRows : column.rows.slice(0, 1);
    const minimum = Math.max(
      0,
      ...constrainingRows.map((row) => entries.get(row.panelId)?.minWidth ?? 0),
    );
    return Math.min(minimum, surfaceRect.width);
  });
  const columnPreferred = cluster.columns.map((column, columnIndex) => {
    const visibleRows = column.rows.filter(
      (row) => visibility[row.panelId] === true,
    );
    const constrainingRows =
      visibleRows.length > 0 ? visibleRows : column.rows.slice(0, 1);
    const maximum = Math.max(
      columnMinimums[columnIndex] ?? 0,
      Math.min(
        surfaceRect.width,
        ...constrainingRows.map(
          (row) => entries.get(row.panelId)?.maxWidth ?? surfaceRect.width,
        ),
      ),
    );
    return clamp(column.width, columnMinimums[columnIndex] ?? 0, maximum);
  });
  const fittedVisibleWidths = fitTrackSizes(
    visibleColumnIndexes.map((index) => columnPreferred[index] ?? 0),
    visibleColumnIndexes.map((index) => columnMinimums[index] ?? 0),
    availableWidth,
  );

  cluster.columns.forEach((column, columnIndex) => {
    const visibleColumnIndex = visibleColumnIndexes.indexOf(columnIndex);
    column.width =
      visibleColumnIndex >= 0
        ? (fittedVisibleWidths[visibleColumnIndex] ?? 0)
        : (columnPreferred[columnIndex] ?? 0);
    const visibleRowIndexes = column.rows.flatMap((row, rowIndex) =>
      visibility[row.panelId] === true ? [rowIndex] : [],
    );
    const verticalGap =
      PANEL_WORKSPACE_GAP * Math.max(0, visibleRowIndexes.length - 1);
    const availableHeight = Math.max(0, surfaceRect.height - verticalGap);
    const minimums = column.rows.map((row) =>
      Math.min(entries.get(row.panelId)?.minHeight ?? 0, surfaceRect.height),
    );
    const preferred = column.rows.map((row, rowIndex) => {
      const entry = entries.get(row.panelId);
      const minimum = minimums[rowIndex] ?? 0;
      const maximum = Math.max(minimum, surfaceRect.height);
      return clamp(row.height, minimum, maximum);
    });
    const fittedVisibleHeights = fitTrackSizes(
      visibleRowIndexes.map((index) => preferred[index] ?? 0),
      visibleRowIndexes.map((index) => minimums[index] ?? 0),
      availableHeight,
    );
    column.rows.forEach((row, rowIndex) => {
      const visibleRowIndex = visibleRowIndexes.indexOf(rowIndex);
      row.height =
        visibleRowIndex >= 0
          ? (fittedVisibleHeights[visibleRowIndex] ?? 0)
          : (preferred[rowIndex] ?? 0);
    });
  });
}

function railSideByPanel(
  railOrder: Record<PanelWorkspaceRailSide, PanelId[]>,
): Map<PanelId, PanelWorkspaceRailSide> {
  const result = new Map<PanelId, PanelWorkspaceRailSide>();
  for (const side of RAIL_SIDES) {
    for (const panelId of railOrder[side]) result.set(panelId, side);
  }
  return result;
}

function defaultColumnIndex(
  cluster: PanelWorkspaceClusterV3,
  side: PanelWorkspaceRailSide,
): number {
  if (cluster.columns.length === 0) return 0;
  if (side === "left") return cluster.columns.length - 1;
  return 0;
}

export function normalizePanelWorkspaceLayoutV3(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const surface = validatePanelWorkspacePlacementSurface(surfaceRect);
  if (!surface.ok) return surface;
  const entriesResult = registryMap(registry);
  if (!entriesResult.ok) return entriesResult;
  const entries = entriesResult.value;

  const railOrder: Record<PanelWorkspaceRailSide, PanelId[]> = {
    left: [],
    right: [],
    bottom: [],
  };
  const railSeen = new Set<PanelId>();
  for (const side of RAIL_SIDES) {
    const source = Array.isArray(layout.railOrder?.[side])
      ? layout.railOrder[side]
      : [];
    for (const panelId of source) {
      if (!entries.has(panelId) || railSeen.has(panelId)) continue;
      railSeen.add(panelId);
      railOrder[side].push(panelId);
    }
  }
  for (const entry of registry) {
    if (railSeen.has(entry.id)) continue;
    railSeen.add(entry.id);
    railOrder[entry.defaultPosition].push(entry.id);
  }

  const visibility: Partial<Record<PanelId, boolean>> = {};
  for (const entry of registry) {
    visibility[entry.id] = layout.visibility?.[entry.id] === true;
  }

  const clusters: PanelWorkspaceClusterV3[] = [];
  const clusterByZone = new Map<
    PanelWorkspacePlacementZone,
    PanelWorkspaceClusterV3
  >();
  const usedClusterIds = new Set<string>();
  const usedColumnIds = new Set<string>();
  const placedPanelIds = new Set<PanelId>();

  for (const sourceCluster of Array.isArray(layout.clusters)
    ? layout.clusters
    : []) {
    if (
      !sourceCluster ||
      !isNonEmptyString(sourceCluster.id) ||
      !isPanelWorkspacePlacementZone(sourceCluster.placementZone) ||
      !Array.isArray(sourceCluster.columns)
    ) {
      continue;
    }
    let targetCluster = clusterByZone.get(sourceCluster.placementZone);
    if (!targetCluster) {
      targetCluster = {
        id: uniqueId(sourceCluster.id, usedClusterIds),
        placementZone: sourceCluster.placementZone,
        columns: [],
      };
      clusterByZone.set(sourceCluster.placementZone, targetCluster);
      clusters.push(targetCluster);
    }

    sourceCluster.columns.forEach((sourceColumn, sourceColumnIndex) => {
      if (!sourceColumn || !Array.isArray(sourceColumn.rows)) return;
      const targetColumnIndex = Math.min(
        sourceColumnIndex,
        MAX_PANEL_WORKSPACE_COLUMNS - 1,
      );
      let targetColumn = targetCluster?.columns[targetColumnIndex];
      if (!targetColumn && targetCluster) {
        targetColumn = {
          id: uniqueId(
            isNonEmptyString(sourceColumn.id)
              ? sourceColumn.id
              : `${targetCluster.id}:column:${targetColumnIndex}`,
            usedColumnIds,
          ),
          width: isFiniteNumber(sourceColumn.width) ? sourceColumn.width : 1,
          rows: [],
        };
        targetCluster.columns[targetColumnIndex] = targetColumn;
      }
      if (!targetColumn) return;
      for (const sourceRow of sourceColumn.rows) {
        const entry = entries.get(sourceRow?.panelId);
        if (!entry || placedPanelIds.has(entry.id)) continue;
        placedPanelIds.add(entry.id);
        targetColumn.rows.push({
          panelId: entry.id,
          height: isFiniteNumber(sourceRow.height)
            ? sourceRow.height
            : entry.defaultHeight,
        });
      }
    });
  }

  for (const cluster of clusters) {
    cluster.columns = cluster.columns.filter(
      (column) => column.rows.length > 0,
    );
  }
  for (let index = clusters.length - 1; index >= 0; index -= 1) {
    const cluster = clusters[index];
    if (!cluster || cluster.columns.length > 0) continue;
    clusters.splice(index, 1);
    clusterByZone.delete(cluster.placementZone);
  }

  const sideByPanel = railSideByPanel(railOrder);
  for (const entry of registry) {
    if (placedPanelIds.has(entry.id)) continue;
    const side = sideByPanel.get(entry.id) ?? entry.defaultPosition;
    const placementZone = PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL[side];
    let cluster = clusterByZone.get(placementZone);
    if (!cluster) {
      cluster = {
        id: uniqueId(`zone:${placementZone}`, usedClusterIds),
        placementZone,
        columns: [],
      };
      clusterByZone.set(placementZone, cluster);
      clusters.push(cluster);
    }
    const columnIndex = defaultColumnIndex(cluster, side);
    let column = cluster.columns[columnIndex];
    if (!column) {
      column = {
        id: uniqueId(`${cluster.id}:column:${columnIndex}`, usedColumnIds),
        width: entry.defaultWidth,
        rows: [],
      };
      cluster.columns[columnIndex] = column;
    }
    column.rows.push({ panelId: entry.id, height: entry.defaultHeight });
    column.width = Math.max(column.width, entry.defaultWidth);
    visibility[entry.id] = false;
    placedPanelIds.add(entry.id);
  }

  for (const cluster of clusters) {
    fitClusterToSurface(cluster, entries, visibility, surface.value);
  }

  const clusterIds = clusters.map((cluster) => cluster.id);
  const clusterIdSet = new Set(clusterIds);
  const validFocusOrder: string[] = [];
  for (const clusterId of Array.isArray(layout.clusterFocusOrder)
    ? layout.clusterFocusOrder
    : []) {
    if (!clusterIdSet.has(clusterId) || validFocusOrder.includes(clusterId)) {
      continue;
    }
    validFocusOrder.push(clusterId);
  }
  const missingFocusIds = clusterIds.filter(
    (clusterId) => !validFocusOrder.includes(clusterId),
  );

  return {
    ok: true,
    value: {
      version: PANEL_WORKSPACE_LAYOUT_V3_VERSION,
      ...(layout.migrationSource?.version === 2 &&
      isNonEmptyString(layout.migrationSource.migrationId)
        ? { migrationSource: { ...layout.migrationSource } }
        : {}),
      visibility,
      railOrder,
      clusters,
      clusterFocusOrder: [...missingFocusIds, ...validFocusOrder],
    },
  };
}

export function parsePanelWorkspaceLayoutV3(
  input: unknown,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const raw = parseRawLayout(input);
  if (!raw.ok) return raw;
  return normalizePanelWorkspaceLayoutV3(
    rawToTypedLayout(raw.value),
    registry,
    surfaceRect,
  );
}

export function solvePanelWorkspaceLayoutV3(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutSolutionV3> {
  const normalized = normalizePanelWorkspaceLayoutV3(
    layout,
    registry,
    surfaceRect,
  );
  if (!normalized.ok) return normalized;

  const clusterGeometries = new Map<
    string,
    PanelWorkspaceSolvedClusterGeometryV3
  >();
  const frameGeometries = new Map<
    PanelId,
    PanelWorkspaceSolvedFrameGeometryV3
  >();
  const visiblePanelIds = new Set<PanelId>();

  for (const cluster of normalized.value.clusters) {
    const visibleColumns = cluster.columns.flatMap((column) => {
      const rows = column.rows.filter(
        (row) => normalized.value.visibility[row.panelId] === true,
      );
      return rows.length > 0 ? [{ column, rows }] : [];
    });
    if (visibleColumns.length === 0) continue;

    const width =
      visibleColumns.reduce((sum, { column }) => sum + column.width, 0) +
      PANEL_WORKSPACE_GAP * Math.max(0, visibleColumns.length - 1);
    const height = Math.max(
      0,
      ...visibleColumns.map(
        ({ rows }) =>
          rows.reduce((sum, row) => sum + row.height, 0) +
          PANEL_WORKSPACE_GAP * Math.max(0, rows.length - 1),
      ),
    );
    const origin = panelWorkspaceZoneOrigin(
      cluster.placementZone,
      surfaceRect,
      { width, height },
    );
    clusterGeometries.set(cluster.id, {
      clusterId: cluster.id,
      placementZone: cluster.placementZone,
      x: origin.x,
      y: origin.y,
      width,
      height,
    });

    let columnX = origin.x;
    for (const { column, rows } of visibleColumns) {
      let rowY = origin.y;
      for (const row of rows) {
        visiblePanelIds.add(row.panelId);
        frameGeometries.set(row.panelId, {
          clusterId: cluster.id,
          placementZone: cluster.placementZone,
          x: columnX,
          y: rowY,
          width: column.width,
          height: row.height,
        });
        rowY += row.height + PANEL_WORKSPACE_GAP;
      }
      columnX += column.width + PANEL_WORKSPACE_GAP;
    }
  }

  return {
    ok: true,
    value: {
      layout: normalized.value,
      surfaceRect: { ...surfaceRect },
      clusterGeometries,
      frameGeometries,
      visiblePanelIds,
    },
  };
}

export function createDefaultPanelWorkspaceLayoutV3(
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  initialVisibility: Partial<Record<PanelId, boolean>> = {},
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const railOrder: Record<PanelWorkspaceRailSide, PanelId[]> = {
    left: [],
    right: [],
    bottom: [],
  };
  for (const entry of registry) railOrder[entry.defaultPosition].push(entry.id);

  const clusters: PanelWorkspaceClusterV3[] = [];
  for (const side of RAIL_SIDES) {
    const sideEntries = registry.filter(
      (entry) => entry.defaultPosition === side,
    );
    if (sideEntries.length === 0) continue;
    const placementZone = PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL[side];
    clusters.push({
      id: `zone:${placementZone}`,
      placementZone,
      columns: [
        {
          id: `zone:${placementZone}:column:0`,
          width: Math.max(...sideEntries.map((entry) => entry.defaultWidth)),
          rows: sideEntries.map((entry) => ({
            panelId: entry.id,
            height: entry.defaultHeight,
          })),
        },
      ],
    });
  }

  return normalizePanelWorkspaceLayoutV3(
    {
      version: PANEL_WORKSPACE_LAYOUT_V3_VERSION,
      visibility: Object.fromEntries(
        registry.map((entry) => [
          entry.id,
          initialVisibility[entry.id] === true,
        ]),
      ),
      railOrder,
      clusters,
      clusterFocusOrder: clusters.map((cluster) => cluster.id),
    },
    registry,
    surfaceRect,
  );
}
