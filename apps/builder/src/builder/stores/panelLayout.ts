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
  createDefaultPanelWorkspaceLayoutV3,
  normalizePanelWorkspaceLayoutV3,
  type PanelWorkspaceLayoutV3,
} from "../layout/panelWorkspaceLayoutV3";
import { migratePanelWorkspaceStorageToV3 } from "../layout/panelWorkspaceLayoutV3Persistence";
import { resetPanelWorkspaceLayoutV3 } from "../layout/panelWorkspacePolicyV3";

export type PanelWorkspaceHydrationStatus =
  | "pending"
  | "ready"
  | "memory-fallback";

export interface PanelLayoutSliceState {
  /** ADR-186 production panel placement/visibility SSOT. */
  panelWorkspaceLayout: PanelWorkspaceLayoutV3 | null;
  panelWorkspaceHydrationStatus: PanelWorkspaceHydrationStatus;
  panelWorkspaceHydrationError: string | null;
}

export interface PanelLayoutSliceActions {
  initializePanelWorkspaceLayout: (
    registry: readonly PanelWorkspaceRegistryEntry[],
    surfaceRect: PanelWorkspaceRect,
  ) => boolean;
  setPanelWorkspaceLayout: (layout: PanelWorkspaceLayoutV3) => boolean;
  resetPanelWorkspaceLayout: () => boolean;
}

export type PanelLayoutSlice = PanelLayoutSliceState & PanelLayoutSliceActions;

let activeRegistry: readonly PanelWorkspaceRegistryEntry[] | null = null;
let activeSurfaceRect: PanelWorkspaceRect | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function migrationId(): string {
  return crypto.randomUUID();
}

function createDefaultV3(
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
): PanelWorkspaceLayoutV3 {
  const created = createDefaultPanelWorkspaceLayoutV3(registry, surfaceRect);
  if (!created.ok) {
    throw new Error(created.error);
  }
  return created.value;
}

function scheduleV3Write(layout: PanelWorkspaceLayoutV3): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(
        PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
        JSON.stringify(layout),
      );
    } catch (error) {
      console.error("[PanelWorkspace] Failed to persist v3 layout:", error);
    }
  }, 300);
}

function writeV3Now(layout: PanelWorkspaceLayoutV3): boolean {
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
    console.error("[PanelWorkspace] Failed to persist v3 layout:", error);
    return false;
  }
}

function fallbackLayout(
  registry: readonly PanelWorkspaceRegistryEntry[],
  surfaceRect: PanelWorkspaceRect,
  error: unknown,
): { layout: PanelWorkspaceLayoutV3; error: string } {
  return {
    layout: createDefaultV3(registry, surfaceRect),
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
      const normalized = normalizePanelWorkspaceLayoutV3(
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
      const layout = createDefaultV3(registry, surfaceRect);
      const persisted = writeV3Now(layout);
      set({
        panelWorkspaceLayout: layout,
        panelWorkspaceHydrationStatus: persisted ? "ready" : "memory-fallback",
        panelWorkspaceHydrationError: persisted
          ? null
          : "Failed to write the v3-born default layout",
      });
      return persisted;
    }

    const migration = migratePrimaryToV3(registry, surfaceRect);
    if (migration.status !== "failed" && migration.status !== "recovered-v2") {
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
        : "V2 recovery did not reach a v3 primary";
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
    const normalized = normalizePanelWorkspaceLayoutV3(
      layout,
      activeRegistry,
      activeSurfaceRect,
    );
    if (!normalized.ok) return false;
    const { migrationSource: _migrationSource, ...v3Born } = normalized.value;
    set({ panelWorkspaceLayout: v3Born });
    if (get().panelWorkspaceHydrationStatus === "ready") {
      scheduleV3Write(v3Born);
    }
    return true;
  },

  resetPanelWorkspaceLayout: () => {
    if (!activeRegistry || !activeSurfaceRect) return false;
    const current = get().panelWorkspaceLayout;
    if (!current) return false;
    const reset = resetPanelWorkspaceLayoutV3(
      current,
      activeRegistry,
      activeSurfaceRect,
    );
    if (!reset.ok) return false;
    const layout = reset.value.layout;
    set({ panelWorkspaceLayout: layout });
    if (get().panelWorkspaceHydrationStatus !== "ready") return true;
    return writeV3Now(layout);
  },
});
