import { useCallback } from "react";
import { useStore } from "../stores";
import type { PanelFrameGeometry, PanelId } from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import type { UsePanelLayoutReturn } from "../layout/types";
import { dispatchPanelWorkspaceActivation } from "../layout/panelWorkspaceActivationDispatcher";
import {
  activatePanelWorkspacePanel,
  detachPanelToFloatingCluster,
  focusPanelWorkspaceFloatingCluster,
  type PanelWorkspaceInteractionResult,
} from "../layout/panelWorkspaceLayoutInteraction";
import {
  createPanelWorkspaceRegistryEntry,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "../layout/panelWorkspaceLayoutV2";

function registryEntries(): PanelWorkspaceRegistryEntry[] {
  return PanelRegistry.getAllPanels().map(createPanelWorkspaceRegistryEntry);
}

function currentWorkspaceLayout(): PanelWorkspaceLayoutV2 | null {
  return useStore.getState().panelWorkspaceLayout;
}

const PANEL_RAIL_SIZE = 48;
const BUILDER_HEADER_HEIGHT = 48;

function activationOptions() {
  return {
    railSizes: {
      left: PANEL_RAIL_SIZE,
      right: PANEL_RAIL_SIZE,
      bottom: PANEL_RAIL_SIZE,
    },
    workspaceRect: {
      width: window.innerWidth,
      height: Math.max(0, window.innerHeight - BUILDER_HEADER_HEIGHT),
    },
  };
}

function preferredGeometry(
  layout: PanelWorkspaceLayoutV2,
  panelId: PanelId,
  position?: { x: number; y: number },
): PanelFrameGeometry | null {
  for (const cluster of layout.clusters) {
    for (const column of cluster.columns) {
      const row = column.rows.find(
        (candidate) => candidate.panelId === panelId,
      );
      if (!row) continue;
      const config = PanelRegistry.getPanel(panelId);
      const width = column.width;
      const height = row.height;
      const fallbackPosition =
        cluster.anchor === "floating"
          ? cluster.position
          : {
              x: Math.max(24, (window.innerWidth - width) / 2),
              y: Math.max(24, (window.innerHeight - 48 - height) / 2),
            };
      return {
        x: position?.x ?? fallbackPosition.x,
        y: position?.y ?? fallbackPosition.y,
        width: Math.max(config?.minWidth ?? 200, width),
        height: Math.max(config?.minHeight ?? 160, height),
      };
    }
  }
  return null;
}

export function usePanelLayout(): UsePanelLayoutReturn {
  const workspaceLayout = useStore((state) => state.panelWorkspaceLayout);
  const initializePanelWorkspaceLayout = useStore(
    (state) => state.initializePanelWorkspaceLayout,
  );
  const setPanelWorkspaceLayout = useStore(
    (state) => state.setPanelWorkspaceLayout,
  );

  const commit = useCallback(
    (result: PanelWorkspaceResult<PanelWorkspaceInteractionResult>): boolean =>
      result.ok && setPanelWorkspaceLayout(result.value.layout),
    [setPanelWorkspaceLayout],
  );

  const initializeWorkspaceLayout = useCallback(
    (
      registry: readonly PanelWorkspaceRegistryEntry[],
      surfaceRect: PanelWorkspaceRect,
    ) => initializePanelWorkspaceLayout(registry, surfaceRect),
    [initializePanelWorkspaceLayout],
  );

  const setWorkspaceLayout = useCallback(
    (nextLayout: PanelWorkspaceLayoutV2) => setPanelWorkspaceLayout(nextLayout),
    [setPanelWorkspaceLayout],
  );

  const togglePanel = useCallback(
    (panelId: PanelId) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      if (dispatchPanelWorkspaceActivation(panelId)) return;
      commit(
        activatePanelWorkspacePanel(
          current,
          registryEntries(),
          panelId,
          activationOptions(),
        ),
      );
    },
    [commit],
  );

  const floatPanel = useCallback(
    (panelId: PanelId, position?: { x: number; y: number }) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      const geometry = preferredGeometry(current, panelId, position);
      if (!geometry) return;
      commit(
        detachPanelToFloatingCluster(
          current,
          registryEntries(),
          panelId,
          geometry,
        ),
      );
    },
    [commit],
  );

  const focusFloatingPanel = useCallback(
    (panelId: PanelId) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      const cluster = current.clusters.find((candidate) =>
        candidate.columns.some((column) =>
          column.rows.some((row) => row.panelId === panelId),
        ),
      );
      if (
        cluster?.anchor !== "floating" ||
        current.floatingFocusOrder.at(-1) === cluster.id
      ) {
        return;
      }
      commit(
        focusPanelWorkspaceFloatingCluster(current, registryEntries(), panelId),
      );
    },
    [commit],
  );

  return {
    workspaceLayout,
    initializeWorkspaceLayout,
    setWorkspaceLayout,
    togglePanel,
    floatPanel,
    focusFloatingPanel,
  };
}
