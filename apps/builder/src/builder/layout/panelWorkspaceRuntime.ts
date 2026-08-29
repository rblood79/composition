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
  normalizePanelWorkspaceLayoutV4,
  type PanelWorkspaceLayoutV4,
} from "./panelWorkspaceLayoutV4";
import {
  activatePanelWorkspacePanelV4,
  resetPanelWorkspaceLayoutV4,
  resizePanelWorkspaceBoundaryV4,
  type PanelWorkspacePolicyResultV4,
} from "./panelWorkspacePolicyV4";
import {
  beginPanelWorkspaceDragSession,
  commitPanelWorkspaceDragSession,
  updatePanelWorkspaceDragSession,
  type PanelDropCandidate,
  type PanelWorkspaceDragSession,
  type PanelWorkspacePointerPosition,
} from "./panelWorkspaceZoneDrop";

export interface PanelWorkspaceRuntimeDragMutation {
  candidate: PanelDropCandidate;
}

export interface PanelWorkspaceRuntimeDragEnd {
  layout: PanelWorkspaceLayoutV4;
  committed: boolean;
  candidate: PanelDropCandidate;
}

export interface PanelWorkspaceRuntime {
  coordinator: PanelWorkspaceLayoutCoordinator;
  getLayout(): PanelWorkspaceLayoutV4;
  getRegistry(): readonly PanelWorkspaceRegistryEntry[];
  getDragSession(): PanelWorkspaceDragSession | null;
  replaceCommittedLayout(layout: PanelWorkspaceLayoutV4): void;
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
  endInteraction(): PanelWorkspaceLayoutV4;
  cancelInteraction(): PanelWorkspaceLayoutV4;
  updateWorkspaceRect(workspaceRect: PanelWorkspaceRect): void;
  updateRegistry(registry: readonly PanelWorkspaceRegistryEntry[]): void;
  activatePanel(panelId: PanelId): PanelWorkspaceResult<void>;
  resetLayout(): PanelWorkspaceResult<void>;
  resizePanel(
    panelId: PanelId,
    edge: PanelResizeEdge,
    deltaX: number,
    deltaY: number,
  ): PanelWorkspaceResult<void>;
  resizePanelFromReference(
    panelId: PanelId,
    edge: PanelResizeEdge,
    deltaX: number,
    deltaY: number,
  ): PanelWorkspaceResult<void>;
  destroy(): void;
}

export function createPanelWorkspaceRuntime(
  initialLayout: PanelWorkspaceLayoutV4,
  registry: readonly PanelWorkspaceRegistryEntry[],
  workspaceRect: PanelWorkspaceRect,
): PanelWorkspaceResult<PanelWorkspaceRuntime> {
  let currentRegistry = [...registry];
  let currentWorkspaceRect = { ...workspaceRect };
  const initial = normalizePanelWorkspaceLayoutV4(
    initialLayout,
    currentRegistry,
    currentWorkspaceRect,
  );
  if (!initial.ok) return initial;
  let layout = initial.value;
  let committedLayout = initial.value;
  let interactionBaseLayout: PanelWorkspaceLayoutV4 | null = null;
  let dragSession: PanelWorkspaceDragSession | null = null;
  const coordinatorResult = createPanelWorkspaceLayoutCoordinator({
    layout,
    registry: currentRegistry,
    workspaceRect: currentWorkspaceRect,
  });
  if (!coordinatorResult.ok) return coordinatorResult;
  const coordinator = coordinatorResult.value;

  const queueCurrentLayout = (): void => {
    coordinator.queueInput({
      layout,
      registry: currentRegistry,
      workspaceRect: currentWorkspaceRect,
    });
  };

  const applyPolicyInteraction = (
    result: PanelWorkspaceResult<PanelWorkspacePolicyResultV4>,
  ): PanelWorkspaceResult<void> => {
    if (!result.ok) return result;
    layout = result.value.layout;
    queueCurrentLayout();
    return { ok: true, value: undefined };
  };

  return {
    ok: true,
    value: {
      coordinator,
      getLayout: () => layout,
      getRegistry: () => currentRegistry,
      getDragSession: () => dragSession,
      replaceCommittedLayout(nextLayout): void {
        const normalized = normalizePanelWorkspaceLayoutV4(
          nextLayout,
          currentRegistry,
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
          currentRegistry,
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
          currentRegistry,
          currentWorkspaceRect,
          geometry,
          pointer,
        );
        if (!updated.ok) return updated;
        dragSession = updated.value;
        coordinator.queuePreview(panelId, geometry);
        return {
          ok: true,
          value: { candidate: dragSession.candidate },
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
          currentRegistry,
          currentWorkspaceRect,
        );
        if (!committed.ok) {
          coordinator.clearPreview();
          return committed;
        }
        if (!committed.value.committed) {
          coordinator.clearPreview();
          return {
            ok: true,
            value: {
              layout: committedLayout,
              committed: false,
              candidate: null,
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
          },
        };
      },
      cancelDrag() {
        dragSession = null;
        coordinator.clearPreview();
        return {
          layout: committedLayout,
          committed: false,
          candidate: null,
        };
      },
      beginInteraction(): void {
        if (interactionBaseLayout === null) {
          interactionBaseLayout = committedLayout;
        }
      },
      endInteraction(): PanelWorkspaceLayoutV4 {
        committedLayout = layout;
        interactionBaseLayout = null;
        return layout;
      },
      cancelInteraction(): PanelWorkspaceLayoutV4 {
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
        const normalized = normalizePanelWorkspaceLayoutV4(
          layout,
          currentRegistry,
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
      updateRegistry(nextRegistry): void {
        if (currentRegistry === nextRegistry) return;
        currentRegistry = [...nextRegistry];
        const normalized = normalizePanelWorkspaceLayoutV4(
          layout,
          currentRegistry,
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
          activatePanelWorkspacePanelV4(
            layout,
            currentRegistry,
            panelId,
            currentWorkspaceRect,
          ),
        );
      },
      resetLayout() {
        return applyPolicyInteraction(
          resetPanelWorkspaceLayoutV4(
            layout,
            currentRegistry,
            currentWorkspaceRect,
          ),
        );
      },
      resizePanel(panelId, edge, deltaX, deltaY) {
        return applyPolicyInteraction(
          resizePanelWorkspaceBoundaryV4(
            layout,
            currentRegistry,
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
          resizePanelWorkspaceBoundaryV4(
            interactionBaseLayout ?? layout,
            currentRegistry,
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
