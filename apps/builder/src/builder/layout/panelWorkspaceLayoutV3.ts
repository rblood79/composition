import type { PanelId } from "../panels/core/types";
import type {
  PanelWorkspaceRect,
  PanelWorkspaceRegistryEntry,
  PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import {
  createDefaultPanelWorkspaceLayoutV4,
  normalizePanelWorkspaceLayoutV4,
  parsePanelWorkspaceLayoutV4,
  solvePanelWorkspaceLayoutV4,
  type PanelWorkspaceClusterV4,
  type PanelWorkspaceColumnV4,
  type PanelWorkspaceLayoutV4,
  type PanelWorkspaceRowV4,
  type PanelWorkspaceSolvedClusterGeometryV4,
  type PanelWorkspaceSolvedFrameGeometryV4,
} from "./panelWorkspaceLayoutV4";
import { canonicalizePersistedPanelIds } from "./panelWorkspacePanelIdMigration";

export {
  PANEL_WORKSPACE_DEFAULT_ZONE_BY_RAIL,
  PANEL_WORKSPACE_PLACEMENT_ZONES,
  PANEL_WORKSPACE_SNAP_ZONES,
  isPanelWorkspacePlacementZone,
  panelWorkspaceZoneOrigin,
  validatePanelWorkspacePlacementSurface,
  type PanelWorkspacePlacementZone,
} from "./panelWorkspaceLayoutV4";

export const PANEL_WORKSPACE_LAYOUT_V3_VERSION = 3 as const;

export interface PanelWorkspaceMigrationSourceV3 {
  version: 2;
  migrationId: string;
}

export type PanelWorkspaceRowV3 = PanelWorkspaceRowV4;
export type PanelWorkspaceColumnV3 = PanelWorkspaceColumnV4;
export type PanelWorkspaceClusterV3 = PanelWorkspaceClusterV4;
export type PanelWorkspaceSolvedClusterGeometryV3 =
  PanelWorkspaceSolvedClusterGeometryV4;
export type PanelWorkspaceSolvedFrameGeometryV3 =
  PanelWorkspaceSolvedFrameGeometryV4;

export interface PanelWorkspaceLayoutV3 {
  version: typeof PANEL_WORKSPACE_LAYOUT_V3_VERSION;
  migrationSource?: PanelWorkspaceMigrationSourceV3;
  visibility: Partial<Record<PanelId, boolean>>;
  railOrder: PanelWorkspaceLayoutV4["railOrder"];
  clusters: PanelWorkspaceClusterV3[];
  clusterFocusOrder: string[];
}

export interface PanelWorkspaceLayoutSolutionV3 {
  layout: PanelWorkspaceLayoutV3;
  surfaceRect: PanelWorkspaceRect;
  clusterGeometries: ReadonlyMap<string, PanelWorkspaceSolvedClusterGeometryV3>;
  frameGeometries: ReadonlyMap<PanelId, PanelWorkspaceSolvedFrameGeometryV3>;
  visiblePanelIds: ReadonlySet<PanelId>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function migrationSourceFromInput(
  input: Record<string, unknown>,
): PanelWorkspaceResult<PanelWorkspaceMigrationSourceV3 | undefined> {
  if (input.migrationSource === undefined) {
    return { ok: true, value: undefined };
  }
  if (
    !isRecord(input.migrationSource) ||
    input.migrationSource.version !== 2 ||
    typeof input.migrationSource.migrationId !== "string" ||
    input.migrationSource.migrationId.length === 0
  ) {
    return { ok: false, error: "Invalid v3 migration source" };
  }
  return {
    ok: true,
    value: {
      version: 2,
      migrationId: input.migrationSource.migrationId,
    },
  };
}

export function upgradePanelWorkspaceLayoutV3ToV4(
  layout: PanelWorkspaceLayoutV3,
  migrationId?: string,
): PanelWorkspaceLayoutV4 {
  return {
    version: 4,
    ...(migrationId
      ? { migrationSource: { version: 3 as const, migrationId } }
      : {}),
    visibility: { ...layout.visibility },
    railOrder: {
      left: [...layout.railOrder.left],
      right: [...layout.railOrder.right],
      bottom: [...layout.railOrder.bottom],
    },
    clusters: layout.clusters.map((cluster) => ({
      ...cluster,
      ...(cluster.originOffset
        ? { originOffset: { ...cluster.originOffset } }
        : {}),
      columns: cluster.columns.map((column) => ({
        ...column,
        rows: column.rows.map((row) => ({ ...row })),
      })),
    })),
    clusterFocusOrder: [...layout.clusterFocusOrder],
  };
}

function downgradePanelWorkspaceLayoutV4ToV3(
  layout: PanelWorkspaceLayoutV4,
  migrationSource?: PanelWorkspaceMigrationSourceV3,
): PanelWorkspaceLayoutV3 {
  const { migrationSource: _migrationSource, ...v4Born } = layout;
  return {
    ...v4Born,
    version: 3,
    ...(migrationSource ? { migrationSource } : {}),
  };
}

export function normalizePanelWorkspaceLayoutV3(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const normalized = normalizePanelWorkspaceLayoutV4(
    upgradePanelWorkspaceLayoutV3ToV4(layout),
    registry,
    surfaceRect,
  );
  if (!normalized.ok) return normalized;
  return {
    ok: true,
    value: downgradePanelWorkspaceLayoutV4ToV3(
      normalized.value,
      layout.migrationSource,
    ),
  };
}

export function parsePanelWorkspaceLayoutV3(
  input: unknown,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const canonical = canonicalizePersistedPanelIds(input);
  if (!isRecord(canonical) || canonical.version !== 3) {
    return { ok: false, error: "Panel layout is not a v3 record" };
  }
  const source = migrationSourceFromInput(canonical);
  if (!source.ok) return source;
  const { migrationSource: _migrationSource, ...layout } = canonical;
  const parsed = parsePanelWorkspaceLayoutV4(
    { ...layout, version: 4 },
    registry,
    surfaceRect,
  );
  if (!parsed.ok) return parsed;
  return {
    ok: true,
    value: downgradePanelWorkspaceLayoutV4ToV3(parsed.value, source.value),
  };
}

export function solvePanelWorkspaceLayoutV3(
  layout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutSolutionV3> {
  const solved = solvePanelWorkspaceLayoutV4(
    upgradePanelWorkspaceLayoutV3ToV4(layout),
    registry,
    surfaceRect,
  );
  if (!solved.ok) return solved;
  return {
    ok: true,
    value: {
      ...solved.value,
      layout: downgradePanelWorkspaceLayoutV4ToV3(
        solved.value.layout,
        layout.migrationSource,
      ),
    },
  };
}

export function createDefaultPanelWorkspaceLayoutV3(
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  visibility?: Partial<Record<PanelId, boolean>>,
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const created = createDefaultPanelWorkspaceLayoutV4(
    registry,
    surfaceRect,
    visibility,
  );
  if (!created.ok) return created;
  return {
    ok: true,
    value: downgradePanelWorkspaceLayoutV4ToV3(created.value),
  };
}
