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

interface PanelSnapInteractionValue {
  draggedPanelId: PanelId | null;
  dropCandidate: PanelDropCandidate;
  beginPanelDrag: (panelId: PanelId) => void;
  updatePanelDropCandidate: (candidate: PanelDropCandidate) => void;
  endPanelDrag: () => void;
}

const PanelSnapInteractionContext =
  createContext<PanelSnapInteractionValue | null>(null);

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
  const value = useMemo(
    () => ({
      draggedPanelId,
      dropCandidate,
      beginPanelDrag,
      updatePanelDropCandidate,
      endPanelDrag,
    }),
    [
      beginPanelDrag,
      draggedPanelId,
      dropCandidate,
      endPanelDrag,
      updatePanelDropCandidate,
    ],
  );

  return (
    <PanelSnapInteractionContext.Provider value={value}>
      {children}
    </PanelSnapInteractionContext.Provider>
  );
}

export function usePanelSnapInteraction(): PanelSnapInteractionValue {
  const value = useContext(PanelSnapInteractionContext);
  if (!value) {
    throw new Error(
      "usePanelSnapInteraction must be used within PanelSnapInteractionProvider",
    );
  }
  return value;
}
