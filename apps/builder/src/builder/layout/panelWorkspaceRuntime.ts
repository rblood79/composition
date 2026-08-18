import type {
  PanelFrameGeometry,
  PanelId,
  PanelResizeEdge,
  PanelSnapEdge,
} from "../panels/core/types";
import {
  createPanelWorkspaceLayoutCoordinator,
  type PanelWorkspaceLayoutCoordinator,
} from "./panelWorkspaceLayoutCoordinator";
import {
  detachPanelToFloatingCluster,
  resizePanelWorkspaceBoundary,
  snapPanelWorkspacePanel,
  type PanelWorkspaceInteractionResult,
} from "./panelWorkspaceLayoutInteraction";
import type {
  PanelWorkspaceLayoutV2,
  PanelWorkspaceRailSizes,
  PanelWorkspaceRect,
  PanelWorkspaceRegistryEntry,
  PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import type { PanelSnapCandidate } from "./panelSnap";
import { resolvePanelSnapFromSnapshot } from "./panelWorkspaceShadowAdapter";

export interface PanelWorkspaceRuntimeMutation {
  expectedVersion: number;
  affectedPanelIds: readonly PanelId[];
}

export interface PanelWorkspaceRuntime {
  coordinator: PanelWorkspaceLayoutCoordinator;
  getLayout(): PanelWorkspaceLayoutV2;
  replaceCommittedLayout(layout: PanelWorkspaceLayoutV2): void;
  beginInteraction(): void;
  endInteraction(): PanelWorkspaceLayoutV2;
  cancelInteraction(): PanelWorkspaceLayoutV2;
  updateWorkspaceRect(workspaceRect: PanelWorkspaceRect): void;
  movePanel(
    panelId: PanelId,
    geometry: PanelFrameGeometry,
  ): PanelWorkspaceResult<PanelWorkspaceRuntimeMutation>;
  snapPanel(
    panelId: PanelId,
    targetPanelId: PanelId,
    edge: PanelSnapEdge,
  ): PanelWorkspaceResult<PanelWorkspaceRuntimeMutation>;
  resizePanel(
    panelId: PanelId,
    edge: PanelResizeEdge,
    deltaX: number,
    deltaY: number,
  ): PanelWorkspaceResult<PanelWorkspaceRuntimeMutation>;
  resolveSnap(
    panelId: PanelId,
    geometry: PanelFrameGeometry,
  ): PanelSnapCandidate | null;
  destroy(): void;
}

export function createPanelWorkspaceRuntime(
  initialLayout: PanelWorkspaceLayoutV2,
  registry: readonly PanelWorkspaceRegistryEntry[],
  workspaceRect: PanelWorkspaceRect,
  railSizes: PanelWorkspaceRailSizes,
): PanelWorkspaceResult<PanelWorkspaceRuntime> {
  let layout = initialLayout;
  let committedLayout = initialLayout;
  let interactionBaseLayout: PanelWorkspaceLayoutV2 | null = null;
  let currentWorkspaceRect = { ...workspaceRect };
  const coordinatorResult = createPanelWorkspaceLayoutCoordinator({
    layout,
    registry,
    workspaceRect: currentWorkspaceRect,
    railSizes,
  });
  if (!coordinatorResult.ok) return coordinatorResult;
  const coordinator = coordinatorResult.value;

  const queueCurrentLayout = (): number => {
    const expectedVersion = coordinator.getSnapshot().version + 1;
    coordinator.queueInput({
      layout,
      registry,
      workspaceRect: currentWorkspaceRect,
      railSizes,
    });
    return expectedVersion;
  };
  const applyInteraction = (
    result: PanelWorkspaceResult<PanelWorkspaceInteractionResult>,
  ): PanelWorkspaceResult<PanelWorkspaceRuntimeMutation> => {
    if (!result.ok) return result;
    layout = result.value.layout;
    return {
      ok: true,
      value: {
        expectedVersion: queueCurrentLayout(),
        affectedPanelIds: result.value.affectedPanelIds.filter(
          (panelId) => layout.visibility[panelId] === true,
        ),
      },
    };
  };

  return {
    ok: true,
    value: {
      coordinator,
      getLayout: () => layout,
      replaceCommittedLayout(nextLayout): void {
        committedLayout = nextLayout;
        if (interactionBaseLayout !== null) return;
        if (JSON.stringify(layout) === JSON.stringify(nextLayout)) {
          layout = nextLayout;
          return;
        }
        layout = nextLayout;
        queueCurrentLayout();
      },
      beginInteraction(): void {
        if (interactionBaseLayout === null) {
          interactionBaseLayout = committedLayout;
        }
      },
      endInteraction(): PanelWorkspaceLayoutV2 {
        committedLayout = layout;
        interactionBaseLayout = null;
        return layout;
      },
      cancelInteraction(): PanelWorkspaceLayoutV2 {
        if (interactionBaseLayout !== null) {
          layout = interactionBaseLayout;
          committedLayout = interactionBaseLayout;
          interactionBaseLayout = null;
          queueCurrentLayout();
        }
        return layout;
      },
      updateWorkspaceRect(nextWorkspaceRect): void {
        if (
          currentWorkspaceRect.width === nextWorkspaceRect.width &&
          currentWorkspaceRect.height === nextWorkspaceRect.height
        ) {
          return;
        }
        currentWorkspaceRect = { ...nextWorkspaceRect };
        queueCurrentLayout();
      },
      movePanel(panelId, geometry) {
        return applyInteraction(
          detachPanelToFloatingCluster(layout, registry, panelId, geometry),
        );
      },
      snapPanel(panelId, targetPanelId, edge) {
        return applyInteraction(
          snapPanelWorkspacePanel(
            layout,
            registry,
            panelId,
            targetPanelId,
            edge,
          ),
        );
      },
      resizePanel(panelId, edge, deltaX, deltaY) {
        return applyInteraction(
          resizePanelWorkspaceBoundary(
            layout,
            registry,
            panelId,
            edge,
            deltaX,
            deltaY,
          ),
        );
      },
      resolveSnap(panelId, geometry) {
        return resolvePanelSnapFromSnapshot(
          coordinator.getSnapshot(),
          panelId,
          geometry,
        );
      },
      destroy(): void {
        coordinator.destroy();
      },
    },
  };
}
