import type {
  PanelFrameGeometry,
  PanelId,
  PanelResizeEdge,
} from "../panels/core/types";
import {
  createPanelWorkspaceLayoutCoordinator,
  type PanelWorkspaceLayoutCoordinator,
} from "./panelWorkspaceLayoutCoordinator";
import type {
  PanelWorkspaceRect,
  PanelWorkspaceRegistryEntry,
  PanelWorkspaceResult,
} from "./panelWorkspaceLayoutV2";
import {
  normalizePanelWorkspaceLayoutV3,
  type PanelWorkspaceLayoutV3,
} from "./panelWorkspaceLayoutV3";
import {
  activatePanelWorkspacePanelV3,
  resetPanelWorkspaceLayoutV3,
  resizePanelWorkspaceBoundaryV3,
  type PanelWorkspacePolicyResultV3,
} from "./panelWorkspacePolicyV3";
import {
  beginPanelWorkspaceDragSession,
  commitPanelWorkspaceDragSession,
  updatePanelWorkspaceDragSession,
  type PanelDropCandidate,
  type PanelWorkspaceDragSession,
  type PanelWorkspacePointerPosition,
} from "./panelWorkspaceZoneDrop";

export interface PanelWorkspaceRuntimeMutation {
  expectedVersion: number;
  affectedPanelIds: readonly PanelId[];
}

export interface PanelWorkspaceRuntimeDragMutation extends PanelWorkspaceRuntimeMutation {
  candidate: PanelDropCandidate;
}

export interface PanelWorkspaceRuntimeDragEnd {
  layout: PanelWorkspaceLayoutV3;
  committed: boolean;
  candidate: PanelDropCandidate;
  expectedVersion: number;
  affectedPanelIds: readonly PanelId[];
}

export interface PanelWorkspaceRuntime {
  coordinator: PanelWorkspaceLayoutCoordinator;
  getLayout(): PanelWorkspaceLayoutV3;
  getDragSession(): PanelWorkspaceDragSession | null;
  replaceCommittedLayout(layout: PanelWorkspaceLayoutV3): void;
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
  endInteraction(): PanelWorkspaceLayoutV3;
  cancelInteraction(): PanelWorkspaceLayoutV3;
  updateWorkspaceRect(workspaceRect: PanelWorkspaceRect): void;
  activatePanel(
    panelId: PanelId,
  ): PanelWorkspaceResult<PanelWorkspaceRuntimeMutation>;
  resetLayout(): PanelWorkspaceResult<PanelWorkspaceRuntimeMutation>;
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
  destroy(): void;
}

export function createPanelWorkspaceRuntime(
  initialLayout: PanelWorkspaceLayoutV3,
  registry: readonly PanelWorkspaceRegistryEntry[],
  workspaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceRuntime> {
  let currentWorkspaceRect = { ...workspaceRect };
  const initial = normalizePanelWorkspaceLayoutV3(
    initialLayout,
    registry,
    currentWorkspaceRect,
  );
  if (!initial.ok) return initial;
  let layout = initial.value;
  let committedLayout = initial.value;
  let interactionBaseLayout: PanelWorkspaceLayoutV3 | null = null;
  let dragSession: PanelWorkspaceDragSession | null = null;
  const coordinatorResult = createPanelWorkspaceLayoutCoordinator({
    layout,
    registry,
    workspaceRect: currentWorkspaceRect,
  });
  if (!coordinatorResult.ok) return coordinatorResult;
  const coordinator = coordinatorResult.value;

  const queueCurrentLayout = (): number => {
    const expectedVersion = coordinator.getSnapshot().version + 1;
    coordinator.queueInput({
      layout,
      registry,
      workspaceRect: currentWorkspaceRect,
    });
    return expectedVersion;
  };

  const applyPolicyInteraction = (
    result: PanelWorkspaceResult<PanelWorkspacePolicyResultV3>,
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
        const normalized = normalizePanelWorkspaceLayoutV3(
          nextLayout,
          registry,
          currentWorkspaceRect,
        );
        if (!normalized.ok) return;
        committedLayout = normalized.value;
        if (interactionBaseLayout !== null || dragSession !== null) return;
        if (JSON.stringify(layout) === JSON.stringify(normalized.value)) {
          layout = normalized.value;
          return;
        }
        layout = normalized.value;
        queueCurrentLayout();
      },
      beginDrag(panelId) {
        if (dragSession !== null) {
          return { ok: false, error: "A panel drag session is already active" };
        }
        const session = beginPanelWorkspaceDragSession(
          committedLayout,
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
        layout = committed.value.layout;
        committedLayout = committed.value.layout;
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
      endInteraction(): PanelWorkspaceLayoutV3 {
        committedLayout = layout;
        interactionBaseLayout = null;
        return layout;
      },
      cancelInteraction(): PanelWorkspaceLayoutV3 {
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
        const normalized = normalizePanelWorkspaceLayoutV3(
          layout,
          registry,
          currentWorkspaceRect,
        );
        if (normalized.ok) {
          layout = normalized.value;
          if (interactionBaseLayout === null && dragSession === null) {
            committedLayout = normalized.value;
          }
        }
        queueCurrentLayout();
      },
      activatePanel(panelId) {
        return applyPolicyInteraction(
          activatePanelWorkspacePanelV3(
            layout,
            registry,
            panelId,
            currentWorkspaceRect,
          ),
        );
      },
      resetLayout() {
        return applyPolicyInteraction(
          resetPanelWorkspaceLayoutV3(layout, registry, currentWorkspaceRect),
        );
      },
      resizePanel(panelId, edge, deltaX, deltaY) {
        return applyPolicyInteraction(
          resizePanelWorkspaceBoundaryV3(
            layout,
            registry,
            panelId,
            edge,
            deltaX,
            deltaY,
            currentWorkspaceRect,
          ),
        );
      },
      resizePanelFromReference(panelId, edge, deltaX, deltaY) {
        return applyPolicyInteraction(
          resizePanelWorkspaceBoundaryV3(
            interactionBaseLayout ?? layout,
            registry,
            panelId,
            edge,
            deltaX,
            deltaY,
            currentWorkspaceRect,
          ),
        );
      },
      destroy(): void {
        dragSession = null;
        coordinator.destroy();
      },
    },
  };
}
