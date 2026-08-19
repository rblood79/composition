import type { StateCreator } from "zustand";
import { DEFAULT_PANEL_LAYOUT } from "../panels/core/types";
import {
  migratePanelWorkspaceStorageToV2,
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
  readPanelWorkspaceV1Compatibility,
} from "../layout/panelWorkspaceLayoutV2Persistence";
import {
  normalizePanelWorkspaceLayoutV2,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
} from "../layout/panelWorkspaceLayoutV2";
import { migratePanelLayoutV1ToV2 } from "../layout/panelWorkspaceLayoutV2Migration";
import { rollbackPanelWorkspaceStorageToV2 } from "../layout/panelWorkspaceLayoutV3Rollback";

export type PanelWorkspaceHydrationStatus =
  | "pending"
  | "ready"
  | "memory-fallback";

export interface PanelLayoutSliceState {
  /** ADR-922 production panel placement/visibility SSOT. */
  panelWorkspaceLayout: PanelWorkspaceLayoutV2 | null;
  panelWorkspaceHydrationStatus: PanelWorkspaceHydrationStatus;
  panelWorkspaceHydrationError: string | null;
}

export interface PanelLayoutSliceActions {
  initializePanelWorkspaceLayout: (
    registry: readonly PanelWorkspaceRegistryEntry[],
    surfaceRect: PanelWorkspaceRect,
  ) => boolean;
  setPanelWorkspaceLayout: (layout: PanelWorkspaceLayoutV2) => boolean;
}

export type PanelLayoutSlice = PanelLayoutSliceState & PanelLayoutSliceActions;

let activeRegistry: readonly PanelWorkspaceRegistryEntry[] | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function migrationId(): string {
  return crypto.randomUUID();
}

function createDefaultV2(
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelWorkspaceLayoutV2 {
  const migrated = migratePanelLayoutV1ToV2(
    DEFAULT_PANEL_LAYOUT,
    registry,
    migrationId(),
  );
  const { migrationSource: _migrationSource, ...v2Born } = migrated;
  return v2Born;
}

function scheduleV2Write(layout: PanelWorkspaceLayoutV2): void {
  if (saveTimer !== null) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      localStorage.setItem(
        PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
        JSON.stringify(layout),
      );
    } catch (error) {
      console.error("[PanelWorkspace] Failed to persist v2 layout:", error);
    }
  }, 300);
}

function writeV2Now(layout: PanelWorkspaceLayoutV2): boolean {
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
    console.error("[PanelWorkspace] Failed to persist v2 layout:", error);
    return false;
  }
}

function fallbackLayout(registry: readonly PanelWorkspaceRegistryEntry[]): {
  layout: PanelWorkspaceLayoutV2;
  error: string;
} {
  try {
    const compatibility = readPanelWorkspaceV1Compatibility({
      storage: localStorage,
      registry,
      defaultV1Layout: DEFAULT_PANEL_LAYOUT,
    });
    return {
      layout: migratePanelLayoutV1ToV2(
        compatibility.view.layout,
        registry,
        migrationId(),
      ),
      error: `Storage migration failed; using ${compatibility.source} in memory`,
    };
  } catch (error) {
    return {
      layout: createDefaultV2(registry),
      error: error instanceof Error ? error.message : String(error),
    };
  }
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
    const current = get().panelWorkspaceLayout;
    if (current) {
      const normalized = normalizePanelWorkspaceLayoutV2(current, registry);
      if (!normalized.ok) return false;
      set({ panelWorkspaceLayout: normalized.value });
      return true;
    }

    let primaryRaw: string | null;
    try {
      primaryRaw = localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
    } catch (error) {
      const layout = createDefaultV2(registry);
      set({
        panelWorkspaceLayout: layout,
        panelWorkspaceHydrationStatus: "memory-fallback",
        panelWorkspaceHydrationError:
          error instanceof Error ? error.message : String(error),
      });
      return false;
    }
    if (primaryRaw === null) {
      const layout = createDefaultV2(registry);
      const persisted = writeV2Now(layout);
      set({
        panelWorkspaceLayout: layout,
        panelWorkspaceHydrationStatus: persisted ? "ready" : "memory-fallback",
        panelWorkspaceHydrationError: persisted
          ? null
          : "Failed to write the v2-born default layout",
      });
      return persisted;
    }

    const rollback = rollbackPanelWorkspaceStorageToV2({
      storage: localStorage,
      registry,
      surfaceRect,
      createRollbackId: migrationId,
      now: () => new Date().toISOString(),
    });
    if (
      rollback.status === "rolled-back" ||
      rollback.status === "recovered-commit" ||
      rollback.status === "already-v2"
    ) {
      set({
        panelWorkspaceLayout: rollback.layout,
        panelWorkspaceHydrationStatus: "ready",
        panelWorkspaceHydrationError: null,
      });
      return true;
    }
    if (rollback.status === "failed") {
      const fallback = fallbackLayout(registry);
      set({
        panelWorkspaceLayout: fallback.layout,
        panelWorkspaceHydrationStatus: "memory-fallback",
        panelWorkspaceHydrationError: `${rollback.stage}: ${rollback.error}; ${fallback.error}`,
      });
      return false;
    }

    let migration = migratePanelWorkspaceStorageToV2({
      storage: localStorage,
      registry,
      defaultV1Layout: DEFAULT_PANEL_LAYOUT,
      createMigrationId: migrationId,
      now: () => new Date().toISOString(),
    });
    if (migration.status === "failed") {
      migration = migratePanelWorkspaceStorageToV2({
        storage: localStorage,
        registry,
        defaultV1Layout: DEFAULT_PANEL_LAYOUT,
        createMigrationId: migrationId,
        now: () => new Date().toISOString(),
      });
    }
    if (migration.status !== "failed") {
      set({
        panelWorkspaceLayout: migration.layout,
        panelWorkspaceHydrationStatus: "ready",
        panelWorkspaceHydrationError: null,
      });
      return true;
    }

    const fallback = fallbackLayout(registry);
    set({
      panelWorkspaceLayout: fallback.layout,
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceHydrationError: `${migration.stage}: ${migration.error}; ${fallback.error}`,
    });
    return false;
  },

  setPanelWorkspaceLayout: (layout) => {
    if (!activeRegistry) return false;
    const normalized = normalizePanelWorkspaceLayoutV2(layout, activeRegistry);
    if (!normalized.ok) return false;
    set({ panelWorkspaceLayout: normalized.value });
    if (get().panelWorkspaceHydrationStatus === "ready") {
      scheduleV2Write(normalized.value);
    }
    return true;
  },
});
