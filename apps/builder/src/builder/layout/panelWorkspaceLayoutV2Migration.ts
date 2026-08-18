import type {
  ModalPanelState,
  PanelClusterState,
  PanelId,
  PanelLayoutState,
  PanelSize,
} from "../panels/core/types";
import {
  PANEL_WORKSPACE_GAP,
  PANEL_WORKSPACE_LAYOUT_VERSION,
  normalizePanelWorkspaceLayoutV2,
  resolvePanelWorkspaceDefaultSize,
  type PanelWorkspaceAnchor,
  type PanelWorkspaceClusterV2,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRailSide,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";

export interface PanelWorkspaceLegacyProjectionMetadata {
  railOrder: Record<PanelWorkspaceRailSide, PanelId[]>;
  placements: Partial<Record<PanelId, PanelWorkspaceAnchor>>;
  preferredSizes: Partial<Record<PanelId, PanelSize>>;
}

export interface PanelWorkspaceLegacyView {
  source: "primary-v1" | "backup-v1" | "projected-v2" | "default";
  layout: PanelLayoutState;
  metadata: PanelWorkspaceLegacyProjectionMetadata;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function uniqueKnownIds(
  value: unknown,
  knownIds: ReadonlySet<PanelId>,
): PanelId[] | null {
  if (!Array.isArray(value)) return null;
  const ids: PanelId[] = [];
  for (const candidate of value) {
    if (
      typeof candidate !== "string" ||
      !knownIds.has(candidate as PanelId) ||
      ids.includes(candidate as PanelId)
    ) {
      continue;
    }
    ids.push(candidate as PanelId);
  }
  return ids;
}

function normalizeV1RailOrder(
  input: Record<string, unknown>,
  registry: readonly PanelWorkspaceRegistryEntry[],
  defaults: PanelLayoutState,
): Record<PanelWorkspaceRailSide, PanelId[]> {
  const knownIds = new Set(registry.map(({ id }) => id));
  const source = {
    left:
      uniqueKnownIds(input.leftPanels, knownIds) ??
      uniqueKnownIds(defaults.leftPanels, knownIds) ??
      [],
    right:
      uniqueKnownIds(input.rightPanels, knownIds) ??
      uniqueKnownIds(defaults.rightPanels, knownIds) ??
      [],
    bottom:
      uniqueKnownIds(input.bottomPanels, knownIds) ??
      uniqueKnownIds(defaults.bottomPanels, knownIds) ??
      [],
  };
  const seen = new Set<PanelId>();
  const railOrder: Record<PanelWorkspaceRailSide, PanelId[]> = {
    left: [],
    right: [],
    bottom: [],
  };
  for (const side of ["left", "right", "bottom"] as const) {
    for (const panelId of source[side]) {
      if (seen.has(panelId)) continue;
      seen.add(panelId);
      railOrder[side].push(panelId);
    }
  }
  for (const entry of registry) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    railOrder[entry.defaultPosition].push(entry.id);
  }
  return railOrder;
}

function parseV1ActivePanels(
  input: Record<string, unknown>,
  arrayKey: "activeLeftPanels" | "activeRightPanels",
  singularKey: "activeLeftPanel" | "activeRightPanel",
  knownIds: ReadonlySet<PanelId>,
  defaults: readonly PanelId[],
): PanelId[] {
  const activePanels = uniqueKnownIds(input[arrayKey], knownIds);
  if (activePanels) return activePanels;
  const singular = input[singularKey];
  if (typeof singular === "string" && knownIds.has(singular as PanelId)) {
    return [singular as PanelId];
  }
  return uniqueKnownIds(defaults, knownIds) ?? [];
}

function parseV1PanelSizes(
  value: unknown,
  registry: ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>,
): Partial<Record<PanelId, PanelSize>> {
  if (!isRecord(value)) return {};
  const sizes: Partial<Record<PanelId, PanelSize>> = {};
  for (const [rawPanelId, rawSize] of Object.entries(value)) {
    const panelId = rawPanelId as PanelId;
    const entry = registry.get(panelId);
    if (
      !entry ||
      !isRecord(rawSize) ||
      !isFiniteNumber(rawSize.width) ||
      !isFiniteNumber(rawSize.height)
    ) {
      continue;
    }
    sizes[panelId] = resolvePanelWorkspaceDefaultSize(entry, {
      width: rawSize.width,
      height: rawSize.height,
    });
  }
  return sizes;
}

function parseV1ModalPanels(
  value: unknown,
  registry: ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>,
): ModalPanelState[] {
  if (!Array.isArray(value)) return [];
  const panels: ModalPanelState[] = [];
  const seen = new Set<PanelId>();
  for (const rawPanel of value) {
    if (!isRecord(rawPanel) || typeof rawPanel.panelId !== "string") continue;
    const panelId = rawPanel.panelId as PanelId;
    const entry = registry.get(panelId);
    if (
      !entry ||
      seen.has(panelId) ||
      !isRecord(rawPanel.position) ||
      !isFiniteNumber(rawPanel.position.x) ||
      !isFiniteNumber(rawPanel.position.y) ||
      !isRecord(rawPanel.size) ||
      !isFiniteNumber(rawPanel.size.width) ||
      !isFiniteNumber(rawPanel.size.height)
    ) {
      continue;
    }
    const size = resolvePanelWorkspaceDefaultSize(entry, {
      width: rawPanel.size.width,
      height: rawPanel.size.height,
    });
    panels.push({
      panelId,
      mode: "floating",
      position: { x: rawPanel.position.x, y: rawPanel.position.y },
      size,
      zIndex: isFiniteNumber(rawPanel.zIndex) ? rawPanel.zIndex : 1000,
    });
    seen.add(panelId);
  }
  return panels;
}

function parseV1PanelClusters(
  value: unknown,
  knownIds: ReadonlySet<PanelId>,
): PanelClusterState[] {
  if (!Array.isArray(value)) return [];
  const clusters: PanelClusterState[] = [];
  for (const rawCluster of value) {
    if (
      !isRecord(rawCluster) ||
      typeof rawCluster.id !== "string" ||
      rawCluster.id.length === 0 ||
      !isRecord(rawCluster.position) ||
      !isFiniteNumber(rawCluster.position.x) ||
      !isFiniteNumber(rawCluster.position.y) ||
      !Array.isArray(rawCluster.columns)
    ) {
      continue;
    }
    const columns = rawCluster.columns.flatMap((rawColumn) => {
      if (
        !isRecord(rawColumn) ||
        !isFiniteNumber(rawColumn.width) ||
        !Array.isArray(rawColumn.panelIds)
      ) {
        return [];
      }
      const panelIds = rawColumn.panelIds.filter(
        (panelId): panelId is PanelId =>
          typeof panelId === "string" && knownIds.has(panelId as PanelId),
      );
      return panelIds.length > 0
        ? [{ width: rawColumn.width, panelIds: [...new Set(panelIds)] }]
        : [];
    });
    if (columns.length === 0) continue;
    clusters.push({
      id: rawCluster.id,
      position: { x: rawCluster.position.x, y: rawCluster.position.y },
      columns,
    });
  }
  return clusters;
}

export function parsePanelLayoutV1(
  input: unknown,
  registry: readonly PanelWorkspaceRegistryEntry[],
  defaults: PanelLayoutState,
): PanelWorkspaceResult<PanelLayoutState> {
  if (!isRecord(input) || input.version === PANEL_WORKSPACE_LAYOUT_VERSION) {
    return { ok: false, error: "Panel layout is not a v1 record" };
  }
  const registryById = new Map(registry.map((entry) => [entry.id, entry]));
  if (registryById.size !== registry.length) {
    const duplicate = registry.find(
      (entry, index) =>
        registry.findIndex((candidate) => candidate.id === entry.id) !== index,
    );
    return {
      ok: false,
      error: `Duplicate panel registry id "${duplicate?.id ?? "unknown"}"`,
    };
  }
  const knownIds = new Set(registryById.keys());
  const railOrder = normalizeV1RailOrder(input, registry, defaults);
  const activeLeftPanels = parseV1ActivePanels(
    input,
    "activeLeftPanels",
    "activeLeftPanel",
    knownIds,
    defaults.activeLeftPanels,
  );
  const activeRightPanels = parseV1ActivePanels(
    input,
    "activeRightPanels",
    "activeRightPanel",
    knownIds,
    defaults.activeRightPanels,
  );
  const activeBottomPanels =
    uniqueKnownIds(input.activeBottomPanels, knownIds) ??
    uniqueKnownIds(defaults.activeBottomPanels, knownIds) ??
    [];
  const panelSizes = parseV1PanelSizes(input.panelSizes, registryById);
  const modalPanels = parseV1ModalPanels(input.modalPanels, registryById);
  const panelClusters = parseV1PanelClusters(input.panelClusters, knownIds);

  return {
    ok: true,
    value: {
      leftPanels: railOrder.left,
      rightPanels: railOrder.right,
      bottomPanels: railOrder.bottom,
      activeLeftPanels,
      activeRightPanels,
      activeBottomPanels,
      showLeft:
        typeof input.showLeft === "boolean"
          ? input.showLeft
          : defaults.showLeft,
      showRight:
        typeof input.showRight === "boolean"
          ? input.showRight
          : defaults.showRight,
      showBottom:
        typeof input.showBottom === "boolean"
          ? input.showBottom
          : defaults.showBottom,
      bottomHeight: isFiniteNumber(input.bottomHeight)
        ? Math.max(0, input.bottomHeight)
        : defaults.bottomHeight,
      panelSizes,
      modalPanels,
      panelClusters,
      nextModalZIndex: isFiniteNumber(input.nextModalZIndex)
        ? input.nextModalZIndex
        : defaults.nextModalZIndex,
    },
  };
}

function panelSide(
  layout: PanelLayoutState,
  panelId: PanelId,
): PanelWorkspaceRailSide | null {
  if (layout.leftPanels.includes(panelId)) return "left";
  if (layout.rightPanels.includes(panelId)) return "right";
  if (layout.bottomPanels.includes(panelId)) return "bottom";
  return null;
}

function panelIsVisible(layout: PanelLayoutState, panelId: PanelId): boolean {
  const side = panelSide(layout, panelId);
  if (side === "left") {
    return layout.showLeft && layout.activeLeftPanels.includes(panelId);
  }
  if (side === "right") {
    return layout.showRight && layout.activeRightPanels.includes(panelId);
  }
  if (side === "bottom") {
    return layout.showBottom && layout.activeBottomPanels.includes(panelId);
  }
  return false;
}

function preferredV1Size(
  layout: PanelLayoutState,
  entry: PanelWorkspaceRegistryEntry,
  modalPanel?: ModalPanelState,
): PanelSize {
  const preferred =
    modalPanel?.size ??
    layout.panelSizes[entry.id] ??
    (entry.defaultPosition === "bottom"
      ? { width: entry.defaultWidth, height: layout.bottomHeight }
      : undefined);
  return resolvePanelWorkspaceDefaultSize(entry, preferred);
}

function anchoredClusterFromV1(
  side: PanelWorkspaceRailSide,
  panelIds: readonly PanelId[],
  layout: PanelLayoutState,
  registry: ReadonlyMap<PanelId, PanelWorkspaceRegistryEntry>,
): PanelWorkspaceClusterV2 | null {
  const knownPanelIds = panelIds.filter((panelId) => registry.has(panelId));
  if (knownPanelIds.length === 0) return null;
  const knownPanelIdSet = new Set(knownPanelIds);
  const activePanelIds =
    side === "left"
      ? layout.activeLeftPanels
      : side === "right"
        ? layout.activeRightPanels
        : layout.activeBottomPanels;
  const visiblePanelIds = activePanelIds.filter(
    (panelId) =>
      knownPanelIdSet.has(panelId) && panelIsVisible(layout, panelId),
  );
  const leadingPanelIds = (
    side === "right" ? [...visiblePanelIds].reverse() : visiblePanelIds
  ).slice(0, 2);
  if (leadingPanelIds.length === 0) leadingPanelIds.push(knownPanelIds[0]!);
  const columns = leadingPanelIds.flatMap((panelId, columnIndex) => {
    const entry = registry.get(panelId);
    if (!entry) return [];
    const size = preferredV1Size(layout, entry);
    return [
      {
        id: `anchor:${side}:column:${columnIndex}`,
        width: size.width,
        rows: [{ panelId, height: size.height }],
      },
    ];
  });
  const placedPanelIds = new Set(
    columns.flatMap((column) => column.rows.map((row) => row.panelId)),
  );
  for (const panelId of knownPanelIds) {
    if (placedPanelIds.has(panelId)) continue;
    const entry = registry.get(panelId);
    if (!entry) continue;
    const size = preferredV1Size(layout, entry);
    const targetColumn = columns.reduce((closest, column) =>
      Math.abs(column.width - size.width) < Math.abs(closest.width - size.width)
        ? column
        : closest,
    );
    targetColumn.rows.push({ panelId, height: size.height });
  }
  return {
    id: `anchor:${side}`,
    anchor: side,
    columns,
  };
}

export function migratePanelLayoutV1ToV2(
  layout: PanelLayoutState,
  registry: readonly PanelWorkspaceRegistryEntry[],
  migrationId: string,
): PanelWorkspaceLayoutV2 {
  if (migrationId.length === 0) throw new Error("migrationId is required");
  const registryById = new Map(registry.map((entry) => [entry.id, entry]));
  const modalById = new Map(
    layout.modalPanels.map((panel) => [panel.panelId, panel]),
  );
  const visibility: Partial<Record<PanelId, boolean>> = {};
  for (const entry of registry) {
    visibility[entry.id] = panelIsVisible(layout, entry.id);
  }

  const clusters: PanelWorkspaceClusterV2[] = [];
  const floatingPanelIds = new Set<PanelId>();
  const floatingClusterZ = new Map<string, number>();
  for (const sourceCluster of layout.panelClusters) {
    const columns = sourceCluster.columns.flatMap(
      (sourceColumn, columnIndex) => {
        const rows = sourceColumn.panelIds.flatMap((panelId) => {
          const entry = registryById.get(panelId);
          const modalPanel = modalById.get(panelId);
          if (!entry || !modalPanel || floatingPanelIds.has(panelId)) return [];
          floatingPanelIds.add(panelId);
          return [
            {
              panelId,
              height: preferredV1Size(layout, entry, modalPanel).height,
            },
          ];
        });
        return rows.length > 0
          ? [
              {
                id: `floating:${sourceCluster.id}:column:${columnIndex}`,
                width: sourceColumn.width,
                rows,
              },
            ]
          : [];
      },
    );
    if (columns.length === 0) continue;
    const clusterId = `floating:${sourceCluster.id}`;
    clusters.push({
      id: clusterId,
      anchor: "floating",
      position: { ...sourceCluster.position },
      columns,
    });
    floatingClusterZ.set(
      clusterId,
      Math.max(
        ...columns.flatMap((column) =>
          column.rows.map((row) => modalById.get(row.panelId)?.zIndex ?? 1000),
        ),
      ),
    );
  }

  const unclusteredFloating = [...modalById.values()]
    .filter((panel) => !floatingPanelIds.has(panel.panelId))
    .sort((left, right) => left.zIndex - right.zIndex);
  for (const modalPanel of unclusteredFloating) {
    const entry = registryById.get(modalPanel.panelId);
    if (!entry) continue;
    floatingPanelIds.add(modalPanel.panelId);
    const size = preferredV1Size(layout, entry, modalPanel);
    const clusterId = `floating:${modalPanel.panelId}`;
    clusters.push({
      id: clusterId,
      anchor: "floating",
      position: { ...modalPanel.position },
      columns: [
        {
          id: `${clusterId}:column:0`,
          width: size.width,
          rows: [{ panelId: entry.id, height: size.height }],
        },
      ],
    });
    floatingClusterZ.set(clusterId, modalPanel.zIndex);
  }

  const railOrder = {
    left: [...layout.leftPanels],
    right: [...layout.rightPanels],
    bottom: [...layout.bottomPanels],
  };
  for (const side of ["left", "right", "bottom"] as const) {
    const cluster = anchoredClusterFromV1(
      side,
      railOrder[side].filter((panelId) => !floatingPanelIds.has(panelId)),
      layout,
      registryById,
    );
    if (cluster) clusters.push(cluster);
  }

  const candidate: PanelWorkspaceLayoutV2 = {
    version: PANEL_WORKSPACE_LAYOUT_VERSION,
    migrationSource: { version: 1, migrationId },
    visibility,
    railOrder,
    clusters,
    floatingFocusOrder: [...floatingClusterZ.entries()]
      .sort((left, right) => left[1] - right[1])
      .map(([clusterId]) => clusterId),
  };
  const normalized = normalizePanelWorkspaceLayoutV2(candidate, registry);
  if (!normalized.ok) throw new Error(normalized.error);
  return normalized.value;
}

function cloneRailOrder(
  railOrder: Record<PanelWorkspaceRailSide, PanelId[]>,
): Record<PanelWorkspaceRailSide, PanelId[]> {
  return {
    left: [...railOrder.left],
    right: [...railOrder.right],
    bottom: [...railOrder.bottom],
  };
}

export function createPanelWorkspaceLegacyViewFromV1(
  layout: PanelLayoutState,
  registry: readonly PanelWorkspaceRegistryEntry[],
  source: "primary-v1" | "backup-v1" | "default",
): PanelWorkspaceLegacyView {
  const railOrder = {
    left: [...layout.leftPanels],
    right: [...layout.rightPanels],
    bottom: [...layout.bottomPanels],
  };
  const modalById = new Map(
    layout.modalPanels.map((panel) => [panel.panelId, panel]),
  );
  const placements: Partial<Record<PanelId, PanelWorkspaceAnchor>> = {};
  const preferredSizes: Partial<Record<PanelId, PanelSize>> = {};
  for (const entry of registry) {
    const modal = modalById.get(entry.id);
    const side = panelSide(layout, entry.id) ?? entry.defaultPosition;
    placements[entry.id] = modal ? "floating" : side;
    preferredSizes[entry.id] = preferredV1Size(layout, entry, modal);
  }
  return {
    source,
    layout: {
      ...layout,
      leftPanels: [...layout.leftPanels],
      rightPanels: [...layout.rightPanels],
      bottomPanels: [...layout.bottomPanels],
      activeLeftPanels: [...layout.activeLeftPanels],
      activeRightPanels: [...layout.activeRightPanels],
      activeBottomPanels: [...layout.activeBottomPanels],
      panelSizes: Object.fromEntries(
        Object.entries(layout.panelSizes).map(([panelId, size]) => [
          panelId,
          size ? { ...size } : size,
        ]),
      ),
      modalPanels: layout.modalPanels.map((panel) => ({
        ...panel,
        position: { ...panel.position },
        size: { ...panel.size },
      })),
      panelClusters: layout.panelClusters.map((cluster) => ({
        ...cluster,
        position: { ...cluster.position },
        columns: cluster.columns.map((column) => ({
          ...column,
          panelIds: [...column.panelIds],
        })),
      })),
    },
    metadata: { railOrder, placements, preferredSizes },
  };
}

export function projectV2ToLegacyView(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  defaults: PanelLayoutState,
): PanelWorkspaceLegacyView {
  const normalized = normalizePanelWorkspaceLayoutV2(layout, registry);
  if (!normalized.ok) throw new Error(normalized.error);
  const value = normalized.value;
  const placements: Partial<Record<PanelId, PanelWorkspaceAnchor>> = {};
  const preferredSizes: Partial<Record<PanelId, PanelSize>> = {};
  const panelSizes: Partial<Record<PanelId, PanelSize>> = {};
  const modalPanels: ModalPanelState[] = [];
  const panelClusters: PanelClusterState[] = [];
  const focusIndex = new Map(
    value.floatingFocusOrder.map((clusterId, index) => [clusterId, index]),
  );

  for (const cluster of value.clusters) {
    let x = cluster.anchor === "floating" ? cluster.position.x : 0;
    const projectedColumns: PanelClusterState["columns"] = [];
    for (const column of cluster.columns) {
      let y = cluster.anchor === "floating" ? cluster.position.y : 0;
      const panelIds: PanelId[] = [];
      for (const row of column.rows) {
        placements[row.panelId] = cluster.anchor;
        preferredSizes[row.panelId] = {
          width: column.width,
          height: row.height,
        };
        panelSizes[row.panelId] = {
          width: column.width,
          height: row.height,
        };
        panelIds.push(row.panelId);
        if (cluster.anchor === "floating") {
          modalPanels.push({
            panelId: row.panelId,
            mode: "floating",
            position: { x, y },
            size: { width: column.width, height: row.height },
            zIndex: 1000 + (focusIndex.get(cluster.id) ?? 0),
          });
          y += row.height + PANEL_WORKSPACE_GAP;
        }
      }
      if (panelIds.length > 0) {
        projectedColumns.push({ width: column.width, panelIds });
      }
      x += column.width + PANEL_WORKSPACE_GAP;
    }
    if (
      cluster.anchor === "floating" &&
      projectedColumns.reduce(
        (total, column) => total + column.panelIds.length,
        0,
      ) >= 2
    ) {
      panelClusters.push({
        id: cluster.id,
        position: { ...cluster.position },
        columns: projectedColumns,
      });
    }
  }

  const visibleOnRail = (side: PanelWorkspaceRailSide): PanelId[] =>
    value.railOrder[side].filter(
      (panelId) => value.visibility[panelId] === true,
    );
  const activeLeftPanels = visibleOnRail("left");
  const activeRightPanels = visibleOnRail("right");
  const activeBottomPanels = visibleOnRail("bottom");
  const monitorHeight = preferredSizes.monitor?.height;

  return {
    source: "projected-v2",
    layout: {
      leftPanels: [...value.railOrder.left],
      rightPanels: [...value.railOrder.right],
      bottomPanels: [...value.railOrder.bottom],
      activeLeftPanels,
      activeRightPanels,
      activeBottomPanels,
      showLeft: activeLeftPanels.length > 0,
      showRight: activeRightPanels.length > 0,
      showBottom: activeBottomPanels.length > 0,
      bottomHeight: monitorHeight ?? defaults.bottomHeight,
      panelSizes,
      modalPanels,
      panelClusters,
      nextModalZIndex: Math.max(
        defaults.nextModalZIndex,
        1001 + value.floatingFocusOrder.length,
      ),
    },
    metadata: {
      railOrder: cloneRailOrder(value.railOrder),
      placements,
      preferredSizes,
    },
  };
}
