import { useSyncExternalStore } from "react";
import type { PanelId } from "../panels/core/types";
import type {
  PanelWorkspaceFrameSnapshot,
  PanelWorkspaceLayoutCoordinator,
  PanelWorkspaceLayoutSnapshot,
} from "./panelWorkspaceLayoutCoordinator";

export function usePanelWorkspaceLayoutSnapshot(
  coordinator: PanelWorkspaceLayoutCoordinator,
): PanelWorkspaceLayoutSnapshot {
  return useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
}

export function usePanelWorkspaceFrameSnapshot(
  coordinator: PanelWorkspaceLayoutCoordinator,
  panelId: PanelId,
): PanelWorkspaceFrameSnapshot | null {
  return useSyncExternalStore(
    coordinator.subscribe,
    () => coordinator.getSnapshot().frameGeometries.get(panelId) ?? null,
    () => coordinator.getSnapshot().frameGeometries.get(panelId) ?? null,
  );
}
