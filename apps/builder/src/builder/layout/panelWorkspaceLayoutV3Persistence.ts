import {
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
  parsePanelWorkspaceLayoutV3,
  type PanelWorkspaceLayoutV3,
} from "./panelWorkspaceLayoutV3";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";

export const PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY =
  "composition-panel-layout.v2-backup";

export interface PanelLayoutV2BackupEnvelope {
  sourceVersion: 2;
  migrationId: string;
  raw: string;
  state: "prepared" | "committed";
  updatedAt: string;
}

export type PanelWorkspaceV3MigrationFailureStage =
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

export type PanelWorkspaceStorageV3MigrationResult =
  | {
      status: "migrated" | "already-v3" | "recovered-commit";
      layout: PanelWorkspaceLayoutV3;
      migrationId: string | null;
    }
  | {
      status: "recovered-v2";
      layout: PanelWorkspaceLayoutV2;
      migrationId: string;
    }
  | {
      status: "failed";
      stage: PanelWorkspaceV3MigrationFailureStage;
      error: string;
    };

export interface MigratePanelWorkspaceStorageToV3Options {
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

export function parsePanelLayoutV2BackupEnvelope(
  input: unknown,
): PanelWorkspaceResult<PanelLayoutV2BackupEnvelope> {
  let value = input;
  if (typeof input === "string") {
    const parsed = parseJson(input);
    if (!parsed.ok) return parsed;
    value = parsed.value;
  }
  if (
    !isRecord(value) ||
    value.sourceVersion !== 2 ||
    typeof value.migrationId !== "string" ||
    value.migrationId.length === 0 ||
    typeof value.raw !== "string" ||
    (value.state !== "prepared" && value.state !== "committed") ||
    typeof value.updatedAt !== "string"
  ) {
    return { ok: false, error: "Invalid v2 backup envelope" };
  }
  return {
    ok: true,
    value: {
      sourceVersion: 2,
      migrationId: value.migrationId,
      raw: value.raw,
      state: value.state,
      updatedAt: value.updatedAt,
    },
  };
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

function migrateV2RawToV3(
  raw: string,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  migrationId: string,
): PanelWorkspaceResult<PanelWorkspaceLayoutV3> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  return migratePanelWorkspaceLayoutV2ToV3(parsed.value, registry, {
    surfaceRect,
    migrationId,
  });
}

function failure(
  stage: PanelWorkspaceV3MigrationFailureStage,
  error: unknown,
): PanelWorkspaceStorageV3MigrationResult {
  return {
    status: "failed",
    stage,
    error: error instanceof Error ? error.message : String(error),
  };
}

function committedEnvelope(
  envelope: PanelLayoutV2BackupEnvelope,
  updatedAt: string,
): PanelLayoutV2BackupEnvelope {
  return { ...envelope, state: "committed", updatedAt };
}

function preparedEnvelope(
  raw: string,
  migrationId: string,
  updatedAt: string,
): PanelLayoutV2BackupEnvelope {
  return {
    sourceVersion: 2,
    migrationId,
    raw,
    state: "prepared",
    updatedAt,
  };
}

function readBackup(
  storage: PanelWorkspaceStorage,
): PanelWorkspaceResult<PanelLayoutV2BackupEnvelope> {
  return parsePanelLayoutV2BackupEnvelope(
    storage.getItem(PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY),
  );
}

function verifyMigratedPrimary(
  layout: PanelWorkspaceLayoutV3,
  backup: PanelLayoutV2BackupEnvelope,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): boolean {
  const expected = migrateV2RawToV3(
    backup.raw,
    registry,
    surfaceRect,
    backup.migrationId,
  );
  return (
    expected.ok && JSON.stringify(expected.value) === JSON.stringify(layout)
  );
}

function recoverV3Commit(
  storage: PanelWorkspaceStorage,
  layout: PanelWorkspaceLayoutV3,
  backup: PanelWorkspaceResult<PanelLayoutV2BackupEnvelope>,
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  now: () => string,
): PanelWorkspaceStorageV3MigrationResult {
  const migrationId = layout.migrationSource?.migrationId;
  if (!migrationId) {
    return { status: "already-v3", layout, migrationId: null };
  }
  if (
    !backup.ok ||
    backup.value.migrationId !== migrationId ||
    !verifyMigratedPrimary(layout, backup.value, registry, surfaceRect)
  ) {
    return failure(
      "backup-mismatch",
      "V3 primary does not match its exact v2 backup",
    );
  }
  if (backup.value.state === "committed") {
    return { status: "already-v3", layout, migrationId };
  }
  try {
    storage.setItem(
      PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY,
      JSON.stringify(committedEnvelope(backup.value, now())),
    );
  } catch (error) {
    return failure("commit-backup", error);
  }
  return { status: "recovered-commit", layout, migrationId };
}

function restoreV2Backup(
  storage: PanelWorkspaceStorage,
  backup: PanelWorkspaceResult<PanelLayoutV2BackupEnvelope>,
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelWorkspaceStorageV3MigrationResult | null {
  if (!backup.ok) return null;
  const parsed = parseV2Raw(backup.value.raw, registry);
  if (!parsed.ok) return null;
  try {
    storage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, backup.value.raw);
  } catch (error) {
    return failure("restore-primary", error);
  }
  return {
    status: "recovered-v2",
    layout: parsed.value,
    migrationId: backup.value.migrationId,
  };
}

export function migratePanelWorkspaceStorageToV3({
  storage,
  registry,
  surfaceRect,
  createMigrationId,
  now,
}: MigratePanelWorkspaceStorageToV3Options): PanelWorkspaceStorageV3MigrationResult {
  let primaryRaw: string | null;
  try {
    primaryRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
  } catch (error) {
    return failure("read-primary", error);
  }

  let backup: PanelWorkspaceResult<PanelLayoutV2BackupEnvelope>;
  try {
    backup = readBackup(storage);
  } catch (error) {
    return failure("read-backup", error);
  }
  if (primaryRaw === null) {
    const restored = restoreV2Backup(storage, backup, registry);
    return restored ?? failure("parse-primary", "Missing primary panel layout");
  }

  const v3 = parseV3Raw(primaryRaw, registry, surfaceRect);
  if (v3.ok) {
    return recoverV3Commit(
      storage,
      v3.value,
      backup,
      registry,
      surfaceRect,
      now,
    );
  }

  const v2 = parseV2Raw(primaryRaw, registry);
  if (!v2.ok) {
    const restored = restoreV2Backup(storage, backup, registry);
    return restored ?? failure("parse-primary", v2.error);
  }

  let prepared: PanelLayoutV2BackupEnvelope;
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
        PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY,
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
      "Primary v2 raw changed after backup preparation",
    );
  }
  let persistedPrepared: PanelWorkspaceResult<PanelLayoutV2BackupEnvelope>;
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
      "Prepared backup no longer matches the primary v2 raw",
    );
  }

  const migrated = migrateV2RawToV3(
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
      PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY,
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
