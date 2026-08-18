import type { PanelId } from "../panels/core/types";

type PanelWorkspaceActivationDispatcher = (panelId: PanelId) => boolean;

let activeDispatcher: PanelWorkspaceActivationDispatcher | null = null;

export function dispatchPanelWorkspaceActivation(panelId: PanelId): boolean {
  return activeDispatcher?.(panelId) ?? false;
}

export function registerPanelWorkspaceActivationDispatcher(
  dispatcher: PanelWorkspaceActivationDispatcher,
): () => void {
  activeDispatcher = dispatcher;
  return () => {
    if (activeDispatcher === dispatcher) activeDispatcher = null;
  };
}
