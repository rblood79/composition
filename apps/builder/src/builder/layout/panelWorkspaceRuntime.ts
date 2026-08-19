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
  dropPanelWorkspacePanel,
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
import type { PanelDockDropTarget } from "./panelWorkspaceDockDrop";
import { projectPanelWorkspaceLayoutV3ToV2 } from "./panelWorkspaceLayoutV3Rollback";
import { migratePanelWorkspaceLayoutV2ToV3 } from "./panelWorkspaceLayoutV3Migration";
import {
  beginPanelWorkspaceDragSession,
  commitPanelWorkspaceDragSession,
  updatePanelWorkspaceDragSession,
  type PanelDropCandidate,
  type PanelWorkspaceDragSession,
  type PanelWorkspacePointerPosition,
} from "./panelWorkspaceZoneDrop";
import { resolvePanelSnapFromSnapshot } from "./panelWorkspaceShadowAdapter";

export interface PanelWorkspaceRuntimeMutation {
  expectedVersion: number;
  affectedPanelIds: readonly PanelId[];
}

export interface PanelWorkspaceRuntimeDragMutation extends PanelWorkspaceRuntimeMutation {
  candidate: PanelDropCandidate;
}

export interface PanelWorkspaceRuntimeDragEnd {
  layout: PanelWorkspaceLayoutV2;
  committed: boolean;
  candidate: PanelDropCandidate;
  expectedVersion: number;
  affectedPanelIds: readonly PanelId[];
}

export interface PanelWorkspaceRuntime {
  coordinator: PanelWorkspaceLayoutCoordinator;
  getLayout(): PanelWorkspaceLayoutV2;
  getDragSession(): PanelWorkspaceDragSession | null;
  replaceCommittedLayout(layout: PanelWorkspaceLayoutV2): void;
  beginDrag(panelId: PanelId): PanelWorkspaceResult<PanelWorkspaceDragSession>;
  updateDrag(
    panelId: PanelId,
    geometry: PanelFrameGeometry,
    pointer: PanelWorkspacePointerPosition,
  ): PanelWorkspaceResult<PanelWorkspaceRuntimeDragMutation>;
  suppressDragCandidate(): void;
  endDrag(panelId: PanelId): PanelWorkspaceResult<PanelWorkspaceRuntimeDragEnd>;
  cancelDrag(): PanelWorkspaceRuntimeDragEnd;
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
  dropPanel(
    panelId: PanelId,
    target: PanelDockDropTarget,
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
  let dragSession: PanelWorkspaceDragSession | null = null;
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
      getDragSession: () => dragSession,
      replaceCommittedLayout(nextLayout): void {
        const floatingLayout = floatAnchoredClusters(nextLayout);
        if (!floatingLayout.ok) return;
        committedLayout = floatingLayout.value;
        if (interactionBaseLayout !== null || dragSession !== null) return;
        if (JSON.stringify(layout) === JSON.stringify(floatingLayout.value)) {
          layout = floatingLayout.value;
          return;
        }
        layout = floatingLayout.value;
        queueCurrentLayout();
      },
      beginDrag(panelId) {
        if (dragSession !== null) {
          return { ok: false, error: "A panel drag session is already active" };
        }
        const migrated = migratePanelWorkspaceLayoutV2ToV3(
          committedLayout,
          registry,
          {
            surfaceRect: currentWorkspaceRect,
            migrationId: `phase-3-drag:${panelId}`,
          },
        );
        if (!migrated.ok) return migrated;
        const session = beginPanelWorkspaceDragSession(
          migrated.value,
          registry,
          currentWorkspaceRect,
          panelId,
        );
        if (!session.ok) return session;
        dragSession = session.value;
        return session;
      },
      updateDrag(panelId, geometry, pointer) {
        if (dragSession === null || dragSession.panelId !== panelId) {
          return { ok: false, error: `Panel "${panelId}" has no drag session` };
        }
        const updated = updatePanelWorkspaceDragSession(
          dragSession,
          registry,
          currentWorkspaceRect,
          geometry,
          pointer,
        );
        if (!updated.ok) return updated;
        dragSession = updated.value;
        const expectedVersion = coordinator.getSnapshot().version + 1;
        coordinator.queuePreview(panelId, geometry);
        return {
          ok: true,
          value: {
            expectedVersion,
            affectedPanelIds: [panelId],
            candidate: dragSession.candidate,
          },
        };
      },
      suppressDragCandidate(): void {
        if (dragSession === null) return;
        dragSession = { ...dragSession, candidate: null };
      },
      endDrag(panelId) {
        if (dragSession === null || dragSession.panelId !== panelId) {
          return { ok: false, error: `Panel "${panelId}" has no drag session` };
        }
        const session = dragSession;
        dragSession = null;
        const committed = commitPanelWorkspaceDragSession(
          session,
          registry,
          currentWorkspaceRect,
        );
        if (!committed.ok) {
          coordinator.clearPreview();
          return committed;
        }
        const expectedVersion = coordinator.getSnapshot().version + 1;
        if (!committed.value.committed) {
          coordinator.clearPreview();
          return {
            ok: true,
            value: {
              layout: committedLayout,
              committed: false,
              candidate: null,
              expectedVersion,
              affectedPanelIds: [],
            },
          };
        }
        const projected = projectPanelWorkspaceLayoutV3ToV2(
          committed.value.layout,
          registry,
          currentWorkspaceRect,
        );
        if (!projected.ok) {
          coordinator.clearPreview();
          return projected;
        }
        layout = projected.value;
        committedLayout = projected.value;
        queueCurrentLayout();
        coordinator.clearPreview();
        return {
          ok: true,
          value: {
            layout,
            committed: true,
            candidate: committed.value.candidate,
            expectedVersion,
            affectedPanelIds: committed.value.affectedPanelIds.filter(
              (affectedPanelId) => layout.visibility[affectedPanelId] === true,
            ),
          },
        };
      },
      cancelDrag() {
        dragSession = null;
        const expectedVersion = coordinator.getSnapshot().version + 1;
        coordinator.clearPreview();
        return {
          layout: committedLayout,
          committed: false,
          candidate: null,
          expectedVersion,
          affectedPanelIds: [],
        };
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
      dropPanel(panelId, target) {
        return applyInteraction(
          dropPanelWorkspacePanel(layout, registry, panelId, target),
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
            {
              maxHeight: currentWorkspaceRect.height,
              workspaceRect: currentWorkspaceRect,
            },
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
            {
              maxHeight: currentWorkspaceRect.height,
              workspaceRect: currentWorkspaceRect,
            },
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
        dragSession = null;
        coordinator.destroy();
      },
    },
  };
}
