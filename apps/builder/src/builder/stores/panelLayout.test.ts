import { createStore } from "zustand";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PANEL_LAYOUT } from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "../layout/panelWorkspaceLayoutV2.testFixtures";
import { createPanelWorkspaceLayoutV4Fixture } from "../layout/panelWorkspaceLayoutV4.testFixtures";
import {
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
  PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
  parsePanelLayoutV1BackupEnvelope,
} from "../layout/panelWorkspaceLayoutV2Persistence";
import {
  PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY,
  parsePanelLayoutV2BackupEnvelope,
} from "../layout/panelWorkspaceLayoutV3Persistence";
import {
  PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY,
  parsePanelLayoutV3BackupEnvelope,
} from "../layout/panelWorkspaceLayoutV4Persistence";
import { createPanelLayoutSlice, type PanelLayoutSlice } from "./panelLayout";

const SURFACE_RECT = { width: 1200, height: 800 } as const;

function createPanelLayoutStore() {
  return createStore<PanelLayoutSlice>()(createPanelLayoutSlice);
}

function initialize(store: ReturnType<typeof createPanelLayoutStore>) {
  return store
    .getState()
    .initializePanelWorkspaceLayout(
      PANEL_WORKSPACE_TEST_REGISTRY,
      SURFACE_RECT,
    );
}

function hasPersistedPosition(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasPersistedPosition);
  if (typeof value !== "object" || value === null) return false;
  if ("position" in value || "x" in value || "y" in value) return true;
  return Object.values(value).some(hasPersistedPosition);
}

describe("ADR-186 Phase 5 production panel layout store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("v1 primary를 exact v1/v2 backup 뒤 v4 primary로 전환한다", () => {
    const raw = JSON.stringify({
      ...DEFAULT_PANEL_LAYOUT,
      leftPanels: ["nodes"],
      rightPanels: ["properties", "history"],
      bottomPanels: ["monitor"],
      activeLeftPanels: ["nodes"],
      activeRightPanels: ["properties", "history"],
      activeBottomPanels: ["monitor"],
    });
    localStorage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, raw);
    const store = createPanelLayoutStore();

    expect(initialize(store)).toBe(true);
    expect(store.getState().panelWorkspaceLayout?.version).toBe(4);
    expect(
      JSON.parse(localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)!),
    ).toMatchObject({ version: 4 });
    expect(
      parsePanelLayoutV1BackupEnvelope(
        localStorage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
      ),
    ).toMatchObject({ ok: true, value: { raw, state: "committed" } });
    expect(
      parsePanelLayoutV2BackupEnvelope(
        localStorage.getItem(PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY),
      ),
    ).toMatchObject({ ok: true, value: { state: "committed" } });
    expect(
      parsePanelLayoutV3BackupEnvelope(
        localStorage.getItem(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY),
      ),
    ).toMatchObject({ ok: true, value: { state: "committed" } });
  });

  it("v2-born primary를 v4로 migrate하고 exact v2/v3 backup을 보존한다", () => {
    const raw = JSON.stringify(createPanelWorkspaceLayoutV2());
    localStorage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, raw);
    const store = createPanelLayoutStore();

    expect(initialize(store)).toBe(true);
    expect(store.getState().panelWorkspaceLayout).toMatchObject({
      version: 4,
      migrationSource: { version: 3 },
    });
    expect(
      parsePanelLayoutV2BackupEnvelope(
        localStorage.getItem(PANEL_WORKSPACE_LAYOUT_V2_BACKUP_KEY),
      ),
    ).toMatchObject({
      ok: true,
      value: { raw, state: "committed" },
    });
    expect(
      parsePanelLayoutV3BackupEnvelope(
        localStorage.getItem(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY),
      ),
    ).toMatchObject({ ok: true, value: { state: "committed" } });
  });

  it("v3 nodes ID를 geometry 손실 없이 navigator v4로 atomic migrate한다", () => {
    const current = createPanelWorkspaceLayoutV4Fixture(SURFACE_RECT);
    const legacyRaw = JSON.stringify({ ...current, version: 3 }).replaceAll(
      '"navigator"',
      '"nodes"',
    );
    const legacy = JSON.parse(legacyRaw) as {
      clusters: Array<{
        columns: Array<{ rows: Array<{ panelId: string; height: number }> }>;
      }>;
    };
    const legacyHeight = legacy.clusters
      .flatMap((cluster) => cluster.columns)
      .flatMap((column) => column.rows)
      .find((row) => row.panelId === "nodes")?.height;
    localStorage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, legacyRaw);
    const store = createPanelLayoutStore();

    expect(initialize(store)).toBe(true);
    const layout = store.getState().panelWorkspaceLayout!;
    const navigatorHeight = layout.clusters
      .flatMap((cluster) => cluster.columns)
      .flatMap((column) => column.rows)
      .find((row) => row.panelId === "navigator")?.height;
    expect(layout).toMatchObject({
      version: 4,
      migrationSource: { version: 3 },
      visibility: { navigator: true },
    });
    expect(navigatorHeight).toBe(legacyHeight);
    expect(layout.railOrder.left).toContain("navigator");
    expect(layout.railOrder.left).not.toContain("nodes");
    expect(
      localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY),
    ).not.toContain('"nodes"');
    expect(
      parsePanelLayoutV3BackupEnvelope(
        localStorage.getItem(PANEL_WORKSPACE_LAYOUT_V3_BACKUP_KEY),
      ),
    ).toMatchObject({
      ok: true,
      value: { sourceVersion: 3, raw: legacyRaw, state: "committed" },
    });
  });

  it("valid v4 primary는 byte를 다시 쓰지 않고 그대로 hydrate한다", () => {
    const { migrationSource: _migrationSource, ...v4Born } =
      createPanelWorkspaceLayoutV4Fixture(SURFACE_RECT);
    const raw = JSON.stringify(v4Born);
    localStorage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setItem.mockClear();
    const store = createPanelLayoutStore();

    expect(initialize(store)).toBe(true);
    expect(JSON.stringify(store.getState().panelWorkspaceLayout)).toBe(raw);
    expect(localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)).toBe(raw);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("interaction end는 migrationSource와 persisted XY 없이 v4를 debounce 1회 저장한다", () => {
    const raw = JSON.stringify(createPanelWorkspaceLayoutV2());
    localStorage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, raw);
    const store = createPanelLayoutStore();
    expect(initialize(store)).toBe(true);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setItem.mockClear();
    const next = structuredClone(store.getState().panelWorkspaceLayout!);
    next.visibility.history = true;

    expect(store.getState().setPanelWorkspaceLayout(next)).toBe(true);
    vi.advanceTimersByTime(299);
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(
      localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)!,
    ) as unknown;
    expect(persisted).toMatchObject({ version: 4 });
    expect(persisted).not.toHaveProperty("migrationSource");
    expect(hasPersistedPosition(persisted)).toBe(false);
  });

  it("visibility, zone, size, cluster focus order를 v4 refresh에서 그대로 복원한다", () => {
    const initial = createPanelWorkspaceLayoutV4Fixture(SURFACE_RECT);
    localStorage.setItem(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(initial),
    );
    const first = createPanelLayoutStore();
    expect(initialize(first)).toBe(true);
    const next = structuredClone(first.getState().panelWorkspaceLayout!);
    next.visibility.history = true;
    const right = next.clusters.find(
      (cluster) => cluster.placementZone === "top-right",
    );
    if (!right) throw new Error("top-right cluster is required");
    right.columns[0]!.width = 360;
    right.placementZone = "center";
    next.clusterFocusOrder = [
      ...next.clusterFocusOrder.filter((id) => id !== right.id),
      right.id,
    ];

    expect(first.getState().setPanelWorkspaceLayout(next)).toBe(true);
    vi.advanceTimersByTime(300);
    const persistedRaw = localStorage.getItem(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
    );
    const refreshed = createPanelLayoutStore();
    expect(initialize(refreshed)).toBe(true);
    expect(JSON.stringify(refreshed.getState().panelWorkspaceLayout)).toBe(
      persistedRaw,
    );
  });

  it("explicit reset은 measured surface의 v4 default를 즉시 저장한다", () => {
    const store = createPanelLayoutStore();
    expect(initialize(store)).toBe(true);
    const moved = structuredClone(store.getState().panelWorkspaceLayout!);
    const right = moved.clusters.find(
      (cluster) => cluster.placementZone === "top-right",
    );
    if (!right) throw new Error("top-right cluster is required");
    right.placementZone = "bottom-right";
    expect(store.getState().setPanelWorkspaceLayout(moved)).toBe(true);

    expect(store.getState().resetPanelWorkspaceLayout()).toBe(true);
    const reset = store.getState().panelWorkspaceLayout!;
    expect(reset.visibility).toEqual(moved.visibility);
    expect(
      reset.clusters.find((cluster) =>
        cluster.columns.some((column) =>
          column.rows.some((row) => row.panelId === "properties"),
        ),
      )?.placementZone,
    ).toBe("top-right");
    expect(
      JSON.parse(localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)!),
    ).toEqual(reset);
    expect(hasPersistedPosition(reset)).toBe(false);
  });

  it("storage read 실패는 renderer를 중단하지 않고 v4 memory fallback으로 전환한다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const store = createPanelLayoutStore();

    expect(initialize(store)).toBe(false);
    expect(store.getState()).toMatchObject({
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceLayout: { version: 4 },
    });
  });

  it("production slice에 v1/v2 projection과 compatibility action을 만들지 않는다", () => {
    const state = createPanelLayoutStore().getState();

    expect(Object.keys(state)).not.toContain("panelLayout");
    expect(Object.keys(state)).not.toContain("setPanelLayout");
    expect(Object.keys(state)).not.toContain("resetPanelLayout");
    expect(Object.keys(state)).not.toContain("savePanelLayoutToStorage");
    expect(Object.keys(state)).not.toContain("loadPanelLayoutFromStorage");
  });
});
