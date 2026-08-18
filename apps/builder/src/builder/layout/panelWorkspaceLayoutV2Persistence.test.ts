import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { PanelLayoutState } from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import {
  PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
  migratePanelWorkspaceStorageToV2,
  parsePanelLayoutV1BackupEnvelope,
  readPanelWorkspaceV1Compatibility,
  type PanelWorkspaceStorage,
} from "./panelWorkspaceLayoutV2Persistence";
import { DEFAULT_PANEL_LAYOUT } from "../panels/core/types";

const PRIMARY_KEY = "composition-panel-layout";

function createV1Layout(): PanelLayoutState {
  return {
    ...DEFAULT_PANEL_LAYOUT,
    leftPanels: ["nodes", "datatableEditor", "settings"],
    rightPanels: ["properties", "history"],
    activeLeftPanels: ["nodes"],
    activeRightPanels: ["properties"],
    bottomPanels: ["monitor"],
    activeBottomPanels: [],
    showLeft: true,
    showRight: true,
    showBottom: false,
    bottomHeight: 200,
    panelSizes: {},
    modalPanels: [],
    panelClusters: [],
    nextModalZIndex: 1000,
  };
}

class TestStorage implements PanelWorkspaceStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  failWrite: ((key: string, value: string) => boolean) | null = null;
  afterWrite: ((key: string, value: string) => void) | null = null;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrite?.(key, value)) throw new Error(`write failed: ${key}`);
    this.values.set(key, value);
    this.writes.push({ key, value });
    this.afterWrite?.(key, value);
  }
}

function createMigrationIdFactory(...ids: string[]): () => string {
  let index = 0;
  return () => ids[index++] ?? `migration-${index}`;
}

function migrate(storage: TestStorage, createMigrationId = () => "m-1") {
  return migratePanelWorkspaceStorageToV2({
    storage,
    registry: PANEL_WORKSPACE_TEST_REGISTRY,
    defaultV1Layout: createV1Layout(),
    createMigrationId,
    now: () => "2026-08-18T00:00:00.000Z",
  });
}

describe("ADR-922 prepared/committed migration protocol", () => {
  it("prepared backup -> primary v2 -> committed 순서와 exact raw를 보존한다", () => {
    const storage = new TestStorage();
    const raw = JSON.stringify(createV1Layout());
    storage.values.set(PRIMARY_KEY, raw);

    const result = migrate(storage);

    expect(result.status).toBe("migrated");
    expect(storage.writes.map(({ key }) => key)).toEqual([
      PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
      PRIMARY_KEY,
      PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
    ]);
    const backup = parsePanelLayoutV1BackupEnvelope(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
    );
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(backup.value).toMatchObject({
      migrationId: "m-1",
      raw,
      state: "committed",
    });
  });

  it("backup write 실패 시 primary를 건드리지 않는다", () => {
    const storage = new TestStorage();
    const raw = JSON.stringify(createV1Layout());
    storage.values.set(PRIMARY_KEY, raw);
    storage.failWrite = (key) => key === PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY;

    const result = migrate(storage);

    expect(result).toMatchObject({ status: "failed", stage: "prepare-backup" });
    expect(storage.getItem(PRIMARY_KEY)).toBe(raw);
  });

  it("primary v2 write 실패 시 prepared backup과 primary v1을 유지한다", () => {
    const storage = new TestStorage();
    const raw = JSON.stringify(createV1Layout());
    storage.values.set(PRIMARY_KEY, raw);
    storage.failWrite = (key) => key === PRIMARY_KEY;

    const result = migrate(storage);
    const backup = parsePanelLayoutV1BackupEnvelope(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
    );

    expect(result).toMatchObject({ status: "failed", stage: "write-primary" });
    expect(storage.getItem(PRIMARY_KEY)).toBe(raw);
    expect(backup).toMatchObject({
      ok: true,
      value: { state: "prepared", raw },
    });
  });

  it("committed mark 실패는 다음 v2 load에서 같은 migrationId로 복구한다", () => {
    const storage = new TestStorage();
    storage.values.set(PRIMARY_KEY, JSON.stringify(createV1Layout()));
    let backupWrites = 0;
    storage.failWrite = (key) => {
      if (key !== PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY) return false;
      backupWrites += 1;
      return backupWrites === 2;
    };

    const first = migrate(storage);
    expect(first).toMatchObject({ status: "failed", stage: "commit-backup" });
    storage.failWrite = null;

    const healed = migrate(storage);
    const backup = parsePanelLayoutV1BackupEnvelope(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
    );
    expect(healed.status).toBe("recovered-commit");
    expect(backup).toMatchObject({
      ok: true,
      value: { state: "committed", migrationId: "m-1" },
    });
  });

  it("prepare 이후 primary v1 raw가 바뀌면 v2 write를 중단하고 다음 실행에서 최신 raw로 refresh한다", () => {
    const storage = new TestStorage();
    const firstRaw = JSON.stringify(createV1Layout());
    const changedLayout = createV1Layout();
    changedLayout.activeRightPanels = ["properties", "history"];
    const changedRaw = JSON.stringify(changedLayout);
    storage.values.set(PRIMARY_KEY, firstRaw);
    storage.afterWrite = (key) => {
      if (key === PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY) {
        storage.values.set(PRIMARY_KEY, changedRaw);
        storage.afterWrite = null;
      }
    };

    const first = migrate(storage, createMigrationIdFactory("m-1", "m-2"));
    expect(first).toMatchObject({ status: "failed", stage: "primary-changed" });
    expect(storage.getItem(PRIMARY_KEY)).toBe(changedRaw);

    const second = migrate(storage, createMigrationIdFactory("m-2"));
    const backup = parsePanelLayoutV1BackupEnvelope(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
    );
    expect(second.status).toBe("migrated");
    expect(backup).toMatchObject({
      ok: true,
      value: { raw: changedRaw, migrationId: "m-2", state: "committed" },
    });
  });

  it("prepared backup이 primary write 전에 바뀌면 migration을 중단한다", () => {
    const storage = new TestStorage();
    const raw = JSON.stringify(createV1Layout());
    storage.values.set(PRIMARY_KEY, raw);
    storage.afterWrite = (key) => {
      if (key !== PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY) return;
      storage.values.set(
        PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
        JSON.stringify({
          sourceVersion: 1,
          migrationId: "tampered",
          raw,
          state: "prepared",
          updatedAt: "2026-08-18T00:00:00.000Z",
        }),
      );
      storage.afterWrite = null;
    };

    const result = migrate(storage);

    expect(result).toMatchObject({
      status: "failed",
      stage: "primary-changed",
    });
    expect(storage.getItem(PRIMARY_KEY)).toBe(raw);
  });

  it("primary가 v2인 동안 committed backup을 덮어쓰지 않는다", () => {
    const storage = new TestStorage();
    storage.values.set(PRIMARY_KEY, JSON.stringify(createV1Layout()));
    expect(migrate(storage).status).toBe("migrated");
    const backupBefore = storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY);
    storage.writes.length = 0;

    const result = migrate(storage, () => "m-2");

    expect(result.status).toBe("already-v2");
    expect(storage.writes).toEqual([]);
    expect(storage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY)).toBe(
      backupBefore,
    );
  });

  it("invalid primary는 valid backup v1을 먼저 복원한 뒤 migration한다", () => {
    const storage = new TestStorage();
    const raw = JSON.stringify(createV1Layout());
    storage.values.set(PRIMARY_KEY, "{invalid");
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
      JSON.stringify({
        sourceVersion: 1,
        migrationId: "m-backup",
        raw,
        state: "prepared",
        updatedAt: "2026-08-18T00:00:00.000Z",
      }),
    );

    const result = migrate(storage);

    expect(result).toMatchObject({
      status: "migrated",
      migrationId: "m-backup",
    });
    expect(JSON.parse(storage.getItem(PRIMARY_KEY) ?? "null")).toMatchObject({
      version: 2,
      migrationSource: { version: 1, migrationId: "m-backup" },
    });
  });
});

describe("ADR-922 Phase 1 compatibility reader", () => {
  it("migrated v2 primary에서는 exact backup v1을 읽는다", () => {
    const storage = new TestStorage();
    const layout = createV1Layout();
    layout.activeRightPanels = ["properties", "history"];
    const raw = JSON.stringify(layout);
    storage.values.set(PRIMARY_KEY, raw);
    expect(migrate(storage).status).toBe("migrated");

    const result = readPanelWorkspaceV1Compatibility({
      storage,
      registry: PANEL_WORKSPACE_TEST_REGISTRY,
      defaultV1Layout: createV1Layout(),
    });

    expect(result.source).toBe("backup-v1");
    expect(result.raw).toBe(raw);
    expect(result.view.layout.activeRightPanels).toEqual([
      "properties",
      "history",
    ]);
  });

  it("backup 없는 v2-born primary는 default 대신 read-only projection을 반환한다", () => {
    const storage = new TestStorage();
    const v2 = createPanelWorkspaceLayoutV2();
    v2.visibility.history = true;
    storage.values.set(PRIMARY_KEY, JSON.stringify(v2));

    const result = readPanelWorkspaceV1Compatibility({
      storage,
      registry: PANEL_WORKSPACE_TEST_REGISTRY,
      defaultV1Layout: createV1Layout(),
    });

    expect(result.source).toBe("projected-v2");
    expect(result.view.layout).not.toEqual(createV1Layout());
    expect(result.view.metadata.placements.history).toBe("right");
  });

  it("v2-born primary는 unrelated backup을 사용하지 않는다", () => {
    const storage = new TestStorage();
    const v2 = createPanelWorkspaceLayoutV2();
    v2.visibility.history = true;
    storage.values.set(PRIMARY_KEY, JSON.stringify(v2));
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
      JSON.stringify({
        sourceVersion: 1,
        migrationId: "unrelated",
        raw: JSON.stringify(createV1Layout()),
        state: "committed",
        updatedAt: "2026-08-18T00:00:00.000Z",
      }),
    );

    const result = readPanelWorkspaceV1Compatibility({
      storage,
      registry: PANEL_WORKSPACE_TEST_REGISTRY,
      defaultV1Layout: createV1Layout(),
    });

    expect(result.source).toBe("projected-v2");
    expect(result.view.layout.activeRightPanels).toContain("history");
  });

  it("migrationId만 같고 v2와 대응하지 않는 backup은 복원하지 않는다", () => {
    const storage = new TestStorage();
    const source = createV1Layout();
    storage.values.set(PRIMARY_KEY, JSON.stringify(source));
    expect(migrate(storage).status).toBe("migrated");
    const primary = storage.getItem(PRIMARY_KEY);
    const unrelated = createV1Layout();
    unrelated.activeRightPanels = ["properties", "history"];
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
      JSON.stringify({
        sourceVersion: 1,
        migrationId: "m-1",
        raw: JSON.stringify(unrelated),
        state: "committed",
        updatedAt: "2026-08-18T00:00:00.000Z",
      }),
    );
    if (primary) storage.values.set(PRIMARY_KEY, primary);

    const result = readPanelWorkspaceV1Compatibility({
      storage,
      registry: PANEL_WORKSPACE_TEST_REGISTRY,
      defaultV1Layout: createV1Layout(),
    });

    expect(result.source).toBe("projected-v2");
  });

  it("invalid primary에서는 valid backup을 우선 복원한다", () => {
    const storage = new TestStorage();
    const raw = JSON.stringify(createV1Layout());
    storage.values.set(PRIMARY_KEY, "{invalid");
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
      JSON.stringify({
        sourceVersion: 1,
        migrationId: "m-1",
        raw,
        state: "prepared",
        updatedAt: "2026-08-18T00:00:00.000Z",
      }),
    );

    const result = readPanelWorkspaceV1Compatibility({
      storage,
      registry: PANEL_WORKSPACE_TEST_REGISTRY,
      defaultV1Layout: createV1Layout(),
    });

    expect(result.source).toBe("backup-v1");
    expect(result.raw).toBe(raw);
  });

  it("primary와 backup이 모두 invalid일 때만 explicit default view로 fallback한다", () => {
    const storage = new TestStorage();
    storage.values.set(PRIMARY_KEY, "{invalid");
    storage.values.set(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY, "{invalid");

    const result = readPanelWorkspaceV1Compatibility({
      storage,
      registry: PANEL_WORKSPACE_TEST_REGISTRY,
      defaultV1Layout: createV1Layout(),
    });

    expect(result.source).toBe("default");
    expect(result.view.source).toBe("default");
    expect(result.view.layout).toEqual(createV1Layout());
  });
});

describe("ADR-922 Phase 1 production isolation", () => {
  it("기존 store가 v2 migration/persistence를 import하지 않아 primary v1을 유지한다", async () => {
    const storeSource = await readFile(
      resolve(__dirname, "../stores/panelLayout.ts"),
      "utf8",
    );
    const migrationSource = await readFile(
      resolve(__dirname, "panelWorkspaceLayoutV2Migration.ts"),
      "utf8",
    );
    const persistenceSource = await readFile(
      resolve(__dirname, "panelWorkspaceLayoutV2Persistence.ts"),
      "utf8",
    );

    expect(storeSource).not.toContain("panelWorkspaceLayoutV2");
    expect(storeSource).toContain(
      "panelLayout: loadLayoutFromStorage() || DEFAULT_PANEL_LAYOUT",
    );
    expect(`${migrationSource}\n${persistenceSource}`).not.toMatch(
      /DatabaseAdapter|db\.documents|supabase/i,
    );
  });
});
