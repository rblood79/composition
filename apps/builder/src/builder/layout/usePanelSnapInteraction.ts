import { useContext } from "react";
import {
  PanelSnapInteractionActionsContext,
  PanelSnapInteractionStateContext,
} from "./panelSnapInteractionContext";
import type {
  PanelSnapInteractionActions,
  PanelSnapInteractionState,
} from "./panelSnapInteractionContext";

export function usePanelSnapInteractionActions(): PanelSnapInteractionActions {
  const value = useContext(PanelSnapInteractionActionsContext);
  if (!value) {
    throw new Error(
      "usePanelSnapInteractionActions must be used within PanelSnapInteractionProvider",
    );
  }
  return value;
}

export function usePanelSnapInteractionState(): PanelSnapInteractionState {
  const value = useContext(PanelSnapInteractionStateContext);
  if (!value) {
    throw new Error(
      "usePanelSnapInteractionState must be used within PanelSnapInteractionProvider",
    );
  }
  return value;
}
