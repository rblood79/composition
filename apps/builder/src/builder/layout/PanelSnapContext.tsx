import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PanelId } from "../panels/core/types";
import type { PanelDropCandidate } from "./panelWorkspaceZoneDrop";

interface PanelSnapInteractionActions {
  beginPanelDrag: (panelId: PanelId) => void;
  updatePanelDropCandidate: (candidate: PanelDropCandidate) => void;
  endPanelDrag: () => void;
}

interface PanelSnapInteractionState {
  draggedPanelId: PanelId | null;
  dropCandidate: PanelDropCandidate;
}

const PanelSnapInteractionActionsContext =
  createContext<PanelSnapInteractionActions | null>(null);
const PanelSnapInteractionStateContext =
  createContext<PanelSnapInteractionState | null>(null);

export function PanelSnapInteractionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [draggedPanelId, setDraggedPanelId] = useState<PanelId | null>(null);
  const [dropCandidate, setDropCandidate] = useState<PanelDropCandidate>(null);
  const beginPanelDrag = useCallback((panelId: PanelId) => {
    setDraggedPanelId(panelId);
    setDropCandidate(null);
  }, []);
  const updatePanelDropCandidate = useCallback(
    (candidate: PanelDropCandidate) => setDropCandidate(candidate),
    [],
  );
  const endPanelDrag = useCallback(() => {
    setDraggedPanelId(null);
    setDropCandidate(null);
  }, []);
  const actions = useMemo(
    () => ({
      beginPanelDrag,
      updatePanelDropCandidate,
      endPanelDrag,
    }),
    [beginPanelDrag, endPanelDrag, updatePanelDropCandidate],
  );
  const state = useMemo(
    () => ({ draggedPanelId, dropCandidate }),
    [draggedPanelId, dropCandidate],
  );

  return (
    <PanelSnapInteractionActionsContext.Provider value={actions}>
      <PanelSnapInteractionStateContext.Provider value={state}>
        {children}
      </PanelSnapInteractionStateContext.Provider>
    </PanelSnapInteractionActionsContext.Provider>
  );
}

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
