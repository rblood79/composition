import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PanelId } from "../panels/core/types";
import type { PanelSnapEdge } from "./panelSnap";

interface ActivePanelSnapTarget {
  panelId: PanelId;
  edge: PanelSnapEdge;
}

interface PanelSnapInteractionValue {
  draggedPanelId: PanelId | null;
  snapTarget: ActivePanelSnapTarget | null;
  beginPanelDrag: (panelId: PanelId) => void;
  updatePanelSnapTarget: (target: ActivePanelSnapTarget | null) => void;
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
  const [snapTarget, setSnapTarget] = useState<ActivePanelSnapTarget | null>(
    null,
  );
  const beginPanelDrag = useCallback((panelId: PanelId) => {
    setDraggedPanelId(panelId);
    setSnapTarget(null);
  }, []);
  const updatePanelSnapTarget = useCallback(
    (target: ActivePanelSnapTarget | null) => setSnapTarget(target),
    [],
  );
  const endPanelDrag = useCallback(() => {
    setDraggedPanelId(null);
    setSnapTarget(null);
  }, []);
  const value = useMemo(
    () => ({
      draggedPanelId,
      snapTarget,
      beginPanelDrag,
      updatePanelSnapTarget,
      endPanelDrag,
    }),
    [
      beginPanelDrag,
      draggedPanelId,
      endPanelDrag,
      snapTarget,
      updatePanelSnapTarget,
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
