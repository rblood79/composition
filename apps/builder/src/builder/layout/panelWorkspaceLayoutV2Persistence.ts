import type { PanelLayoutState } from "../panels/core/types";
import {
  parsePanelWorkspaceLayoutV2,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import {
  createPanelWorkspaceLegacyViewFromV1,
  migratePanelLayoutV1ToV2,
  parsePanelLayoutV1,
  projectV2ToLegacyView,
  type PanelWorkspaceLegacyView,
} from "./panelWorkspaceLayoutV2Migration";

export const PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY = "composition-panel-layout";
export const PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY =
  "composition-panel-layout.v1-backup";

export interface PanelLayoutV1BackupEnvelope {
  sourceVersion: 1;
  migrationId: string;
  raw: string;
  state: "prepared" | "committed";
  updatedAt: string;
}

export interface PanelWorkspaceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type PanelWorkspaceMigrationFailureStage =
  | "read-primary"
  | "parse-primary"
  | "restore-primary"
  | "prepare-backup"
  | "primary-changed"
  | "write-primary"
  | "commit-backup";

export type PanelWorkspaceStorageMigrationResult =
  | {
      status: "migrated" | "already-v2" | "recovered-commit";
      layout: PanelWorkspaceLayoutV2;
      migrationId: string | null;
    }
  | {
      status: "failed";
      stage: PanelWorkspaceMigrationFailureStage;
      error: string;
    };

export interface MigratePanelWorkspaceStorageOptions {
  storage: PanelWorkspaceStorage;
  registry: readonly PanelWorkspaceRegistryEntry[];
  defaultV1Layout: PanelLayoutState;
  createMigrationId: () => string;
  now: () => string;
}

export interface ReadPanelWorkspaceV1CompatibilityOptions {
  storage: PanelWorkspaceStorage;
  registry: readonly PanelWorkspaceRegistryEntry[];
  defaultV1Layout: PanelLayoutState;
}

export interface PanelWorkspaceV1CompatibilityReadResult {
  source: "primary-v1" | "backup-v1" | "projected-v2" | "default";
  raw: string | null;
  view: PanelWorkspaceLegacyView;
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

export function parsePanelLayoutV1BackupEnvelope(
  input: unknown,
): PanelWorkspaceResult<PanelLayoutV1BackupEnvelope> {
  let value = input;
  if (typeof input === "string") {
    const parsed = parseJson(input);
    if (!parsed.ok) return parsed;
    value = parsed.value;
  }
  if (
    !isRecord(value) ||
    value.sourceVersion !== 1 ||
    typeof value.migrationId !== "string" ||
    value.migrationId.length === 0 ||
    typeof value.raw !== "string" ||
    (value.state !== "prepared" && value.state !== "committed") ||
    typeof value.updatedAt !== "string"
  ) {
    return { ok: false, error: "Invalid v1 backup envelope" };
  }
  return {
    ok: true,
    value: {
      sourceVersion: 1,
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

function parseV1Raw(
  raw: string,
  registry: readonly PanelWorkspaceRegistryEntry[],
  defaults: PanelLayoutState,
): PanelWorkspaceResult<PanelLayoutState> {
  const parsed = parseJson(raw);
  if (!parsed.ok) return parsed;
  return parsePanelLayoutV1(parsed.value, registry, defaults);
}

function failure(
  stage: PanelWorkspaceMigrationFailureStage,
  error: unknown,
): PanelWorkspaceStorageMigrationResult {
  return {
    status: "failed",
    stage,
    error: error instanceof Error ? error.message : String(error),
  };
}

function committedEnvelope(
  envelope: PanelLayoutV1BackupEnvelope,
  updatedAt: string,
): PanelLayoutV1BackupEnvelope {
  return { ...envelope, state: "committed", updatedAt };
}

function recoverPreparedBackup(
  storage: PanelWorkspaceStorage,
  layout: PanelWorkspaceLayoutV2,
  backup: PanelWorkspaceResult<PanelLayoutV1BackupEnvelope>,
  registry: readonly PanelWorkspaceRegistryEntry[],
  defaults: PanelLayoutState,
  now: () => string,
): PanelWorkspaceStorageMigrationResult | null {
  const migrationId = layout.migrationSource?.migrationId;
  if (
    !migrationId ||
    !backup.ok ||
    backup.value.migrationId !== migrationId ||
    backup.value.state !== "prepared"
  ) {
    return null;
  }
  const parsedBackupRaw = parseV1Raw(backup.value.raw, registry, defaults);
  if (!parsedBackupRaw.ok) return null;
  const expected = migratePanelLayoutV1ToV2(
    parsedBackupRaw.value,
    registry,
    migrationId,
  );
  if (JSON.stringify(expected) !== JSON.stringify(layout)) return null;
  try {
    storage.setItem(
      PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
      JSON.stringify(committedEnvelope(backup.value, now())),
    );
  } catch (error) {
    return failure("commit-backup", error);
  }
  return { status: "recovered-commit", layout, migrationId };
}

export function migratePanelWorkspaceStorageToV2({
  storage,
  registry,
  defaultV1Layout,
  createMigrationId,
  now,
}: MigratePanelWorkspaceStorageOptions): PanelWorkspaceStorageMigrationResult {
  let primaryRaw: string | null;
  try {
    primaryRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
  } catch (error) {
    return failure("read-primary", error);
  }
  if (primaryRaw === null) {
    return failure("parse-primary", "Missing primary panel layout");
  }

  const v2 = parseV2Raw(primaryRaw, registry);
  if (v2.ok) {
    const backup = parsePanelLayoutV1BackupEnvelope(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
    );
    const recovered = recoverPreparedBackup(
      storage,
      v2.value,
      backup,
      registry,
      defaultV1Layout,
      now,
    );
    if (recovered) return recovered;
    return {
      status: "already-v2",
      layout: v2.value,
      migrationId: v2.value.migrationSource?.migrationId ?? null,
    };
  }

  let v1 = parseV1Raw(primaryRaw, registry, defaultV1Layout);
  if (!v1.ok) {
    const backup = parsePanelLayoutV1BackupEnvelope(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
    );
    const backupV1 = backup.ok
      ? parseV1Raw(backup.value.raw, registry, defaultV1Layout)
      : null;
    if (!backup?.ok || !backupV1?.ok) {
      return failure("parse-primary", v1.error);
    }
    try {
      storage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, backup.value.raw);
    } catch (error) {
      return failure("restore-primary", error);
    }
    primaryRaw = backup.value.raw;
    v1 = backupV1;
  }
  const existingBackup = parsePanelLayoutV1BackupEnvelope(
    storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
  );
  let prepared: PanelLayoutV1BackupEnvelope;
  if (existingBackup.ok && existingBackup.value.raw === primaryRaw) {
    prepared = existingBackup.value;
  } else {
    const migrationId = createMigrationId();
    if (migrationId.length === 0) {
      return failure("prepare-backup", "Migration id is empty");
    }
    prepared = {
      sourceVersion: 1,
      migrationId,
      raw: primaryRaw,
      state: "prepared",
      updatedAt: now(),
    };
    try {
      storage.setItem(
        PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
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
      "Primary v1 raw changed after backup preparation",
    );
  }
  const persistedPrepared = parsePanelLayoutV1BackupEnvelope(
    storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
  );
  if (
    !persistedPrepared.ok ||
    persistedPrepared.value.raw !== primaryRaw ||
    persistedPrepared.value.migrationId !== prepared.migrationId
  ) {
    return failure(
      "primary-changed",
      "Prepared backup no longer matches the primary v1 raw",
    );
  }

  const migrated = migratePanelLayoutV1ToV2(
    v1.value,
    registry,
    prepared.migrationId,
  );
  try {
    storage.setItem(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(migrated),
    );
  } catch (error) {
    return failure("write-primary", error);
  }

  if (prepared.state !== "committed") {
    try {
      storage.setItem(
        PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
        JSON.stringify(committedEnvelope(prepared, now())),
      );
    } catch (error) {
      return failure("commit-backup", error);
    }
  }
  return {
    status: "migrated",
    layout: migrated,
    migrationId: prepared.migrationId,
  };
}

function readBackupV1(
  storage: PanelWorkspaceStorage,
  registry: readonly PanelWorkspaceRegistryEntry[],
  defaults: PanelLayoutState,
  requiredMigrationId?: string,
): {
  raw: string;
  layout: PanelLayoutState;
  migrationId: string;
} | null {
  const backup = parsePanelLayoutV1BackupEnvelope(
    storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
  );
  if (
    !backup.ok ||
    (requiredMigrationId !== undefined &&
      backup.value.migrationId !== requiredMigrationId)
  ) {
    return null;
  }
  const parsed = parseV1Raw(backup.value.raw, registry, defaults);
  return parsed.ok
    ? {
        raw: backup.value.raw,
        layout: parsed.value,
        migrationId: backup.value.migrationId,
      }
    : null;
}

export function readPanelWorkspaceV1Compatibility({
  storage,
  registry,
  defaultV1Layout,
}: ReadPanelWorkspaceV1CompatibilityOptions): PanelWorkspaceV1CompatibilityReadResult {
  const primaryRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
  if (primaryRaw !== null) {
    const primaryV1 = parseV1Raw(primaryRaw, registry, defaultV1Layout);
    if (primaryV1.ok) {
      return {
        source: "primary-v1",
        raw: primaryRaw,
        view: createPanelWorkspaceLegacyViewFromV1(
          primaryV1.value,
          registry,
          "primary-v1",
        ),
      };
    }

    const primaryV2 = parseV2Raw(primaryRaw, registry);
    if (primaryV2.ok) {
      const migrationId = primaryV2.value.migrationSource?.migrationId;
      const backup = migrationId
        ? readBackupV1(storage, registry, defaultV1Layout, migrationId)
        : null;
      const backupMatchesPrimary =
        backup !== null &&
        JSON.stringify(
          migratePanelLayoutV1ToV2(backup.layout, registry, backup.migrationId),
        ) === JSON.stringify(primaryV2.value);
      if (backup && backupMatchesPrimary) {
        return {
          source: "backup-v1",
          raw: backup.raw,
          view: createPanelWorkspaceLegacyViewFromV1(
            backup.layout,
            registry,
            "backup-v1",
          ),
        };
      }
      return {
        source: "projected-v2",
        raw: null,
        view: projectV2ToLegacyView(primaryV2.value, registry, defaultV1Layout),
      };
    }
  }

  const backup = readBackupV1(storage, registry, defaultV1Layout);
  if (backup) {
    return {
      source: "backup-v1",
      raw: backup.raw,
      view: createPanelWorkspaceLegacyViewFromV1(
        backup.layout,
        registry,
        "backup-v1",
      ),
    };
  }
  return {
    source: "default",
    raw: null,
    view: createPanelWorkspaceLegacyViewFromV1(
      defaultV1Layout,
      registry,
      "default",
    ),
  };
}
