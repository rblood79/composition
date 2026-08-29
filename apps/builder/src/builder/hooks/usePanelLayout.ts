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
import type { PanelWorkspaceLayoutV4 } from "../layout/panelWorkspaceLayoutV4";
import { activatePanelWorkspacePanelV4 } from "../layout/panelWorkspacePolicyV4";

function registryEntries(): PanelWorkspaceRegistryEntry[] {
  return PanelRegistry.getAllPanels().map((config) =>
    createPanelWorkspaceRegistryEntry(config, fallbackSurfaceRect()),
  );
}

function currentWorkspaceLayout(): PanelWorkspaceLayoutV4 | null {
  return useStore.getState().panelWorkspaceLayout;
}

const BUILDER_HEADER_HEIGHT = 48;

function fallbackSurfaceRect(): PanelWorkspaceRect {
  return {
    width: window.innerWidth,
    height: Math.max(1, window.innerHeight - BUILDER_HEADER_HEIGHT),
  };
}

/**
 * 패널 토글 — hook 의 `togglePanel` 과 agent adapter (ADR-196 `AGENT_COMMANDS`) 가
 * 같은 함수를 부른다. 이미 열린 패널이면 activation dispatcher 가 처리하고(단락),
 * 아니면 정책 V4 로 레이아웃을 갱신한다. 순수 함수 형태로 둔 이유: helper 3개가
 * 모듈 private 이라 hook 밖에서는 같은 동작을 재현할 수 없었다 (196 Phase 0 판정).
 */
export function togglePanelWorkspace(panelId: PanelId): void {
  const current = currentWorkspaceLayout();
  if (!current) return;
  if (dispatchPanelWorkspaceActivation(panelId)) return;
  const activated = activatePanelWorkspacePanelV4(
    current,
    registryEntries(),
    panelId,
    fallbackSurfaceRect(),
  );
  if (activated.ok)
    useStore.getState().setPanelWorkspaceLayout(activated.value.layout);
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
    (nextLayout: PanelWorkspaceLayoutV4) => setPanelWorkspaceLayout(nextLayout),
    [setPanelWorkspaceLayout],
  );

  const togglePanel = useCallback(
    (panelId: PanelId) => togglePanelWorkspace(panelId),
    [],
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
