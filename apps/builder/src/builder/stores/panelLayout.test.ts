import { createStore } from "zustand";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PANEL_LAYOUT } from "../panels/core/types";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "../layout/panelWorkspaceLayoutV2.testFixtures";
import {
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
  PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY,
  parsePanelLayoutV1BackupEnvelope,
} from "../layout/panelWorkspaceLayoutV2Persistence";
import { createPanelLayoutSlice, type PanelLayoutSlice } from "./panelLayout";

function createPanelLayoutStore() {
  return createStore<PanelLayoutSlice>()(createPanelLayoutSlice);
}

describe("ADR-922 production panel layout store", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("v1 primary를 exact prepared backup 뒤 v2로 쓰고 committed로 잠근다", () => {
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

    expect(
      store
        .getState()
        .initializePanelWorkspaceLayout(PANEL_WORKSPACE_TEST_REGISTRY),
    ).toBe(true);

    expect(store.getState().panelWorkspaceLayout?.version).toBe(2);
    expect(
      JSON.parse(localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)!),
    ).toMatchObject({ version: 2 });
    const backup = parsePanelLayoutV1BackupEnvelope(
      localStorage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
    );
    expect(backup.ok).toBe(true);
    if (!backup.ok) return;
    expect(backup.value).toMatchObject({ raw, state: "committed" });
  });

  it("backup 없는 v2-born primary를 읽을 때 byte를 다시 쓰지 않는다", () => {
    const raw = JSON.stringify(createPanelWorkspaceLayoutV2());
    localStorage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, raw);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setItem.mockClear();
    const store = createPanelLayoutStore();

    expect(
      store
        .getState()
        .initializePanelWorkspaceLayout(PANEL_WORKSPACE_TEST_REGISTRY),
    ).toBe(true);

    expect(localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY)).toBe(raw);
    expect(setItem).not.toHaveBeenCalled();
    expect(
      localStorage.getItem(PANEL_WORKSPACE_LAYOUT_V1_BACKUP_KEY),
    ).toBeNull();
  });

  it("interaction end store commit은 debounce 뒤 primary write를 한 번만 수행한다", () => {
    const raw = JSON.stringify(createPanelWorkspaceLayoutV2());
    localStorage.setItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY, raw);
    const store = createPanelLayoutStore();
    store
      .getState()
      .initializePanelWorkspaceLayout(PANEL_WORKSPACE_TEST_REGISTRY);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    setItem.mockClear();
    const next = createPanelWorkspaceLayoutV2();
    next.visibility.history = true;

    expect(store.getState().setPanelWorkspaceLayout(next)).toBe(true);
    vi.advanceTimersByTime(299);
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem).toHaveBeenCalledWith(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(next),
    );
  });

  it("visibility, cluster, size, floating focus order를 v2 refresh에서 그대로 복원한다", () => {
    const initial = createPanelWorkspaceLayoutV2();
    localStorage.setItem(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(initial),
    );
    const first = createPanelLayoutStore();
    first
      .getState()
      .initializePanelWorkspaceLayout(PANEL_WORKSPACE_TEST_REGISTRY);
    const next = createPanelWorkspaceLayoutV2();
    next.visibility.history = true;
    next.clusters.push({
      id: "floating:history",
      anchor: "floating",
      position: { x: 420, y: 180 },
      columns: [
        {
          id: "floating:history:column:0",
          width: 360,
          rows: [{ panelId: "history", height: 480 }],
        },
      ],
    });
    const right = next.clusters.find((cluster) => cluster.anchor === "right");
    const historyRow = right?.columns[0]?.rows.findIndex(
      (row) => row.panelId === "history",
    );
    if (right && historyRow !== undefined && historyRow >= 0) {
      right.columns[0]?.rows.splice(historyRow, 1);
    }
    next.floatingFocusOrder = ["floating:history"];

    expect(first.getState().setPanelWorkspaceLayout(next)).toBe(true);
    vi.advanceTimersByTime(300);
    const persistedRaw = localStorage.getItem(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
    );
    const refreshed = createPanelLayoutStore();
    expect(
      refreshed
        .getState()
        .initializePanelWorkspaceLayout(PANEL_WORKSPACE_TEST_REGISTRY),
    ).toBe(true);

    expect(JSON.stringify(refreshed.getState().panelWorkspaceLayout)).toBe(
      persistedRaw,
    );
  });

  it("storage read 실패는 renderer를 중단하지 않고 memory fallback으로 전환한다", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const store = createPanelLayoutStore();

    expect(
      store
        .getState()
        .initializePanelWorkspaceLayout(PANEL_WORKSPACE_TEST_REGISTRY),
    ).toBe(false);
    expect(store.getState()).toMatchObject({
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceLayout: { version: 2 },
    });
  });

  it("production slice에 v1 projection과 compatibility action을 만들지 않는다", () => {
    const state = createPanelLayoutStore().getState();

    expect(Object.keys(state)).not.toContain("panelLayout");
    expect(Object.keys(state)).not.toContain("setPanelLayout");
    expect(Object.keys(state)).not.toContain("resetPanelLayout");
    expect(Object.keys(state)).not.toContain("savePanelLayoutToStorage");
    expect(Object.keys(state)).not.toContain("loadPanelLayoutFromStorage");
  });
});
