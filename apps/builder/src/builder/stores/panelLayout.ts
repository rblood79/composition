import type { StateCreator } from "zustand";
import { DEFAULT_PANEL_LAYOUT } from "../panels/core/types";
import {
  migratePanelWorkspaceStorageToV2,
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
} from "../layout/panelWorkspaceLayoutV2Persistence";
import type {
  PanelWorkspaceRect,
  PanelWorkspaceRegistryEntry,
} from "../layout/panelWorkspaceLayoutV2";
import {
  createDefaultPanelWorkspaceLayoutV4,
  normalizePanelWorkspaceLayoutV4,
  type PanelWorkspaceLayoutV4,
} from "../layout/panelWorkspaceLayoutV4";
import { migratePanelWorkspaceStorageToV3 } from "../layout/panelWorkspaceLayoutV3Persistence";
import { migratePanelWorkspaceStorageToV4 } from "../layout/panelWorkspaceLayoutV4Persistence";
import { resetPanelWorkspaceLayoutV4 } from "../layout/panelWorkspacePolicyV4";

export type PanelWorkspaceHydrationStatus =
  "pending" | "ready" | "memory-fallback";

export interface PanelLayoutSliceState {
  /** ADR-186 production panel placement/visibility SSOT. */
  panelWorkspaceLayout: PanelWorkspaceLayoutV4 | null;
  panelWorkspaceHydrationStatus: PanelWorkspaceHydrationStatus;
  panelWorkspaceHydrationError: string | null;
}

export interface PanelLayoutSliceActions {
  initializePanelWorkspaceLayout: (
    registry: readonly PanelWorkspaceRegistryEntry[],
    surfaceRect: PanelWorkspaceRect,
  ) => boolean;
  setPanelWorkspaceLayout: (layout: PanelWorkspaceLayoutV4) => boolean;
  resetPanelWorkspaceLayout: () => boolean;
}

export type PanelLayoutSlice = PanelLayoutSliceState & PanelLayoutSliceActions;

let activeRegistry: readonly PanelWorkspaceRegistryEntry[] | null = null;
let activeSurfaceRect: PanelWorkspaceRect | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function migrationId(): string {
  return crypto.randomUUID();
}

function createDefaultV4(
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceLayoutV4 {
  const created = createDefaultPanelWorkspaceLayoutV4(registry, surfaceRect);
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value;
}

function scheduleV4Write(layout: PanelWorkspaceLayoutV4): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(
        PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
        JSON.stringify(layout),
      );
    } catch (error) {
      console.error("[PanelWorkspace] Failed to persist v4 layout:", error);
    }
  }, 300);
}

function writeV4Now(layout: PanelWorkspaceLayoutV4): boolean {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  try {
    localStorage.setItem(
      PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
      JSON.stringify(layout),
    );
    return true;
  } catch (error) {
    console.error("[PanelWorkspace] Failed to persist v4 layout:", error);
    return false;
  }
}

function fallbackLayout(
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  error: unknown,
): { layout: PanelWorkspaceLayoutV4; error: string } {
  return {
    layout: createDefaultV4(registry, surfaceRect),
    error: error instanceof Error ? error.message : String(error),
  };
}

function migratePrimaryToV3(
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): ReturnType<typeof migratePanelWorkspaceStorageToV3> {
  const options = {
    storage: localStorage,
    registry,
    surfaceRect,
    createMigrationId: migrationId,
    now: () => new Date().toISOString(),
  };
  let migration = migratePanelWorkspaceStorageToV3(options);
  if (migration.status === "recovered-v2") {
    migration = migratePanelWorkspaceStorageToV3(options);
  }
  if (migration.status !== "failed") return migration;

  const v2Recovery = migratePanelWorkspaceStorageToV2({
    storage: localStorage,
    registry,
    defaultV1Layout: DEFAULT_PANEL_LAYOUT,
    createMigrationId: migrationId,
    now: options.now,
  });
  if (v2Recovery.status === "failed") return migration;
  return migratePanelWorkspaceStorageToV3(options);
}

function migratePrimaryToV4(
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): ReturnType<typeof migratePanelWorkspaceStorageToV4> {
  const options = {
    storage: localStorage,
    registry,
    surfaceRect,
    createMigrationId: migrationId,
    now: () => new Date().toISOString(),
  };
  let migration = migratePanelWorkspaceStorageToV4(options);
  if (migration.status === "recovered-v3") {
    migration = migratePanelWorkspaceStorageToV4(options);
  }
  if (migration.status !== "failed") return migration;

  const v3Recovery = migratePrimaryToV3(registry, surfaceRect);
  if (v3Recovery.status === "failed") return migration;
  migration = migratePanelWorkspaceStorageToV4(options);
  if (migration.status === "recovered-v3") {
    migration = migratePanelWorkspaceStorageToV4(options);
  }
  return migration;
}

export const createPanelLayoutSlice: StateCreator<
  PanelLayoutSlice,
  [],
  [],
  PanelLayoutSlice
> = (set, get) => ({
  panelWorkspaceLayout: null,
  panelWorkspaceHydrationStatus: "pending",
  panelWorkspaceHydrationError: null,

  initializePanelWorkspaceLayout: (registry, surfaceRect) => {
    activeRegistry = registry;
    activeSurfaceRect = { ...surfaceRect };
    const current = get().panelWorkspaceLayout;
    if (current) {
      const normalized = normalizePanelWorkspaceLayoutV4(
        current,
        registry,
        surfaceRect,
      );
      if (!normalized.ok) return false;
      set({ panelWorkspaceLayout: normalized.value });
      return true;
    }

    let primaryRaw: string | null;
    try {
      primaryRaw = localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
    } catch (error) {
      const fallback = fallbackLayout(registry, surfaceRect, error);
      set({
        panelWorkspaceLayout: fallback.layout,
        panelWorkspaceHydrationStatus: "memory-fallback",
        panelWorkspaceHydrationError: fallback.error,
      });
      return false;
    }

    if (primaryRaw === null) {
      const layout = createDefaultV4(registry, surfaceRect);
      const persisted = writeV4Now(layout);
      set({
        panelWorkspaceLayout: layout,
        panelWorkspaceHydrationStatus: persisted ? "ready" : "memory-fallback",
        panelWorkspaceHydrationError: persisted
          ? null
          : "Failed to write the v4-born default layout",
      });
      return persisted;
    }

    const migration = migratePrimaryToV4(registry, surfaceRect);
    if (migration.status !== "failed" && migration.status !== "recovered-v3") {
      set({
        panelWorkspaceLayout: migration.layout,
        panelWorkspaceHydrationStatus: "ready",
        panelWorkspaceHydrationError: null,
      });
      return true;
    }

    const error =
      migration.status === "failed"
        ? `${migration.stage}: ${migration.error}`
        : "V3 recovery did not reach a v4 primary";
    const fallback = fallbackLayout(registry, surfaceRect, error);
    set({
      panelWorkspaceLayout: fallback.layout,
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceHydrationError: fallback.error,
    });
    return false;
  },

  setPanelWorkspaceLayout: (layout) => {
    if (!activeRegistry || !activeSurfaceRect) return false;
    const normalized = normalizePanelWorkspaceLayoutV4(
      layout,
      activeRegistry,
      activeSurfaceRect,
    );
    if (!normalized.ok) return false;
    const { migrationSource: _migrationSource, ...v4Born } = normalized.value;
    set({ panelWorkspaceLayout: v4Born });
    if (get().panelWorkspaceHydrationStatus === "ready") {
      scheduleV4Write(v4Born);
    }
    return true;
  },

  resetPanelWorkspaceLayout: () => {
    if (!activeRegistry || !activeSurfaceRect) return false;
    const current = get().panelWorkspaceLayout;
    if (!current) return false;
    const reset = resetPanelWorkspaceLayoutV4(
      current,
      activeRegistry,
      activeSurfaceRect,
    );
    if (!reset.ok) return false;
    const layout = reset.value.layout;
    set({ panelWorkspaceLayout: layout });
    if (get().panelWorkspaceHydrationStatus !== "ready") return true;
    return writeV4Now(layout);
  },
});
