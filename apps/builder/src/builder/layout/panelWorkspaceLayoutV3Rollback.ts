import {
  PANEL_WORKSPACE_GAP,
  parsePanelWorkspaceLayoutV2,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
  type PanelWorkspaceStorage,
} from "./panelWorkspaceLayoutV2Persistence";
import {
  panelWorkspaceZoneOrigin,
  parsePanelWorkspaceLayoutV3,
  solvePanelWorkspaceLayoutV3,
  type PanelWorkspaceClusterV3,
  type PanelWorkspaceLayoutV3,
} from "./panelWorkspaceLayoutV3";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import {
  PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY,
  parsePanelLayoutV2BackupEnvelope,
} from "./panelWorkspaceLayoutV3Persistence";

export const PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY =
  "composition-panel-layout.v3-rollback-backup";

export interface PanelLayoutV3RollbackEnvelope {
  sourceVersion: 3;
  rollbackId: string;
  raw: string;
  targetRaw: string;
  targetKind: "exact-v2" | "projected-v2";
  state: "prepared" | "committed";
  updatedAt: string;
}

export type PanelWorkspaceV3RollbackFailureStage =
  | "read-primary"
  | "read-v2-backup"
  | "read-rollback-backup"
  | "parse-primary"
  | "backup-mismatch"
  | "project-layout"
  | "prepare-backup"
  | "primary-changed"
  | "write-primary"
  | "commit-backup";

export type PanelWorkspaceStorageV3RollbackResult =
  | {
      status: "rolled-back" | "recovered-commit" | "already-v2";
      layout: PanelWorkspaceLayoutV2;
      rollbackId: string | null;
    }
  | { status: "not-applicable" }
  | {
      status: "failed";
      stage: PanelWorkspaceV3RollbackFailureStage;
      error: string;
    };

export interface RollbackPanelWorkspaceStorageToV2Options {
  storage: PanelWorkspaceStorage;
  registry: readonly PanelWorkspaceRegistryEntry[];
  surfaceRect: PanelWorkspaceRect;
  createRollbackId: () => string;
  now: () => string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(raw: string): PanelWorkspaceResult<unknown> {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false, error: "Invalid JSON" };
  }
}

function parseV2Raw(
  raw: string,
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelWorkspaceResult<PanelWorkspaceLayoutV2> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  return parsePanelWorkspaceLayoutV2(parsed.value, registry);
}

function parseV3Raw(
  raw: string,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  return parsePanelWorkspaceLayoutV3(parsed.value, registry, surfaceRect);
}

function rawVersion(raw: string): number | null {
  const parsed = parseJson(raw);
  if (!parsed.ok || !isRecord(parsed.value)) return null;
  return typeof parsed.value.version === "number" ? parsed.value.version : null;
}

function failure(
  stage: PanelWorkspaceV3RollbackFailureStage,
  error: unknown,
): PanelWorkspaceStorageV3RollbackResult {
  return {
    status: "failed",
    stage,
    error: error instanceof Error ? error.message : String(error),
  };
}

export function parsePanelLayoutV3RollbackEnvelope(
  input: unknown,
): PanelWorkspaceResult<PanelLayoutV3RollbackEnvelope> {
  let value = input;
  if (typeof input === "string") {
    const parsed = parseJson(input);
    if (!parsed.ok) return parsed;
    value = parsed.value;
  }
  if (
    !isRecord(value) ||
    value.sourceVersion !== 3 ||
    typeof value.rollbackId !== "string" ||
    value.rollbackId.length === 0 ||
    typeof value.raw !== "string" ||
    typeof value.targetRaw !== "string" ||
    (value.targetKind !== "exact-v2" && value.targetKind !== "projected-v2") ||
    (value.state !== "prepared" && value.state !== "committed") ||
    typeof value.updatedAt !== "string"
  ) {
    return { ok: false, error: "Invalid v3 rollback envelope" };
  }
  return {
    ok: true,
    value: {
      sourceVersion: 3,
      rollbackId: value.rollbackId,
      raw: value.raw,
      targetRaw: value.targetRaw,
      targetKind: value.targetKind,
      state: value.state,
      updatedAt: value.updatedAt,
    },
  };
}

function storedClusterSize(cluster: PanelWorkspaceClusterV3): {
  width: number;
  height: number;
} {
  return {
    width:
      cluster.columns.reduce((sum, column) => sum + column.width, 0) +
      PANEL_WORKSPACE_GAP * Math.max(0, cluster.columns.length - 1),
    height: Math.max(
      0,
      ...cluster.columns.map(
        (column) =>
          column.rows.reduce((sum, row) => sum + row.height, 0) +
          PANEL_WORKSPACE_GAP * Math.max(0, column.rows.length - 1),
      ),
    ),
  };
}

export function projectPanelWorkspaceLayoutV3ToV2(
  input: unknown,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutV2> {
  const parsed = parsePanelWorkspaceLayoutV3(input, registry, surfaceRect);
  if (!parsed.ok) return parsed;
  const solved = solvePanelWorkspaceLayoutV3(
    parsed.value,
    registry,
    surfaceRect,
  );
  if (!solved.ok) return solved;

  const projected: PanelWorkspaceLayoutV2 = {
    version: 2,
    visibility: { ...solved.value.layout.visibility },
    railOrder: {
      left: [...solved.value.layout.railOrder.left],
      right: [...solved.value.layout.railOrder.right],
      bottom: [...solved.value.layout.railOrder.bottom],
    },
    clusters: solved.value.layout.clusters.map((cluster) => {
      const solvedGeometry = solved.value.clusterGeometries.get(cluster.id);
      const position = solvedGeometry
        ? { x: solvedGeometry.x, y: solvedGeometry.y }
        : panelWorkspaceZoneOrigin(
            cluster.placementZone,
            surfaceRect,
            storedClusterSize(cluster),
          );
      return {
        id: cluster.id,
        anchor: "floating" as const,
        position,
        columns: cluster.columns.map((column) => ({
          id: column.id,
          width: column.width,
          rows: column.rows.map((row) => ({ ...row })),
        })),
      };
    }),
    floatingFocusOrder: [...solved.value.layout.clusterFocusOrder],
  };
  return parsePanelWorkspaceLayoutV2(projected, registry);
}

function exactV2Target(
  primaryRaw: string,
  layout: PanelWorkspaceLayoutV3,
  v2BackupRaw: string | null,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<string | null> {
  const migrationId = layout.migrationSource?.migrationId;
  if (!migrationId || v2BackupRaw === null) {
    return { ok: true, value: null };
  }
  const backup = parsePanelLayoutV2BackupEnvelope(v2BackupRaw);
  if (!backup.ok || backup.value.migrationId !== migrationId) {
    return {
      ok: false,
      error: "V3 migration source does not match its v2 backup",
    };
  }
  const backupLayout = parseJson(backup.value.raw);
  if (!backupLayout.ok) return backupLayout;
  const migrated = migratePanelWorkspaceLayoutV2ToV3(
    backupLayout.value,
    registry,
    { surfaceRect, migrationId },
  );
  if (!migrated.ok) return migrated;
  return {
    ok: true,
    value:
      JSON.stringify(migrated.value) === primaryRaw ? backup.value.raw : null,
  };
}

function preparedEnvelope(
  raw: string,
  targetRaw: string,
  targetKind: PanelLayoutV3RollbackEnvelope["targetKind"],
  rollbackId: string,
  updatedAt: string,
): PanelLayoutV3RollbackEnvelope {
  return {
    sourceVersion: 3,
    rollbackId,
    raw,
    targetRaw,
    targetKind,
    state: "prepared",
    updatedAt,
  };
}

function committedEnvelope(
  envelope: PanelLayoutV3RollbackEnvelope,
  updatedAt: string,
): PanelLayoutV3RollbackEnvelope {
  return { ...envelope, state: "committed", updatedAt };
}

export function rollbackPanelWorkspaceStorageToV2({
  storage,
  registry,
  surfaceRect,
  createRollbackId,
  now,
}: RollbackPanelWorkspaceStorageToV2Options): PanelWorkspaceStorageV3RollbackResult {
  let primaryRaw: string | null;
  let rollbackRaw: string | null;
  let v2BackupRaw: string | null;
  try {
    primaryRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
  } catch (error) {
    return failure("read-primary", error);
  }
  try {
    rollbackRaw = storage.getItem(
      PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY,
    );
  } catch (error) {
    return failure("read-rollback-backup", error);
  }
  try {
    v2BackupRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY);
  } catch (error) {
    return failure("read-v2-backup", error);
  }
  if (primaryRaw === null) {
    return rollbackRaw === null
      ? { status: "not-applicable" }
      : failure("parse-primary", "Missing primary panel layout");
  }

  const existingRollback =
    rollbackRaw === null
      ? null
      : parsePanelLayoutV3RollbackEnvelope(rollbackRaw);
  const v2 = parseV2Raw(primaryRaw, registry);
  if (v2.ok) {
    if (existingRollback === null) {
      return { status: "already-v2", layout: v2.value, rollbackId: null };
    }
    if (!existingRollback.ok) {
      return failure(
        "backup-mismatch",
        "V2 primary has a malformed v3 rollback backup",
      );
    }
    if (existingRollback.value.state === "committed") {
      return {
        status: "already-v2",
        layout: v2.value,
        rollbackId: existingRollback.value.rollbackId,
      };
    }
    if (existingRollback.value.targetRaw !== primaryRaw) {
      return failure(
        "backup-mismatch",
        "V2 primary does not match the prepared v3 rollback target",
      );
    }
    try {
      storage.setItem(
        PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY,
        JSON.stringify(committedEnvelope(existingRollback.value, now())),
      );
    } catch (error) {
      return failure("commit-backup", error);
    }
    return {
      status: "recovered-commit",
      layout: v2.value,
      rollbackId: existingRollback.value.rollbackId,
    };
  }

  const v3 = parseV3Raw(primaryRaw, registry, surfaceRect);
  if (!v3.ok) {
    return rawVersion(primaryRaw) === 3 || rollbackRaw !== null
      ? failure("parse-primary", v3.error)
      : { status: "not-applicable" };
  }
  if (existingRollback !== null && !existingRollback.ok) {
    return failure("backup-mismatch", existingRollback.error);
  }

  let prepared: PanelLayoutV3RollbackEnvelope;
  if (existingRollback?.ok) {
    if (
      existingRollback.value.state !== "prepared" ||
      existingRollback.value.raw !== primaryRaw ||
      !parseV2Raw(existingRollback.value.targetRaw, registry).ok
    ) {
      return failure(
        "backup-mismatch",
        "Prepared v3 rollback backup does not match the primary",
      );
    }
    prepared = existingRollback.value;
  } else {
    const exactTarget = exactV2Target(
      primaryRaw,
      v3.value,
      v2BackupRaw,
      registry,
      surfaceRect,
    );
    if (!exactTarget.ok) return failure("backup-mismatch", exactTarget.error);
    let targetRaw = exactTarget.value;
    let targetKind: PanelLayoutV3RollbackEnvelope["targetKind"] = "exact-v2";
    if (targetRaw === null) {
      const projected = projectPanelWorkspaceLayoutV3ToV2(
        v3.value,
        registry,
        surfaceRect,
      );
      if (!projected.ok) return failure("project-layout", projected.error);
      targetRaw = JSON.stringify(projected.value);
      targetKind = "projected-v2";
    }
    const rollbackId = createRollbackId();
    if (rollbackId.length === 0) {
      return failure("prepare-backup", "Rollback id is empty");
    }
    prepared = preparedEnvelope(
      primaryRaw,
      targetRaw,
      targetKind,
      rollbackId,
      now(),
    );
    try {
      storage.setItem(
        PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY,
        JSON.stringify(prepared),
      );
    } catch (error) {
      return failure("prepare-backup", error);
    }
  }

  let currentPrimaryRaw: string | null;
  let persistedRollbackRaw: string | null;
  try {
    currentPrimaryRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
    persistedRollbackRaw = storage.getItem(
      PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY,
    );
  } catch (error) {
    return failure("read-primary", error);
  }
  const persistedRollback =
    parsePanelLayoutV3RollbackEnvelope(persistedRollbackRaw);
  if (
    currentPrimaryRaw !== primaryRaw ||
    !persistedRollback.ok ||
    persistedRollback.value.state !== "prepared" ||
    persistedRollback.value.raw !== primaryRaw ||
    persistedRollback.value.targetRaw !== prepared.targetRaw ||
    persistedRollback.value.rollbackId !== prepared.rollbackId
  ) {
    return failure(
      "primary-changed",
      "Primary or prepared rollback backup changed before v2 write",
    );
  }
  try {
    storage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, prepared.targetRaw);
  } catch (error) {
    return failure("write-primary", error);
  }
  try {
    storage.setItem(
      PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY,
      JSON.stringify(committedEnvelope(prepared, now())),
    );
  } catch (error) {
    return failure("commit-backup", error);
  }
  const layout = parseV2Raw(prepared.targetRaw, registry);
  if (!layout.ok) return failure("project-layout", layout.error);
  return {
    status: "rolled-back",
    layout: layout.value,
    rollbackId: prepared.rollbackId,
  };
}
