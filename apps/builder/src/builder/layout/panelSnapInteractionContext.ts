import { createContext } from "react";
import type { PanelId } from "../panels/core/types";
import type { PanelDropCandidate } from "./panelWorkspaceZoneDrop";

export interface PanelSnapInteractionActions {
  beginPanelDrag: (panelId: PanelId) => void;
  updatePanelDropCandidate: (candidate: PanelDropCandidate) => void;
  endPanelDrag: () => void;
}

export interface PanelSnapInteractionState {
  draggedPanelId: PanelId | null;
  dropCandidate: PanelDropCandidate;
}

export const PanelSnapInteractionActionsContext =
  createContext<PanelSnapInteractionActions | null>(null);
export const PanelSnapInteractionStateContext =
  createContext<PanelSnapInteractionState | null>(null);
