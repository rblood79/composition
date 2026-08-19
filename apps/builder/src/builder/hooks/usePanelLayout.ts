import { useCallback } from "react";
import { useStore } from "../stores";
import type { PanelId } from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import type { UsePanelLayoutReturn } from "../layout/types";
import { dispatchPanelWorkspaceActivation } from "../layout/panelWorkspaceActivationDispatcher";
import {
  createPanelWorkspaceRegistryEntry,
  type PanelWorkspaceRect,
  type PanelWorkspaceRegistryEntry,
} from "../layout/panelWorkspaceLayoutV2";
import type { PanelWorkspaceLayoutV3 } from "../layout/panelWorkspaceLayoutV3";
import { activatePanelWorkspacePanelV3 } from "../layout/panelWorkspacePolicyV3";

function registryEntries(): PanelWorkspaceRegistryEntry[] {
  return PanelRegistry.getAllPanels().map(createPanelWorkspaceRegistryEntry);
}

function currentWorkspaceLayout(): PanelWorkspaceLayoutV3 | null {
  return useStore.getState().panelWorkspaceLayout;
}

const BUILDER_HEADER_HEIGHT = 48;

function fallbackSurfaceRect(): PanelWorkspaceRect {
  return {
    width: window.innerWidth,
    height: Math.max(1, window.innerHeight - BUILDER_HEADER_HEIGHT),
  };
}

export function usePanelLayout(): UsePanelLayoutReturn {
  const workspaceLayout = useStore((state) => state.panelWorkspaceLayout);
  const initializePanelWorkspaceLayout = useStore(
    (state) => state.initializePanelWorkspaceLayout,
  );
  const setPanelWorkspaceLayout = useStore(
    (state) => state.setPanelWorkspaceLayout,
  );
  const resetPanelWorkspaceLayout = useStore(
    (state) => state.resetPanelWorkspaceLayout,
  );

  const initializeWorkspaceLayout = useCallback(
    (
      registry: readonly PanelWorkspaceRegistryEntry[],
      surfaceRect: PanelWorkspaceRect,
    ) => initializePanelWorkspaceLayout(registry, surfaceRect),
    [initializePanelWorkspaceLayout],
  );

  const setWorkspaceLayout = useCallback(
    (nextLayout: PanelWorkspaceLayoutV3) => setPanelWorkspaceLayout(nextLayout),
    [setPanelWorkspaceLayout],
  );

  const togglePanel = useCallback(
    (panelId: PanelId) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      if (dispatchPanelWorkspaceActivation(panelId)) return;
      const activated = activatePanelWorkspacePanelV3(
        current,
        registryEntries(),
        panelId,
        fallbackSurfaceRect(),
      );
      if (activated.ok) setPanelWorkspaceLayout(activated.value.layout);
    },
    [setPanelWorkspaceLayout],
  );

  const focusPanel = useCallback(
    (panelId: PanelId) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      const cluster = current.clusters.find((candidate) =>
        candidate.columns.some((column) =>
          column.rows.some((row) => row.panelId === panelId),
        ),
      );
      if (!cluster || current.clusterFocusOrder.at(-1) === cluster.id) return;
      setPanelWorkspaceLayout({
        ...current,
        clusterFocusOrder: [
          ...current.clusterFocusOrder.filter((id) => id !== cluster.id),
          cluster.id,
        ],
      });
    },
    [setPanelWorkspaceLayout],
  );

  const resetWorkspaceLayout = useCallback(
    () => resetPanelWorkspaceLayout(),
    [resetPanelWorkspaceLayout],
  );

  return {
    workspaceLayout,
    initializeWorkspaceLayout,
    setWorkspaceLayout,
    togglePanel,
    focusPanel,
    resetWorkspaceLayout,
  };
}
