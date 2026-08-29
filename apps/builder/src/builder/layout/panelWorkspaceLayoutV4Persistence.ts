import {
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
  type PanelWorkspaceStorage,
} from "./panelWorkspaceLayoutV2Persistence";
import {
  parsePanelWorkspaceLayoutV3,
  type PanelWorkspaceLayoutV3,
} from "./panelWorkspaceLayoutV3";
import {
  parsePanelWorkspaceLayoutV4,
  type PanelWorkspaceLayoutV4,
} from "./panelWorkspaceLayoutV4";
import { migratePanelWorkspaceLayoutV3ToV4 } from "./panelWorkspaceLayoutV4Migration";

export const PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY =
  "composition-panel-layout.v3-backup";

export interface PanelLayoutV3BackupEnvelope {
  sourceVersion: 3;
  migrationId: string;
  raw: string;
  state: "prepared" | "committed";
  updatedAt: string;
}

export type PanelWorkspaceV4MigrationFailureStage =
  | "read-primary"
  | "read-backup"
  | "parse-primary"
  | "restore-primary"
  | "prepare-backup"
  | "primary-changed"
  | "write-primary"
  | "commit-backup"
  | "backup-mismatch"
  | "migrate-layout";

export type PanelWorkspaceStorageV4MigrationResult =
  | {
      status: "migrated" | "already-v4" | "recovered-commit";
      layout: PanelWorkspaceLayoutV4;
      migrationId: string | null;
    }
  | {
      status: "recovered-v3";
      layout: PanelWorkspaceLayoutV3;
      migrationId: string;
    }
  | {
      status: "failed";
      stage: PanelWorkspaceV4MigrationFailureStage;
      error: string;
    };

export interface MigratePanelWorkspaceStorageToV4Options {
  storage: PanelWorkspaceStorage;
  registry: readonly PanelWorkspaceRegistryEntry[];
  surfaceRect: PanelWorkspaceRect;
  createMigrationId: () => string;
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

export function parsePanelLayoutV3BackupEnvelope(
  input: unknown,
): PanelWorkspaceResult<PanelLayoutV3BackupEnvelope> {
  let value = input;
  if (typeof input === "string") {
    const parsed = parseJson(input);
    if (!parsed.ok) return parsed;
    value = parsed.value;
  }
  if (
    !isRecord(value) ||
    value.sourceVersion !== 3 ||
    typeof value.migrationId !== "string" ||
    value.migrationId.length === 0 ||
    typeof value.raw !== "string" ||
    (value.state !== "prepared" && value.state !== "committed") ||
    typeof value.updatedAt !== "string"
  ) {
    return { ok: false, error: "Invalid v3 backup envelope" };
  }
  return {
    ok: true,
    value: {
      sourceVersion: 3,
      migrationId: value.migrationId,
      raw: value.raw,
      state: value.state,
      updatedAt: value.updatedAt,
    },
  };
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

function parseV4Raw(
  raw: string,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceLayoutV4> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  return parsePanelWorkspaceLayoutV4(parsed.value, registry, surfaceRect);
}

function migrateV3RawToV4(
  raw: string,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  migrationId: string,
): PanelWorkspaceResult<PanelWorkspaceLayoutV4> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  return migratePanelWorkspaceLayoutV3ToV4(parsed.value, registry, {
    surfaceRect,
    migrationId,
  });
}

function failure(
  stage: PanelWorkspaceV4MigrationFailureStage,
  error: unknown,
): PanelWorkspaceStorageV4MigrationResult {
  return {
    status: "failed",
    stage,
    error: error instanceof Error ? error.message : String(error),
  };
}

function committedEnvelope(
  envelope: PanelLayoutV3BackupEnvelope,
  updatedAt: string,
): PanelLayoutV3BackupEnvelope {
  return { ...envelope, state: "committed", updatedAt };
}

function preparedEnvelope(
  raw: string,
  migrationId: string,
  updatedAt: string,
): PanelLayoutV3BackupEnvelope {
  return {
    sourceVersion: 3,
    migrationId,
    raw,
    state: "prepared",
    updatedAt,
  };
}

function readBackup(
  storage: PanelWorkspaceStorage,
): PanelWorkspaceResult<PanelLayoutV3BackupEnvelope> {
  return parsePanelLayoutV3BackupEnvelope(
    storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY),
  );
}

function verifyMigratedPrimary(
  layout: PanelWorkspaceLayoutV4,
  backup: PanelLayoutV3BackupEnvelope,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): boolean {
  const expected = migrateV3RawToV4(
    backup.raw,
    registry,
    surfaceRect,
    backup.migrationId,
  );
  return (
    expected.ok && JSON.stringify(expected.value) === JSON.stringify(layout)
  );
}

function recoverV4Commit(
  storage: PanelWorkspaceStorage,
  layout: PanelWorkspaceLayoutV4,
  backup: PanelWorkspaceResult<PanelLayoutV3BackupEnvelope>,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  now: () => string,
): PanelWorkspaceStorageV4MigrationResult {
  const migrationId = layout.migrationSource?.migrationId;
  if (!migrationId) {
    return { status: "already-v4", layout, migrationId: null };
  }
  if (
    !backup.ok ||
    backup.value.migrationId !== migrationId ||
    !verifyMigratedPrimary(layout, backup.value, registry, surfaceRect)
  ) {
    return failure(
      "backup-mismatch",
      "V4 primary does not match its exact v3 backup",
    );
  }
  if (backup.value.state === "committed") {
    return { status: "already-v4", layout, migrationId };
  }
  try {
    storage.setItem(
      PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
      JSON.stringify(committedEnvelope(backup.value, now())),
    );
  } catch (error) {
    return failure("commit-backup", error);
  }
  return { status: "recovered-commit", layout, migrationId };
}

function restoreV3Backup(
  storage: PanelWorkspaceStorage,
  backup: PanelWorkspaceResult<PanelLayoutV3BackupEnvelope>,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceStorageV4MigrationResult | null {
  if (!backup.ok) return null;
  const parsed = parseV3Raw(backup.value.raw, registry, surfaceRect);
  if (!parsed.ok) return null;
  try {
    storage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, backup.value.raw);
  } catch (error) {
    return failure("restore-primary", error);
  }
  return {
    status: "recovered-v3",
    layout: parsed.value,
    migrationId: backup.value.migrationId,
  };
}

export function migratePanelWorkspaceStorageToV4({
  storage,
  registry,
  surfaceRect,
  createMigrationId,
  now,
}: MigratePanelWorkspaceStorageToV4Options): PanelWorkspaceStorageV4MigrationResult {
  let primaryRaw: string | null;
  try {
    primaryRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
  } catch (error) {
    return failure("read-primary", error);
  }

  let backup: PanelWorkspaceResult<PanelLayoutV3BackupEnvelope>;
  try {
    backup = readBackup(storage);
  } catch (error) {
    return failure("read-backup", error);
  }
  if (primaryRaw === null) {
    const restored = restoreV3Backup(storage, backup, registry, surfaceRect);
    return restored ?? failure("parse-primary", "Missing primary panel layout");
  }

  const v4 = parseV4Raw(primaryRaw, registry, surfaceRect);
  if (v4.ok) {
    return recoverV4Commit(
      storage,
      v4.value,
      backup,
      registry,
      surfaceRect,
      now,
    );
  }

  const v3 = parseV3Raw(primaryRaw, registry, surfaceRect);
  if (!v3.ok) {
    const restored = restoreV3Backup(storage, backup, registry, surfaceRect);
    return restored ?? failure("parse-primary", v3.error);
  }

  let prepared: PanelLayoutV3BackupEnvelope;
  if (
    backup.ok &&
    backup.value.state === "prepared" &&
    backup.value.raw === primaryRaw
  ) {
    prepared = backup.value;
  } else {
    const migrationId = createMigrationId();
    if (migrationId.length === 0) {
      return failure("prepare-backup", "Migration id is empty");
    }
    prepared = preparedEnvelope(primaryRaw, migrationId, now());
    try {
      storage.setItem(
        PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
        JSON.stringify(prepared),
      );
    } catch (error) {
      return failure("prepare-backup", error);
    }
  }

  let currentPrimaryRaw: string | null;
  try {
    currentPrimaryRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
  } catch (error) {
    return failure("read-primary", error);
  }
  if (currentPrimaryRaw !== primaryRaw || prepared.raw !== primaryRaw) {
    return failure(
      "primary-changed",
      "Primary v3 raw changed after backup preparation",
    );
  }
  let persistedPrepared: PanelWorkspaceResult<PanelLayoutV3BackupEnvelope>;
  try {
    persistedPrepared = readBackup(storage);
  } catch (error) {
    return failure("read-backup", error);
  }
  if (
    !persistedPrepared.ok ||
    persistedPrepared.value.state !== "prepared" ||
    persistedPrepared.value.raw !== primaryRaw ||
    persistedPrepared.value.migrationId !== prepared.migrationId
  ) {
    return failure(
      "primary-changed",
      "Prepared backup no longer matches the primary v3 raw",
    );
  }

  const migrated = migrateV3RawToV4(
    primaryRaw,
    registry,
    surfaceRect,
    prepared.migrationId,
  );
  if (!migrated.ok) return failure("migrate-layout", migrated.error);
  try {
    storage.setItem(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(migrated.value),
    );
  } catch (error) {
    return failure("write-primary", error);
  }

  try {
    storage.setItem(
      PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
      JSON.stringify(committedEnvelope(prepared, now())),
    );
  } catch (error) {
    return failure("commit-backup", error);
  }
  return {
    status: "migrated",
    layout: migrated.value,
    migrationId: prepared.migrationId,
  };
}
