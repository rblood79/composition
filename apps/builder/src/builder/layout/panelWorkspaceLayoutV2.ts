import type {
  PanelConfig,
  PanelFrameGeometry,
  PanelId,
  PanelSide,
  PanelSize,
} from "../panels/core/types";

export const PANEL_WORKSPACE_LAYOUT_VERSION = 2 as const;
export const PANEL_WORKSPACE_GAP = 4;
export const MIN_PANEL_WORKSPACE_MAIN_WIDTH = 320;
export const MIN_PANEL_WORKSPACE_MAIN_HEIGHT = 180;
export const MAX_PANEL_WORKSPACE_COLUMNS = 2;

export type PanelWorkspaceRailSide = PanelSide;
export type PanelWorkspaceAnchor = PanelWorkspaceRailSide | "floating";
export type PanelWorkspacePresentation =
  | "anchored"
  | "floating"
  | "constrained-overlay";
export type PanelWorkspaceAnchorPresentation =
  | "anchored"
  | "constrained-overlay"
  | "hidden";

export interface PanelWorkspaceRegistryEntry {
  id: PanelId;
  defaultPosition: PanelWorkspaceRailSide;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  minHeight: number;
  maxHeight: number;
  defaultHeight: number;
}

export interface PanelWorkspaceMigrationSource {
  version: 1;
  migrationId: string;
}

export interface PanelWorkspaceRowV2 {
  panelId: PanelId;
  height: number;
}

export interface PanelWorkspaceColumnV2 {
  id: string;
  width: number;
  rows: PanelWorkspaceRowV2[];
}

export interface PanelWorkspaceAnchoredClusterV2 {
  id: string;
  anchor: PanelWorkspaceRailSide;
  columns: PanelWorkspaceColumnV2[];
}

export interface PanelWorkspaceFloatingClusterV2 {
  id: string;
  anchor: "floating";
  position: { x: number; y: number };
  columns: PanelWorkspaceColumnV2[];
}

export type PanelWorkspaceClusterV2 =
  | PanelWorkspaceAnchoredClusterV2
  | PanelWorkspaceFloatingClusterV2;

export interface PanelWorkspaceLayoutV2 {
  version: typeof PANEL_WORKSPACE_LAYOUT_VERSION;
  migrationSource?: PanelWorkspaceMigrationSource;
  visibility: Partial<Record<PanelId, boolean>>;
  railOrder: Record<PanelWorkspaceRailSide, PanelId[]>;
  clusters: PanelWorkspaceClusterV2[];
  floatingFocusOrder: string[];
}

export function panelWorkspaceFloatingOriginY(
  cluster: PanelWorkspaceClusterV2,
): number {
  if (cluster.anchor !== "floating") return 0;
  const isLegacySideRailPosition =
    (cluster.id === "anchor:left" || cluster.id === "anchor:right") &&
    cluster.position.y < PANEL_WORKSPACE_GAP * 2;
  return isLegacySideRailPosition ? 0 : cluster.position.y;
}

export type PanelWorkspaceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface PanelWorkspaceRect {
  width: number;
  height: number;
}

export interface PanelWorkspaceRailSizes {
  left: number;
  right: number;
  bottom: number;
}

export interface PanelWorkspaceSolveOptions {
  workspaceRect: PanelWorkspaceRect;
  railSizes: PanelWorkspaceRailSizes;
}

export interface PanelWorkspaceFloatingPlacementOptions {
  workspaceRect: PanelWorkspaceRect;
  railSizes: PanelWorkspaceRailSizes;
}

export interface PanelWorkspaceSolvedFrameGeometry extends PanelFrameGeometry {
  clusterId: string;
  anchor: PanelWorkspaceAnchor;
  presentation: PanelWorkspacePresentation;
}

export interface PanelWorkspaceLayoutSolution {
  layout: PanelWorkspaceLayoutV2;
  workspaceRect: PanelWorkspaceRect;
  mainContentRect: PanelFrameGeometry;
  occupiedInsets: PanelWorkspaceRailSizes;
  presentations: Record<
    PanelWorkspaceRailSide,
    PanelWorkspaceAnchorPresentation
  >;
  frameGeometries: ReadonlyMap<PanelId, PanelWorkspaceSolvedFrameGeometry>;
  visiblePanelIds: ReadonlySet<PanelId>;
  constrainedOverlayOrder: PanelWorkspaceRailSide[];
}

interface RawPanelWorkspaceRowV2 {
  panelId: string;
  height: number;
}

interface RawPanelWorkspaceColumnV2 {
  id: string;
  width: number;
  rows: RawPanelWorkspaceRowV2[];
}

interface RawPanelWorkspaceClusterV2 {
  id: string;
  anchor: PanelWorkspaceAnchor;
  position?: { x: number; y: number };
  columns: RawPanelWorkspaceColumnV2[];
}

interface RawPanelWorkspaceLayoutV2 {
  migrationSource?: PanelWorkspaceMigrationSource;
  visibility: Record<string, boolean>;
  railOrder: Record<PanelWorkspaceRailSide, string[]>;
  clusters: RawPanelWorkspaceClusterV2[];
  floatingFocusOrder: string[];
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

function safeDimension(value: number): number {
  return Math.max(0, Number.isFinite(value) ? value : 0);
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
      !Number.isFinite(entry.minWidth) ||
      !Number.isFinite(entry.maxWidth) ||
      !Number.isFinite(entry.defaultWidth) ||
      !Number.isFinite(entry.minHeight) ||
      !Number.isFinite(entry.maxHeight) ||
      !Number.isFinite(entry.defaultHeight) ||
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

export function createPanelWorkspaceRegistryEntry(
  config: PanelConfig,
): PanelWorkspaceRegistryEntry {
  const minWidth = config.minWidth ?? 200;
  const maxWidth = Math.max(minWidth, config.maxWidth ?? 800);
  const minHeight = config.minHeight ?? 160;
  const maxHeight = Math.max(minHeight, config.maxHeight ?? 800);
  return {
    id: config.id,
    defaultPosition: config.defaultPosition,
    minWidth,
    maxWidth,
    defaultWidth: clamp(
      config.defaultWidth ??
        config.minWidth ??
        (config.defaultPosition === "bottom" ? 600 : 320),
      minWidth,
      maxWidth,
    ),
    minHeight,
    maxHeight,
    defaultHeight: clamp(
      config.defaultHeight ?? config.minHeight ?? 420,
      minHeight,
      maxHeight,
    ),
  };
}

export function resolvePanelWorkspaceDefaultSize(
  entry: PanelWorkspaceRegistryEntry,
  preferred?: Partial<PanelSize>,
): PanelSize {
  return {
    width: clamp(
      preferred?.width ?? entry.defaultWidth,
      entry.minWidth,
      entry.maxWidth,
    ),
    height: clamp(
      preferred?.height ?? entry.defaultHeight,
      entry.minHeight,
      entry.maxHeight,
    ),
  };
}

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) return null;
  return [...value];
}

function parseRawLayout(
  input: unknown,
): PanelWorkspaceResult<RawPanelWorkspaceLayoutV2> {
  if (!isRecord(input) || input.version !== PANEL_WORKSPACE_LAYOUT_VERSION) {
    return { ok: false, error: "Panel layout is not a v2 record" };
  }
  if (!isRecord(input.visibility) || !isRecord(input.railOrder)) {
    return { ok: false, error: "Invalid v2 visibility or railOrder" };
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
    return { ok: false, error: "Invalid v2 rail order" };
  }

  if (!Array.isArray(input.clusters)) {
    return { ok: false, error: "Invalid v2 clusters" };
  }
  const clusters: RawPanelWorkspaceClusterV2[] = [];
  for (const clusterValue of input.clusters) {
    if (
      !isRecord(clusterValue) ||
      !isNonEmptyString(clusterValue.id) ||
      !isNonEmptyString(clusterValue.anchor) ||
      ![...RAIL_SIDES, "floating"].includes(
        clusterValue.anchor as PanelWorkspaceAnchor,
      ) ||
      !Array.isArray(clusterValue.columns)
    ) {
      return { ok: false, error: "Invalid v2 cluster" };
    }
    let position: { x: number; y: number } | undefined;
    if (clusterValue.anchor === "floating") {
      if (
        !isRecord(clusterValue.position) ||
        !isFiniteNumber(clusterValue.position.x) ||
        !isFiniteNumber(clusterValue.position.y)
      ) {
        return { ok: false, error: "Invalid floating cluster position" };
      }
      position = { x: clusterValue.position.x, y: clusterValue.position.y };
    }

    const columns: RawPanelWorkspaceColumnV2[] = [];
    for (const columnValue of clusterValue.columns) {
      if (
        !isRecord(columnValue) ||
        !isNonEmptyString(columnValue.id) ||
        !isFiniteNumber(columnValue.width) ||
        !Array.isArray(columnValue.rows)
      ) {
        return { ok: false, error: "Invalid v2 column" };
      }
      const rows: RawPanelWorkspaceRowV2[] = [];
      for (const rowValue of columnValue.rows) {
        if (
          !isRecord(rowValue) ||
          !isNonEmptyString(rowValue.panelId) ||
          !isFiniteNumber(rowValue.height)
        ) {
          return { ok: false, error: "Invalid v2 row" };
        }
        rows.push({ panelId: rowValue.panelId, height: rowValue.height });
      }
      columns.push({ id: columnValue.id, width: columnValue.width, rows });
    }
    clusters.push({
      id: clusterValue.id,
      anchor: clusterValue.anchor as PanelWorkspaceAnchor,
      ...(position ? { position } : {}),
      columns,
    });
  }

  const floatingFocusOrder = parseStringArray(input.floatingFocusOrder);
  if (!floatingFocusOrder) {
    return { ok: false, error: "Invalid v2 floating focus order" };
  }

  let migrationSource: PanelWorkspaceMigrationSource | undefined;
  if (input.migrationSource !== undefined) {
    if (
      !isRecord(input.migrationSource) ||
      input.migrationSource.version !== 1 ||
      !isNonEmptyString(input.migrationSource.migrationId)
    ) {
      return { ok: false, error: "Invalid v2 migration source" };
    }
    migrationSource = {
      version: 1,
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
      floatingFocusOrder,
    },
  };
}

function rawToTypedLayout(
  raw: RawPanelWorkspaceLayoutV2,
): PanelWorkspaceLayoutV2 {
  return {
    version: PANEL_WORKSPACE_LAYOUT_VERSION,
    ...(raw.migrationSource
      ? { migrationSource: { ...raw.migrationSource } }
      : {}),
    visibility: Object.fromEntries(
      Object.entries(raw.visibility).map(([id, visible]) => [
        id as PanelId,
        visible,
      ]),
    ),
    railOrder: {
      left: raw.railOrder.left.map((id) => id as PanelId),
      right: raw.railOrder.right.map((id) => id as PanelId),
      bottom: raw.railOrder.bottom.map((id) => id as PanelId),
    },
    clusters: raw.clusters.map((cluster) => ({
      id: cluster.id,
      anchor: cluster.anchor,
      ...(cluster.anchor === "floating"
        ? { position: { ...(cluster.position ?? { x: 0, y: 0 }) } }
        : {}),
      columns: cluster.columns.map((column) => ({
        id: column.id,
        width: column.width,
        rows: column.rows.map((row) => ({
          panelId: row.panelId as PanelId,
          height: row.height,
        })),
      })),
    })) as PanelWorkspaceClusterV2[],
    floatingFocusOrder: [...raw.floatingFocusOrder],
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

function columnWidthBounds(
  rows: readonly PanelWorkspaceRowV2[],
  entries: ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>,
): { min: number; max: number } {
  const rowEntries = rows
    .map((row) => entries.get(row.panelId))
    .filter(
      (entry): entry is PanelWorkspaceRegistryEntry => entry !== undefined,
    );
  if (rowEntries.length === 0) return { min: 1, max: 1 };
  const min = Math.max(...rowEntries.map((entry) => entry.minWidth));
  const max = Math.max(
    min,
    Math.min(...rowEntries.map((entry) => entry.maxWidth)),
  );
  return { min, max };
}

function normalizeColumnWidth(
  width: number,
  rows: readonly PanelWorkspaceRowV2[],
  entries: ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>,
): number {
  const bounds = columnWidthBounds(rows, entries);
  return clamp(width, bounds.min, bounds.max);
}

function rowsConstrainingColumnWidth(
  rows: readonly PanelWorkspaceRowV2[],
  visibility: Partial<Record<PanelId, boolean>>,
): readonly PanelWorkspaceRowV2[] {
  const visibleRows = rows.filter((row) => visibility[row.panelId] === true);
  return visibleRows.length > 0 ? visibleRows : rows.slice(0, 1);
}

function findAnchoredCluster(
  clusters: PanelWorkspaceClusterV2[],
  anchor: PanelWorkspaceRailSide,
): PanelWorkspaceAnchoredClusterV2 | undefined {
  return clusters.find(
    (cluster): cluster is PanelWorkspaceAnchoredClusterV2 =>
      cluster.anchor === anchor,
  );
}

export function normalizePanelWorkspaceLayoutV2(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelWorkspaceResult<PanelWorkspaceLayoutV2> {
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

  const clusters: PanelWorkspaceClusterV2[] = [];
  const placedPanelIds = new Set<PanelId>();
  const usedClusterIds = new Set<string>();
  const usedColumnIds = new Set<string>();

  for (const sourceCluster of Array.isArray(layout.clusters)
    ? layout.clusters
    : []) {
    if (
      !sourceCluster ||
      !isNonEmptyString(sourceCluster.id) ||
      ![...RAIL_SIDES, "floating"].includes(sourceCluster.anchor) ||
      !Array.isArray(sourceCluster.columns)
    ) {
      continue;
    }

    let targetCluster: PanelWorkspaceClusterV2 | undefined;
    if (sourceCluster.anchor === "floating") {
      if (
        !isFiniteNumber(sourceCluster.position?.x) ||
        !isFiniteNumber(sourceCluster.position?.y)
      ) {
        continue;
      }
      targetCluster = {
        id: uniqueId(sourceCluster.id, usedClusterIds),
        anchor: "floating",
        position: { ...sourceCluster.position },
        columns: [],
      };
      clusters.push(targetCluster);
    } else {
      targetCluster = findAnchoredCluster(clusters, sourceCluster.anchor);
      if (!targetCluster) {
        targetCluster = {
          id: uniqueId(sourceCluster.id, usedClusterIds),
          anchor: sourceCluster.anchor,
          columns: [],
        };
        clusters.push(targetCluster);
      }
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
          height: Math.max(
            entry.minHeight,
            isFiniteNumber(sourceRow.height)
              ? sourceRow.height
              : entry.defaultHeight,
          ),
        });
      }
      if (targetColumn.rows.length > 0) {
        targetColumn.width = normalizeColumnWidth(
          targetColumn.width,
          rowsConstrainingColumnWidth(targetColumn.rows, visibility),
          entries,
        );
      }
    });

    targetCluster.columns = targetCluster.columns.filter(
      (column) => column.rows.length > 0,
    );
  }

  for (let index = clusters.length - 1; index >= 0; index -= 1) {
    if (clusters[index]?.columns.length === 0) clusters.splice(index, 1);
  }

  for (const entry of registry) {
    if (placedPanelIds.has(entry.id)) continue;
    const anchor = entry.defaultPosition;
    let cluster = findAnchoredCluster(clusters, anchor);
    if (!cluster) {
      cluster = {
        id: uniqueId(`anchor:${anchor}`, usedClusterIds),
        anchor,
        columns: [],
      };
      clusters.push(cluster);
    }
    let column = cluster.columns[0];
    if (!column) {
      column = {
        id: uniqueId(`${cluster.id}:column:0`, usedColumnIds),
        width: entry.defaultWidth,
        rows: [],
      };
      cluster.columns.push(column);
    }
    column.rows.push({ panelId: entry.id, height: entry.defaultHeight });
    column.width = normalizeColumnWidth(
      column.width,
      rowsConstrainingColumnWidth(column.rows, visibility),
      entries,
    );
    visibility[entry.id] = false;
    placedPanelIds.add(entry.id);
  }

  const floatingClusterIds = clusters
    .filter(
      (cluster): cluster is PanelWorkspaceFloatingClusterV2 =>
        cluster.anchor === "floating",
    )
    .map((cluster) => cluster.id);
  const floatingIdSet = new Set(floatingClusterIds);
  const floatingFocusOrder: string[] = [];
  for (const clusterId of Array.isArray(layout.floatingFocusOrder)
    ? layout.floatingFocusOrder
    : []) {
    if (
      !floatingIdSet.has(clusterId) ||
      floatingFocusOrder.includes(clusterId)
    ) {
      continue;
    }
    floatingFocusOrder.push(clusterId);
  }
  for (const clusterId of floatingClusterIds) {
    if (!floatingFocusOrder.includes(clusterId)) {
      floatingFocusOrder.push(clusterId);
    }
  }

  return {
    ok: true,
    value: {
      version: PANEL_WORKSPACE_LAYOUT_VERSION,
      ...(layout.migrationSource?.version === 1 &&
      isNonEmptyString(layout.migrationSource.migrationId)
        ? { migrationSource: { ...layout.migrationSource } }
        : {}),
      visibility,
      railOrder,
      clusters,
      floatingFocusOrder,
    },
  };
}

export function parsePanelWorkspaceLayoutV2(
  input: unknown,
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelWorkspaceResult<PanelWorkspaceLayoutV2> {
  const raw = parseRawLayout(input);
  if (!raw.ok) return raw;
  return normalizePanelWorkspaceLayoutV2(rawToTypedLayout(raw.value), registry);
}

function storedClusterSize(cluster: PanelWorkspaceClusterV2): PanelSize {
  return {
    width:
      cluster.columns.reduce((total, column) => total + column.width, 0) +
      PANEL_WORKSPACE_GAP * Math.max(0, cluster.columns.length - 1),
    height: Math.max(
      0,
      ...cluster.columns.map(
        (column) =>
          column.rows.reduce((total, row) => total + row.height, 0) +
          PANEL_WORKSPACE_GAP * Math.max(0, column.rows.length - 1),
      ),
    ),
  };
}

function floatingPositionForAnchor(
  anchor: PanelWorkspaceRailSide,
  size: PanelSize,
  options: PanelWorkspaceFloatingPlacementOptions,
): { x: number; y: number } {
  const { workspaceRect, railSizes } = options;
  if (anchor === "left") {
    return {
      x: railSizes.left + PANEL_WORKSPACE_GAP,
      y: 0,
    };
  }
  if (anchor === "right") {
    return {
      x: Math.max(
        0,
        workspaceRect.width -
          railSizes.right -
          PANEL_WORKSPACE_GAP -
          size.width,
      ),
      y: 0,
    };
  }
  return {
    x: Math.max(0, (workspaceRect.width - size.width) / 2),
    y: Math.max(
      0,
      workspaceRect.height -
        railSizes.bottom -
        PANEL_WORKSPACE_GAP -
        size.height,
    ),
  };
}

/**
 * ADR-922 post-amendment: side/bottom anchors are a legacy placement form.
 * Existing v2 records remain readable, but production frames are upgraded to
 * floating clusters so activity rails overlay Canvas instead of reserving it.
 */
export function floatAnchoredPanelWorkspaceClusters(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  options: PanelWorkspaceFloatingPlacementOptions,
): PanelWorkspaceResult<PanelWorkspaceLayoutV2> {
  const normalized = normalizePanelWorkspaceLayoutV2(layout, registry);
  if (!normalized.ok) return normalized;

  const convertedClusterIds: string[] = [];
  const clusters = normalized.value.clusters.map((cluster) => {
    if (cluster.anchor === "floating") {
      const originY = panelWorkspaceFloatingOriginY(cluster);
      return originY !== cluster.position.y
        ? { ...cluster, position: { ...cluster.position, y: 0 } }
        : cluster;
    }
    convertedClusterIds.push(cluster.id);
    return {
      id: cluster.id,
      anchor: "floating" as const,
      position: floatingPositionForAnchor(
        cluster.anchor,
        storedClusterSize(cluster),
        options,
      ),
      columns: cluster.columns.map((column) => ({
        ...column,
        rows: column.rows.map((row) => ({ ...row })),
      })),
    };
  });
  if (convertedClusterIds.length === 0) return normalized;

  return normalizePanelWorkspaceLayoutV2(
    {
      ...normalized.value,
      clusters,
      floatingFocusOrder: [
        ...normalized.value.floatingFocusOrder,
        ...convertedClusterIds.filter(
          (clusterId) =>
            !normalized.value.floatingFocusOrder.includes(clusterId),
        ),
      ],
    },
    registry,
  );
}

function visibleRows(
  column: PanelWorkspaceColumnV2,
  visibility: Partial<Record<PanelId, boolean>>,
): PanelWorkspaceRowV2[] {
  return column.rows.filter((row) => visibility[row.panelId] === true);
}

function clusterDemand(
  cluster: PanelWorkspaceClusterV2 | undefined,
  visibility: Partial<Record<PanelId, boolean>>,
): { width: number; height: number } {
  if (!cluster) return { width: 0, height: 0 };
  const columns = cluster.columns
    .map((column) => ({ column, rows: visibleRows(column, visibility) }))
    .filter(({ rows }) => rows.length > 0);
  return {
    width:
      columns.reduce((total, { column }) => total + column.width, 0) +
      PANEL_WORKSPACE_GAP * Math.max(0, columns.length - 1),
    height: Math.max(
      0,
      ...columns.map(
        ({ rows }) =>
          rows.reduce((total, row) => total + row.height, 0) +
          PANEL_WORKSPACE_GAP * Math.max(0, rows.length - 1),
      ),
    ),
  };
}

function clusterMinimumHeight(
  cluster: PanelWorkspaceClusterV2 | undefined,
  visibility: Partial<Record<PanelId, boolean>>,
  entries: ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>,
): number {
  if (!cluster) return 0;
  return Math.max(
    0,
    ...cluster.columns.map((column) => {
      const rows = visibleRows(column, visibility);
      return (
        rows.reduce(
          (total, row) => total + (entries.get(row.panelId)?.minHeight ?? 0),
          0,
        ) +
        PANEL_WORKSPACE_GAP * Math.max(0, rows.length - 1)
      );
    }),
  );
}

function fitTracks(
  preferred: readonly number[],
  minimums: readonly number[],
  available: number,
  allowBelowMinimum: boolean,
): number[] {
  if (preferred.length === 0) return [];
  const fitted = preferred.map((value, index) =>
    Math.max(minimums[index] ?? 0, value),
  );
  let overflow = fitted.reduce((total, value) => total + value, 0) - available;
  if (overflow <= 0) return fitted;

  for (let index = fitted.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const minimum = minimums[index] ?? 0;
    const reducible = Math.max(0, (fitted[index] ?? 0) - minimum);
    const reduction = Math.min(reducible, overflow);
    fitted[index] = (fitted[index] ?? 0) - reduction;
    overflow -= reduction;
  }
  if (!allowBelowMinimum || overflow <= 0) return fitted;

  for (let index = fitted.length - 1; index >= 0 && overflow > 0; index -= 1) {
    const reducible = Math.max(0, fitted[index] ?? 0);
    const reduction = Math.min(reducible, overflow);
    fitted[index] = (fitted[index] ?? 0) - reduction;
    overflow -= reduction;
  }
  return fitted;
}

function clampPosition(
  position: number,
  size: number,
  available: number,
): number {
  return clamp(position, 0, Math.max(0, available - size));
}

function placeClusterFrames(
  cluster: PanelWorkspaceClusterV2,
  presentation: PanelWorkspacePresentation,
  workspace: PanelWorkspaceRect,
  rails: PanelWorkspaceRailSizes,
  visibility: Partial<Record<PanelId, boolean>>,
  entries: ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>,
  frames: Map<PanelId, PanelWorkspaceSolvedFrameGeometry>,
): void {
  const visibleColumns = cluster.columns
    .map((column) => ({ column, rows: visibleRows(column, visibility) }))
    .filter(({ rows }) => rows.length > 0);
  if (visibleColumns.length === 0) return;

  const horizontalGap =
    PANEL_WORKSPACE_GAP * Math.max(0, visibleColumns.length - 1);
  const availableWidth = Math.max(0, workspace.width - horizontalGap);
  const preferredWidths = visibleColumns.map(({ column }) => column.width);
  const minimumWidths = visibleColumns.map(({ rows }) =>
    Math.max(0, ...rows.map((row) => entries.get(row.panelId)?.minWidth ?? 0)),
  );
  const widths = fitTracks(
    preferredWidths,
    minimumWidths,
    availableWidth,
    presentation !== "anchored",
  );
  const clusterWidth =
    widths.reduce((total, width) => total + width, 0) + horizontalGap;

  const columnRows = visibleColumns.map(({ rows }) => {
    const verticalGap = PANEL_WORKSPACE_GAP * Math.max(0, rows.length - 1);
    const leadingGap = cluster.anchor === "floating" ? 0 : PANEL_WORKSPACE_GAP;
    const reservedBottom = cluster.anchor === "floating" ? 0 : rails.bottom;
    const availableHeight = Math.max(
      0,
      workspace.height - reservedBottom - leadingGap - verticalGap,
    );
    const heights = fitTracks(
      rows.map((row) => row.height),
      rows.map((row) => entries.get(row.panelId)?.minHeight ?? 0),
      availableHeight,
      presentation !== "anchored",
    );
    return {
      rows,
      heights,
      height:
        heights.reduce((total, height) => total + height, 0) + verticalGap,
    };
  });
  const clusterHeight = Math.max(0, ...columnRows.map(({ height }) => height));

  let originX = 0;
  let originY = PANEL_WORKSPACE_GAP;
  if (cluster.anchor === "left") {
    originX = rails.left + PANEL_WORKSPACE_GAP;
  } else if (cluster.anchor === "right") {
    originX =
      workspace.width - rails.right - PANEL_WORKSPACE_GAP - clusterWidth;
  } else if (cluster.anchor === "bottom") {
    originX = (workspace.width - clusterWidth) / 2;
    originY =
      workspace.height - rails.bottom - PANEL_WORKSPACE_GAP - clusterHeight;
  } else if (cluster.anchor === "floating") {
    originX = cluster.position.x;
    originY = panelWorkspaceFloatingOriginY(cluster);
  }
  originX = clampPosition(originX, clusterWidth, workspace.width);
  originY = clampPosition(originY, clusterHeight, workspace.height);

  let x = originX;
  visibleColumns.forEach((_, columnIndex) => {
    const width = widths[columnIndex] ?? 0;
    const solvedRows = columnRows[columnIndex];
    let y = originY;
    solvedRows?.rows.forEach((row, rowIndex) => {
      const height = solvedRows.heights[rowIndex] ?? 0;
      frames.set(row.panelId, {
        x,
        y,
        width,
        height,
        clusterId: cluster.id,
        anchor: cluster.anchor,
        presentation,
      });
      y += height + PANEL_WORKSPACE_GAP;
    });
    x += width + PANEL_WORKSPACE_GAP;
  });
}

export function solvePanelWorkspaceLayoutV2(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  options: PanelWorkspaceSolveOptions,
): PanelWorkspaceResult<PanelWorkspaceLayoutSolution> {
  const normalized = normalizePanelWorkspaceLayoutV2(layout, registry);
  if (!normalized.ok) return normalized;
  const entriesResult = registryMap(registry);
  if (!entriesResult.ok) return entriesResult;
  const entries = entriesResult.value;
  const normalizedLayout = normalized.value;
  const workspaceRect = {
    width: safeDimension(options.workspaceRect.width),
    height: safeDimension(options.workspaceRect.height),
  };
  const configuredRailSizes = {
    left: safeDimension(options.railSizes.left),
    right: safeDimension(options.railSizes.right),
    bottom: safeDimension(options.railSizes.bottom),
  };
  const railSizes: PanelWorkspaceRailSizes = {
    left:
      normalizedLayout.railOrder.left.length > 0 ? configuredRailSizes.left : 0,
    right:
      normalizedLayout.railOrder.right.length > 0
        ? configuredRailSizes.right
        : 0,
    bottom:
      normalizedLayout.railOrder.bottom.length > 0
        ? configuredRailSizes.bottom
        : 0,
  };
  const anchoredClusters = {
    left: findAnchoredCluster(normalizedLayout.clusters, "left"),
    right: findAnchoredCluster(normalizedLayout.clusters, "right"),
    bottom: findAnchoredCluster(normalizedLayout.clusters, "bottom"),
  };
  const demands = {
    left: clusterDemand(anchoredClusters.left, normalizedLayout.visibility),
    right: clusterDemand(anchoredClusters.right, normalizedLayout.visibility),
    bottom: clusterDemand(anchoredClusters.bottom, normalizedLayout.visibility),
  };
  const minimumHeights = {
    left: clusterMinimumHeight(
      anchoredClusters.left,
      normalizedLayout.visibility,
      entries,
    ),
    right: clusterMinimumHeight(
      anchoredClusters.right,
      normalizedLayout.visibility,
      entries,
    ),
  };
  const presentations: Record<
    PanelWorkspaceRailSide,
    PanelWorkspaceAnchorPresentation
  > = {
    left: demands.left.width > 0 ? "anchored" : "hidden",
    right: demands.right.width > 0 ? "anchored" : "hidden",
    bottom: demands.bottom.height > 0 ? "anchored" : "hidden",
  };

  const sideInset = (side: "left" | "right"): number =>
    railSizes[side] +
    (presentations[side] === "anchored"
      ? PANEL_WORKSPACE_GAP + demands[side].width
      : 0);
  if (
    sideInset("left") + sideInset("right") + MIN_PANEL_WORKSPACE_MAIN_WIDTH >
    workspaceRect.width
  ) {
    if (presentations.left === "anchored") {
      presentations.left = "constrained-overlay";
    }
    if (
      sideInset("left") + sideInset("right") + MIN_PANEL_WORKSPACE_MAIN_WIDTH >
        workspaceRect.width &&
      presentations.right === "anchored"
    ) {
      presentations.right = "constrained-overlay";
    }
  }
  for (const side of ["left", "right"] as const) {
    if (
      presentations[side] === "anchored" &&
      minimumHeights[side] >
        workspaceRect.height - railSizes.bottom - PANEL_WORKSPACE_GAP
    ) {
      presentations[side] = "constrained-overlay";
    }
  }

  const bottomInset = (): number =>
    railSizes.bottom +
    (presentations.bottom === "anchored"
      ? PANEL_WORKSPACE_GAP + demands.bottom.height
      : 0);
  if (
    bottomInset() + MIN_PANEL_WORKSPACE_MAIN_HEIGHT > workspaceRect.height &&
    presentations.bottom === "anchored"
  ) {
    presentations.bottom = "constrained-overlay";
  }

  // Activity rails and all production panels are workspace overlays. Legacy
  // anchored records are upgraded before rendering, and must not reserve Canvas.
  const occupiedInsets: PanelWorkspaceRailSizes = {
    left: 0,
    right: 0,
    bottom: 0,
  };
  const mainContentRect: PanelFrameGeometry = {
    x: Math.min(workspaceRect.width, occupiedInsets.left),
    y: 0,
    width: Math.max(
      0,
      workspaceRect.width - occupiedInsets.left - occupiedInsets.right,
    ),
    height: Math.max(0, workspaceRect.height - occupiedInsets.bottom),
  };

  const frameGeometries = new Map<PanelId, PanelWorkspaceSolvedFrameGeometry>();
  for (const side of RAIL_SIDES) {
    const cluster = anchoredClusters[side];
    const presentation = presentations[side];
    if (!cluster || presentation === "hidden") continue;
    placeClusterFrames(
      cluster,
      presentation,
      workspaceRect,
      railSizes,
      normalizedLayout.visibility,
      entries,
      frameGeometries,
    );
  }
  for (const cluster of normalizedLayout.clusters) {
    if (cluster.anchor !== "floating") continue;
    placeClusterFrames(
      cluster,
      "floating",
      workspaceRect,
      railSizes,
      normalizedLayout.visibility,
      entries,
      frameGeometries,
    );
  }

  const constrainedOverlayOrder = (["bottom", "left", "right"] as const).filter(
    (side) => presentations[side] === "constrained-overlay",
  );

  return {
    ok: true,
    value: {
      layout: normalizedLayout,
      workspaceRect,
      mainContentRect,
      occupiedInsets,
      presentations,
      frameGeometries,
      visiblePanelIds: new Set(frameGeometries.keys()),
      constrainedOverlayOrder,
    },
  };
}
