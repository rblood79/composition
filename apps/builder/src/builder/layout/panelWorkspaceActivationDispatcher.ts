import type { PanelId } from "../panels/core/types";

/**
 * `visible` 가 없으면 토글 (rail 버튼 어법), 있으면 그 상태를 **보장** — 이미 같은 상태면
 * 아무것도 하지 않는다 (ADR-212 UI-8: 편집 패널 생명주기가 layout store 를 직접 만지지 않고
 * 이 한 경로를 지난다).
 */
type PanelWorkspaceActivationDispatcher = (
  panelId: PanelId,
  visible?: boolean,
) => boolean;

let activeDispatcher: PanelWorkspaceActivationDispatcher | null = null;

export function dispatchPanelWorkspaceActivation(
  panelId: PanelId,
  visible?: boolean,
): boolean {
  return activeDispatcher?.(panelId, visible) ?? false;
}

export function registerPanelWorkspaceActivationDispatcher(
  dispatcher: PanelWorkspaceActivationDispatcher,
): () => void {
  activeDispatcher = dispatcher;
  return () => {
    if (activeDispatcher === dispatcher) activeDispatcher = null;
  };
}
