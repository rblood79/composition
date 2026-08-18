import { useCallback } from "react";
import { useStore } from "../stores";
import type {
  PanelFrameGeometry,
  PanelId,
  PanelLayoutState,
  PanelSide,
  PanelSize,
  PanelSnapPlacement,
} from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import type { UsePanelLayoutReturn } from "../layout/types";
import {
  detachPanelToFloatingCluster,
  focusPanelWorkspaceFloatingCluster,
  hidePanelWorkspaceFloatingClusters,
  movePanelWorkspacePanelToAnchor,
  setPanelWorkspacePanelVisibility,
  snapPanelWorkspacePanel,
  updatePanelWorkspacePanelSize,
  type PanelWorkspaceInteractionResult,
} from "../layout/panelWorkspaceLayoutInteraction";
import {
  createPanelWorkspaceRegistryEntry,
  type PanelWorkspaceLayoutV2,
  type PanelWorkspaceRegistryEntry,
  type PanelWorkspaceResult,
} from "../layout/panelWorkspaceLayoutV2";

function registryEntries(): PanelWorkspaceRegistryEntry[] {
  return PanelRegistry.getAllPanels().map(createPanelWorkspaceRegistryEntry);
}

function currentWorkspaceLayout(): PanelWorkspaceLayoutV2 | null {
  return useStore.getState().panelWorkspaceLayout;
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
  const layout = useStore((state) => state.panelLayout);
  const workspaceLayout = useStore((state) => state.panelWorkspaceLayout);
  const initializePanelWorkspaceLayout = useStore(
    (state) => state.initializePanelWorkspaceLayout,
  );
  const setPanelWorkspaceLayout = useStore(
    (state) => state.setPanelWorkspaceLayout,
  );
  const setPanelLayout = useStore((state) => state.setPanelLayout);

  const commit = useCallback(
    (result: PanelWorkspaceResult<PanelWorkspaceInteractionResult>): boolean =>
      result.ok && setPanelWorkspaceLayout(result.value.layout),
    [setPanelWorkspaceLayout],
  );

  const initializeWorkspaceLayout = useCallback(
    (registry: readonly PanelWorkspaceRegistryEntry[]) =>
      initializePanelWorkspaceLayout(registry),
    [initializePanelWorkspaceLayout],
  );

  const setWorkspaceLayout = useCallback(
    (nextLayout: PanelWorkspaceLayoutV2) => setPanelWorkspaceLayout(nextLayout),
    [setPanelWorkspaceLayout],
  );

  const movePanel = useCallback(
    (panelId: PanelId, from: PanelSide, to: PanelSide) => {
      if (from === to) return;
      const current = currentWorkspaceLayout();
      if (!current || !current.railOrder[from].includes(panelId)) return;
      commit(
        movePanelWorkspacePanelToAnchor(
          current,
          registryEntries(),
          panelId,
          to,
        ),
      );
    },
    [commit],
  );

  const dockPanel = useCallback(
    (panelId: PanelId, side: PanelSide) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      commit(
        movePanelWorkspacePanelToAnchor(
          current,
          registryEntries(),
          panelId,
          side,
        ),
      );
    },
    [commit],
  );

  const togglePanel = useCallback(
    (_side: PanelSide, panelId: PanelId) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      commit(
        setPanelWorkspacePanelVisibility(
          current,
          registryEntries(),
          panelId,
          current.visibility[panelId] !== true,
        ),
      );
    },
    [commit],
  );

  const resetLayout = useCallback(() => {
    useStore.getState().resetPanelLayout();
  }, []);

  const setLayout = useCallback(
    (nextLayout: PanelLayoutState) => setPanelLayout(nextLayout),
    [setPanelLayout],
  );

  const toggleBottomPanel = useCallback(
    (panelId: PanelId) => togglePanel("bottom", panelId),
    [togglePanel],
  );

  const updatePanelSize = useCallback(
    (panelId: PanelId, size: PanelSize) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      commit(
        updatePanelWorkspacePanelSize(
          current,
          registryEntries(),
          panelId,
          size,
        ),
      );
    },
    [commit],
  );

  const setBottomHeight = useCallback(
    (height: number) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      const panelId =
        current.railOrder.bottom.find(
          (candidate) => current.visibility[candidate] === true,
        ) ?? current.railOrder.bottom[0];
      if (!panelId) return;
      const geometry = preferredGeometry(current, panelId);
      if (!geometry) return;
      updatePanelSize(panelId, { width: geometry.width, height });
    },
    [updatePanelSize],
  );

  const closeBottomPanel = useCallback(() => {
    const current = currentWorkspaceLayout();
    if (!current) return;
    let next = current;
    for (const panelId of current.railOrder.bottom) {
      const result = setPanelWorkspacePanelVisibility(
        next,
        registryEntries(),
        panelId,
        false,
      );
      if (result.ok) next = result.value.layout;
    }
    setPanelWorkspaceLayout(next);
  }, [setPanelWorkspaceLayout]);

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

  const placePanel = useCallback(
    (panelId: PanelId, position: { x: number; y: number }) =>
      floatPanel(panelId, position),
    [floatPanel],
  );

  const snapPanel = useCallback(
    (panelId: PanelId, placement: PanelSnapPlacement) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      commit(
        snapPanelWorkspacePanel(
          current,
          registryEntries(),
          panelId,
          placement.targetPanelId,
          placement.edge,
        ),
      );
    },
    [commit],
  );

  const hidePanel = useCallback(
    (panelId: PanelId) => {
      const current = currentWorkspaceLayout();
      if (!current) return;
      commit(
        setPanelWorkspacePanelVisibility(
          current,
          registryEntries(),
          panelId,
          false,
        ),
      );
    },
    [commit],
  );

  const focusModalPanel = useCallback(
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

  const updateModalPanelPosition = useCallback(
    (panelId: PanelId, position: { x: number; y: number }) =>
      floatPanel(panelId, position),
    [floatPanel],
  );

  const closeAllModalPanels = useCallback(() => {
    const current = currentWorkspaceLayout();
    if (!current) return;
    commit(hidePanelWorkspaceFloatingClusters(current, registryEntries()));
  }, [commit]);

  return {
    layout,
    workspaceLayout,
    isLoading: workspaceLayout === null,
    isLoaded: workspaceLayout !== null,
    initializeWorkspaceLayout,
    setWorkspaceLayout,
    movePanel,
    dockPanel,
    floatPanel,
    placePanel,
    snapPanel,
    fitPanelClusters: () => undefined,
    hidePanel,
    updatePanelSize,
    togglePanel,
    resetLayout,
    setLayout,
    toggleBottomPanel,
    setBottomHeight,
    closeBottomPanel,
    openPanelAsModal: floatPanel,
    closeModalPanel: hidePanel,
    focusModalPanel,
    updateModalPanelPosition,
    updateModalPanelSize: updatePanelSize,
    closeAllModalPanels,
  };
}
