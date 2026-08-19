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
import { floatAnchoredPanelWorkspaceClusters } from "./panelWorkspaceLayoutV2";
import {
  activatePanelWorkspacePanel,
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
  activatePanel(
    panelId: PanelId,
  ): PanelWorkspaceResult<PanelWorkspaceRuntimeMutation>;
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
  resizePanelFromReference(
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
  let currentWorkspaceRect = { ...workspaceRect };
  const floatAnchoredClusters = (
    nextLayout: PanelWorkspaceLayoutV2,
  ): PanelWorkspaceResult<PanelWorkspaceLayoutV2> =>
    floatAnchoredPanelWorkspaceClusters(nextLayout, registry, {
      workspaceRect: currentWorkspaceRect,
      railSizes,
    });
  const initialFloatingLayout = floatAnchoredClusters(initialLayout);
  if (!initialFloatingLayout.ok) return initialFloatingLayout;
  let layout = initialFloatingLayout.value;
  let committedLayout = initialFloatingLayout.value;
  let interactionBaseLayout: PanelWorkspaceLayoutV2 | null = null;
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
        const floatingLayout = floatAnchoredClusters(nextLayout);
        if (!floatingLayout.ok) return;
        committedLayout = floatingLayout.value;
        if (interactionBaseLayout !== null) return;
        if (JSON.stringify(layout) === JSON.stringify(floatingLayout.value)) {
          layout = floatingLayout.value;
          return;
        }
        layout = floatingLayout.value;
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
      activatePanel(panelId) {
        return applyInteraction(
          activatePanelWorkspacePanel(layout, registry, panelId, {
            railSizes,
            workspaceRect: currentWorkspaceRect,
          }),
        );
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
            { maxHeight: currentWorkspaceRect.height },
          ),
        );
      },
      resizePanelFromReference(panelId, edge, deltaX, deltaY) {
        return applyInteraction(
          resizePanelWorkspaceBoundary(
            interactionBaseLayout ?? layout,
            registry,
            panelId,
            edge,
            deltaX,
            deltaY,
            { maxHeight: currentWorkspaceRect.height },
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
