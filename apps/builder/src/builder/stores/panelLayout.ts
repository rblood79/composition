import type { StateCreator } from "zustand";
import type { PanelLayoutState } from "../panels/core/types";
import { DEFAULT_PANEL_LAYOUT } from "../panels/core/types";
import {
  migratePanelWorkspaceStorageToV2,
  PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY,
  readPanelWorkspaceV1Compatibility,
} from "../layout/panelWorkspaceLayoutV2Persistence";
import {
  normalizePanelWorkspaceLayoutV2,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRegistryEntry,
} from "../layout/panelWorkspaceLayoutV2";
import {
  migratePanelLayoutV1ToV2,
  projectV2ToLegacyView,
} from "../layout/panelWorkspaceLayoutV2Migration";

export type PanelWorkspaceHydrationStatus =
  | "pending"
  | "ready"
  | "memory-fallback";

export interface PanelLayoutSliceState {
  /** Phase 6 제거 전까지 unused legacy host가 읽는 read-only projection. */
  panelLayout: PanelLayoutState;
  /** ADR-922 production panel placement/visibility SSOT. */
  panelWorkspaceLayout: PanelWorkspaceLayoutV2 | null;
  panelWorkspaceHydrationStatus: PanelWorkspaceHydrationStatus;
  panelWorkspaceHydrationError: string | null;
}

export interface PanelLayoutSliceActions {
  initializePanelWorkspaceLayout: (
    registry: readonly PanelWorkspaceRegistryEntry[],
  ) => boolean;
  setPanelWorkspaceLayout: (layout: PanelWorkspaceLayoutV2) => boolean;
  setPanelLayout: (layout: PanelLayoutState) => void;
  resetPanelLayout: () => void;
  savePanelLayoutToStorage: () => void;
  loadPanelLayoutFromStorage: () => void;
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

function projectLegacy(
  layout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
): PanelLayoutState {
  return projectV2ToLegacyView(layout, registry, DEFAULT_PANEL_LAYOUT).layout;
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
  panelLayout: DEFAULT_PANEL_LAYOUT,
  panelWorkspaceLayout: null,
  panelWorkspaceHydrationStatus: "pending",
  panelWorkspaceHydrationError: null,

  initializePanelWorkspaceLayout: (registry) => {
    activeRegistry = registry;
    const current = get().panelWorkspaceLayout;
    if (current) {
      const normalized = normalizePanelWorkspaceLayoutV2(current, registry);
      if (!normalized.ok) return false;
      set({
        panelWorkspaceLayout: normalized.value,
        panelLayout: projectLegacy(normalized.value, registry),
      });
      return true;
    }

    let primaryRaw: string | null;
    try {
      primaryRaw = localStorage.getItem(PANEL_WORKSPACE_LAYOUT_PRIMARY_KEY);
    } catch (error) {
      const layout = createDefaultV2(registry);
      set({
        panelWorkspaceLayout: layout,
        panelLayout: projectLegacy(layout, registry),
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
        panelLayout: projectLegacy(layout, registry),
        panelWorkspaceHydrationStatus: persisted ? "ready" : "memory-fallback",
        panelWorkspaceHydrationError: persisted
          ? null
          : "Failed to write the v2-born default layout",
      });
      return persisted;
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
        panelLayout: projectLegacy(migration.layout, registry),
        panelWorkspaceHydrationStatus: "ready",
        panelWorkspaceHydrationError: null,
      });
      return true;
    }

    const fallback = fallbackLayout(registry);
    set({
      panelWorkspaceLayout: fallback.layout,
      panelLayout: projectLegacy(fallback.layout, registry),
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceHydrationError: `${migration.stage}: ${migration.error}; ${fallback.error}`,
    });
    return false;
  },

  setPanelWorkspaceLayout: (layout) => {
    if (!activeRegistry) return false;
    const normalized = normalizePanelWorkspaceLayoutV2(layout, activeRegistry);
    if (!normalized.ok) return false;
    set({
      panelWorkspaceLayout: normalized.value,
      panelLayout: projectLegacy(normalized.value, activeRegistry),
    });
    if (get().panelWorkspaceHydrationStatus === "ready") {
      scheduleV2Write(normalized.value);
    }
    return true;
  },

  setPanelLayout: (legacyLayout) => {
    if (!activeRegistry) {
      set({ panelLayout: legacyLayout });
      return;
    }
    const currentMigrationId =
      get().panelWorkspaceLayout?.migrationSource?.migrationId ?? migrationId();
    const next = migratePanelLayoutV1ToV2(
      legacyLayout,
      activeRegistry,
      currentMigrationId,
    );
    get().setPanelWorkspaceLayout(next);
  },

  resetPanelLayout: () => {
    if (!activeRegistry) {
      set({ panelLayout: DEFAULT_PANEL_LAYOUT });
      return;
    }
    const layout = createDefaultV2(activeRegistry);
    set({
      panelWorkspaceLayout: layout,
      panelLayout: projectLegacy(layout, activeRegistry),
    });
    if (get().panelWorkspaceHydrationStatus === "ready")
      scheduleV2Write(layout);
  },

  savePanelLayoutToStorage: () => {
    const layout = get().panelWorkspaceLayout;
    if (layout && get().panelWorkspaceHydrationStatus === "ready") {
      writeV2Now(layout);
    }
  },

  loadPanelLayoutFromStorage: () => {
    if (!activeRegistry) return;
    set({
      panelWorkspaceLayout: null,
      panelWorkspaceHydrationStatus: "pending",
      panelWorkspaceHydrationError: null,
    });
    get().initializePanelWorkspaceLayout(activeRegistry);
  },
});
