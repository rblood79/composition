import { describe, expect, it } from "vitest";
import { parsePanelWorkspaceLayoutV2 } from "./panelWorkspaceLayoutV2";
import {
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
  type PanelWorkspaceStorage as PanelWorkspacePersistenceStorage,
} from "./panelWorkspaceLayoutV2Persistence";
import {
  createPanelWorkspaceLayoutV2,
  PANEL_WORKSPACE_TEST_REGISTRY,
} from "./panelWorkspaceLayoutV2.testFixtures";
import {
  createDefaultPanelWorkspaceLayoutV3,
  type PanelWorkspaceLayoutV3,
} from "./panelWorkspaceLayoutV3";
import {
  migratePanelWorkspaceStorageToV3,
  PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY,
} from "./panelWorkspaceLayoutV3Persistence";
import {
  PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY,
  parsePanelLayoutV3RollbackEnvelope,
  projectPanelWorkspaceLayoutV3ToV2,
  rollbackPanelWorkspaceStorageToV2,
} from "./panelWorkspaceLayoutV3Rollback";

const SURFACE_RECT = { width: 1200, height: 800 } as const;

class FaultStorage implements PanelWorkspacePersistenceStorage {
  readonly values = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  failAtWrite: number | null = null;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const writeIndex = this.writes.length + 1;
    this.writes.push({ key, value });
    if (this.failAtWrite === writeIndex) {
      throw new Error(`fault at write ${writeIndex}`);
    }
    this.values.set(key, value);
  }
}

function rollback(storage: FaultStorage) {
  return rollbackPanelWorkspaceStorageToV2({
    storage,
    registry: PANEL_WORKSPACE_TEST_REGISTRY,
    surfaceRect: SURFACE_RECT,
    createRollbackId: () => "rollback-v3-v2",
    now: () => "2026-08-19T01:00:00.000Z",
  });
}

function migrateV2Primary(storage: FaultStorage): {
  v2Raw: string;
  v3: PanelWorkspaceLayoutV3;
} {
  const v2Raw = JSON.stringify(createPanelWorkspaceLayoutV2());
  storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v2Raw);
  const migrated = migratePanelWorkspaceStorageToV3({
    storage,
    registry: PANEL_WORKSPACE_TEST_REGISTRY,
    surfaceRect: SURFACE_RECT,
    createMigrationId: () => "migration-v2-v3",
    now: () => "2026-08-19T00:00:00.000Z",
  });
  if (migrated.status === "failed" || migrated.layout.version !== 3) {
    throw new Error("Failed to create v3 migration fixture");
  }
  storage.writes.length = 0;
  return { v2Raw, v3: migrated.layout };
}

function v3BornRaw(): string {
  const result = createDefaultPanelWorkspaceLayoutV3(
    PANEL_WORKSPACE_TEST_REGISTRY,
    SURFACE_RECT,
    { navigator: true, properties: true, monitor: true },
  );
  if (!result.ok) throw new Error(result.error);
  return JSON.stringify(result.value);
}

describe("ADR-186 v3 -> v2 operational rollback", () => {
  it("projection은 zone만 actual-surface floating position으로 바꾸고 graph를 보존한다", () => {
    const storage = new FaultStorage();
    const { v3 } = migrateV2Primary(storage);
    const edited = structuredClone(v3);
    const right = edited.clusters.find(
      (cluster) => cluster.placementZone === "top-right",
    )!;
    right.columns[0]!.width = 500;
    edited.clusterFocusOrder = [
      ...edited.clusterFocusOrder.filter((id) => id !== right.id),
      right.id,
    ];

    const projected = projectPanelWorkspaceLayoutV3ToV2(
      edited,
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE_RECT,
    );
    expect(projected.ok).toBe(true);
    if (!projected.ok) return;
    expect(projected.value.visibility).toEqual(edited.visibility);
    expect(projected.value.railOrder).toEqual(edited.railOrder);
    expect(projected.value.floatingFocusOrder).toEqual(
      edited.clusterFocusOrder,
    );
    expect(
      projected.value.clusters.map(({ id, columns }) => ({ id, columns })),
    ).toEqual(edited.clusters.map(({ id, columns }) => ({ id, columns })));
    expect(
      projected.value.clusters.every(({ anchor }) => anchor === "floating"),
    ).toBe(true);
    const projectedRight = projected.value.clusters.find(
      (cluster) => cluster.id === right.id,
    )!;
    if (projectedRight.anchor !== "floating") return;
    expect(projectedRight.position.x + 500).toBe(SURFACE_RECT.width);
    expect(projectedRight.position.y).toBe(0);
  });

  it("migration 직후 byte-identical v3는 exact v2 raw를 복원한다", () => {
    const storage = new FaultStorage();
    const { v2Raw } = migrateV2Primary(storage);

    expect(rollback(storage)).toMatchObject({
      status: "rolled-back",
      layout: { version: 2 },
    });
    expect(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)).toBe(v2Raw);
    expect(
      parsePanelLayoutV3RollbackEnvelope(
        storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY),
      ),
    ).toMatchObject({
      ok: true,
      value: { state: "committed", targetKind: "exact-v2" },
    });
  });

  it("migration 이후 편집된 v3는 stale v2 backup 대신 current v3를 projection한다", () => {
    const storage = new FaultStorage();
    const { v2Raw, v3 } = migrateV2Primary(storage);
    const edited = structuredClone(v3);
    const right = edited.clusters.find(
      (cluster) => cluster.placementZone === "top-right",
    )!;
    right.columns[0]!.width = 500;
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(edited),
    );

    expect(rollback(storage)).toMatchObject({ status: "rolled-back" });
    const primaryRaw = storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)!;
    expect(primaryRaw).not.toBe(v2Raw);
    const primary = parsePanelWorkspaceLayoutV2(
      JSON.parse(primaryRaw) as unknown,
      PANEL_WORKSPACE_TEST_REGISTRY,
    );
    expect(primary.ok).toBe(true);
    if (!primary.ok) return;
    expect(
      primary.value.clusters.find((cluster) => cluster.id === right.id)
        ?.columns[0]?.width,
    ).toBe(500);
    expect(
      parsePanelLayoutV3RollbackEnvelope(
        storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY),
      ),
    ).toMatchObject({
      ok: true,
      value: { state: "committed", targetKind: "projected-v2" },
    });
  });

  it("v3-born primary도 valid v2 primary로 projection한다", () => {
    const storage = new FaultStorage();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3BornRaw());

    expect(rollback(storage)).toMatchObject({
      status: "rolled-back",
      layout: { version: 2 },
    });
    expect(
      JSON.parse(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY) ?? "{}")
        .version,
    ).toBe(2);
    expect(storage.getItem(PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY)).toBeNull();
  });

  it("committed rollback 뒤 v2 current layout이 편집돼도 정상 v2로 hydrate한다", () => {
    const storage = new FaultStorage();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3BornRaw());
    expect(rollback(storage)).toMatchObject({ status: "rolled-back" });
    const edited = JSON.parse(
      storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY) ?? "{}",
    ) as ReturnType<typeof createPanelWorkspaceLayoutV2>;
    edited.visibility.history = true;
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(edited),
    );

    expect(rollback(storage)).toMatchObject({
      status: "already-v2",
      layout: { version: 2, visibility: { history: true } },
    });
  });

  it.each([
    [1, "prepare-backup", 3, null],
    [2, "write-primary", 3, "prepared"],
    [3, "commit-backup", 2, "prepared"],
  ] as const)(
    "rollback write boundary %i fault(stage=%s)는 재실행에서 valid v2로 수렴한다",
    (failAtWrite, stage, primaryVersion, backupState) => {
      const storage = new FaultStorage();
      storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3BornRaw());
      storage.failAtWrite = failAtWrite;

      expect(rollback(storage)).toMatchObject({ status: "failed", stage });
      expect(
        JSON.parse(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY) ?? "{}")
          .version,
      ).toBe(primaryVersion);
      const backup = parsePanelLayoutV3RollbackEnvelope(
        storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY),
      );
      if (backupState === null) {
        expect(backup.ok).toBe(false);
      } else {
        expect(backup).toMatchObject({
          ok: true,
          value: { state: backupState },
        });
      }

      storage.failAtWrite = null;
      expect(rollback(storage)).toMatchObject({
        status: failAtWrite === 3 ? "recovered-commit" : "rolled-back",
        layout: { version: 2 },
      });
      expect(
        parsePanelLayoutV3RollbackEnvelope(
          storage.getItem(PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY),
        ),
      ).toMatchObject({ ok: true, value: { state: "committed" } });
    },
  );

  it("prepared rollback backup과 primary가 다르면 stale target을 쓰지 않는다", () => {
    const storage = new FaultStorage();
    storage.values.set(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, v3BornRaw());
    storage.values.set(
      PANEL_WORKSPACE_LAYOUT_V3_ROLLBACK_BACKUP_KEY,
      JSON.stringify({
        sourceVersion: 3,
        rollbackId: "stale",
        raw: '{"version":3}',
        targetRaw: JSON.stringify(createPanelWorkspaceLayoutV2()),
        targetKind: "projected-v2",
        state: "prepared",
        updatedAt: "2026-08-19T00:00:00.000Z",
      }),
    );

    expect(rollback(storage)).toMatchObject({
      status: "failed",
      stage: "backup-mismatch",
    });
    expect(storage.writes).toEqual([]);
    expect(
      JSON.parse(storage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY) ?? "{}")
        .version,
    ).toBe(3);
  });
});
