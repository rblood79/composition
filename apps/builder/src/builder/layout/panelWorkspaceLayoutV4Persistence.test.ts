import { describe, expect, it } from "vitest";
import {
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
  type PanelWorkspaceStorage,
} from "./panelWorkspaceLayoutV2Persistence";
import {
  createPanelWorkspaceLayoutV2,
  PANEL_WORKSPACE_TEST_REGISTRY,
} from "./panelWorkspaceLayoutV2.testFixtures";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import {
  migratePanelWorkspaceStorageToV4,
  PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
  parsePanelLayoutV3BackupEnvelope,
  type MigratePanelWorkspaceStorageToV4Options,
} from "./panelWorkspaceLayoutV4Persistence";

const SURFACE_RECT = { width: 1200, height: 800 } as const;

class FaultStorage implements PanelWorkspaceStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  failAtWrite: number | null = null;
  failReadKey: string | null = null;
  afterWrite: ((key: string, writeIndex: number) => void) | null = null;

  getItem(key: string): string | null {
    if (this.failReadKey === key) {
      throw new Error(`fault reading ${key}`);
    }
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const writeIndex = this.writes.length + 1;
    this.writes.push({ key, value });
    if (this.failAtWrite === writeIndex) {
      throw new Error(`fault at write ${writeIndex}`);
    }
    this.values.set(key, value);
    this.afterWrite?.(key, writeIndex);
  }
}

function migrationOptions(
  storage: PanelWorkspaceStorage,
  migrationId = "migration-v3-v4",
): MigratePanelWorkspaceStorageToV4Options {
  return {
    storage,
    registry: PANEL_WORKSPACE_TEST_REGISTRY,
    surfaceRect: SURFACE_RECT,
    createMigrationId: () => migrationId,
    now: () => "2026-08-19T00:00:00.000Z",
  };
}

function v3Raw(): string {
  const migrated = migratePanelWorkspaceLayoutV2ToV3(
    createPanelWorkspaceLayoutV2(),
    PANEL_WORKSPACE_TEST_REGISTRY,
    { surfaceRect: SURFACE_RECT, migrationId: "fixture-v2-v3" },
  );
  if (!migrated.ok) throw new Error(migrated.error);
  return JSON.stringify(migrated.value).replaceAll('"navigator"', '"nodes"');
}

describe("ADR-186 prepared/committed v3 -> v4 migration protocol", () => {
  it("exact v3 backup -> v4 primary -> committed marker 순서만 local storage에 쓴다", () => {
    const storage = new FaultStorage();
    const raw = v3Raw();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, raw);

    const result = migratePanelWorkspaceStorageToV4(migrationOptions(storage));
    expect(result).toMatchObject({
      status: "migrated",
      migrationId: "migration-v3-v4",
      layout: { version: 4 },
    });
    expect(storage.writes.map(({ key }) => key)).toEqual([
      PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
    ]);
    expect(new Set(storage.writes.map(({ key }) => key))).toEqual(
      new Set([
        PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
        PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
      ]),
    );

    const backup = parsePanelLayoutV3BackupEnvelope(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY),
    );
    expect(backup).toMatchObject({
      ok: true,
      value: {
        sourceVersion: 3,
        migrationId: "migration-v3-v4",
        raw,
        state: "committed",
      },
    });
    expect(
      JSON.parse(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY) ?? "{}"),
    ).toMatchObject({
      version: 4,
      migrationSource: { version: 3, migrationId: "migration-v3-v4" },
    });
  });

  it.each([
    [1, "prepare-backup", 3, null],
    [2, "write-primary", 3, "prepared"],
    [3, "commit-backup", 4, "prepared"],
  ] as const)(
    "write boundary %i fault는 stage=%s로 원자 경계를 보존한다",
    (failAtWrite, stage, primaryVersion, backupState) => {
      const storage = new FaultStorage();
      storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3Raw());
      storage.failAtWrite = failAtWrite;

      const result = migratePanelWorkspaceStorageToV4(
        migrationOptions(storage),
      );
      expect(result).toMatchObject({ status: "failed", stage });
      expect(
        JSON.parse(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY) ?? "{}")
          .version,
      ).toBe(primaryVersion);
      const backup = parsePanelLayoutV3BackupEnvelope(
        storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY),
      );
      if (backupState === null) {
        expect(backup.ok).toBe(false);
      } else {
        expect(backup).toMatchObject({
          ok: true,
          value: { state: backupState },
        });
      }
    },
  );

  it("v4 primary + matching prepared backup은 재실행에서 marker만 committed로 repair한다", () => {
    const storage = new FaultStorage();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3Raw());
    storage.failAtWrite = 3;
    expect(
      migratePanelWorkspaceStorageToV4(migrationOptions(storage)),
    ).toMatchObject({ status: "failed", stage: "commit-backup" });

    storage.failAtWrite = null;
    const writesBeforeRecovery = storage.writes.length;
    const recovered = migratePanelWorkspaceStorageToV4(
      migrationOptions(storage),
    );
    expect(recovered).toMatchObject({
      status: "recovered-commit",
      migrationId: "migration-v3-v4",
      layout: { version: 4 },
    });
    expect(
      storage.writes.slice(writesBeforeRecovery).map(({ key }) => key),
    ).toEqual([PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY]);
    expect(
      parsePanelLayoutV3BackupEnvelope(
        storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY),
      ),
    ).toMatchObject({ ok: true, value: { state: "committed" } });
  });

  it("prepare 뒤 primary raw가 바뀌면 v4 write 없이 fail closed한다", () => {
    const storage = new FaultStorage();
    const original = v3Raw();
    const changedLayout = JSON.parse(v3Raw()) as {
      clusters: Array<{
        columns: Array<{ rows: Array<{ height: number }> }>;
      }>;
    };
    changedLayout.clusters[0]!.columns[0]!.rows[0]!.height = 600;
    const changed = JSON.stringify(changedLayout);
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, original);
    storage.afterWrite = (key, writeIndex) => {
      if (key === PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY && writeIndex === 1) {
        storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, changed);
      }
    };

    const result = migratePanelWorkspaceStorageToV4(migrationOptions(storage));
    expect(result).toMatchObject({
      status: "failed",
      stage: "primary-changed",
    });
    expect(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)).toBe(changed);
    expect(storage.writes.map(({ key }) => key)).toEqual([
      PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
    ]);
  });

  it("malformed primary는 parse 가능한 exact v3 backup만 복원하고 같은 실행에서 migrate하지 않는다", () => {
    const storage = new FaultStorage();
    const raw = v3Raw();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, "{malformed");
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
      JSON.stringify({
        sourceVersion: 3,
        migrationId: "migration-restore",
        raw,
        state: "committed",
        updatedAt: "2026-08-19T00:00:00.000Z",
      }),
    );

    const result = migratePanelWorkspaceStorageToV4(
      migrationOptions(storage, "migration-unused"),
    );
    expect(result).toMatchObject({
      status: "recovered-v3",
      migrationId: "migration-restore",
      layout: { version: 3 },
    });
    expect(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)).toBe(raw);
    expect(storage.writes.map(({ key }) => key)).toEqual([
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
    ]);
  });

  it("v4 migrationSource와 backup migrationId가 다르면 primary를 쓰지 않고 fail closed한다", () => {
    const storage = new FaultStorage();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3Raw());
    expect(
      migratePanelWorkspaceStorageToV4(
        migrationOptions(storage, "migration-original"),
      ),
    ).toMatchObject({ status: "migrated" });

    const validBackup = parsePanelLayoutV3BackupEnvelope(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY),
    );
    if (!validBackup.ok) throw new Error(validBackup.error);
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
      JSON.stringify({
        ...validBackup.value,
        migrationId: "migration-unrelated",
      }),
    );
    storage.writes.length = 0;

    const result = migratePanelWorkspaceStorageToV4(
      migrationOptions(storage, "migration-next"),
    );
    expect(result).toMatchObject({
      status: "failed",
      stage: "backup-mismatch",
    });
    expect(storage.writes).toEqual([]);
    expect(
      JSON.parse(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY) ?? "{}")
        .version,
    ).toBe(4);
  });

  it("valid v4 + matching committed backup은 write 없이 hydration-ready다", () => {
    const storage = new FaultStorage();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3Raw());
    expect(
      migratePanelWorkspaceStorageToV4(migrationOptions(storage)),
    ).toMatchObject({ status: "migrated" });
    storage.writes.length = 0;

    const result = migratePanelWorkspaceStorageToV4(migrationOptions(storage));
    expect(result).toMatchObject({
      status: "already-v4",
      migrationId: "migration-v3-v4",
      layout: { version: 4 },
    });
    expect(storage.writes).toEqual([]);
  });

  it("primary와 backup이 모두 invalid면 default/primary write 없이 실패한다", () => {
    const storage = new FaultStorage();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, "invalid");
    storage.values.set(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY, "invalid");

    const result = migratePanelWorkspaceStorageToV4(migrationOptions(storage));
    expect(result).toMatchObject({
      status: "failed",
      stage: "parse-primary",
    });
    expect(storage.writes).toEqual([]);
  });

  it("backup read fault는 backup이나 primary를 덮어쓰지 않고 fail closed한다", () => {
    const storage = new FaultStorage();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3Raw());
    storage.failReadKey = PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY;

    const result = migratePanelWorkspaceStorageToV4(migrationOptions(storage));
    expect(result).toMatchObject({ status: "failed", stage: "read-backup" });
    expect(storage.writes).toEqual([]);
    expect(
      JSON.parse(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY) ?? "{}")
        .version,
    ).toBe(3);
  });
});
