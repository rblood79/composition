import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { PanelId } from "../panels/core/types";
import type { PanelDropCandidate } from "./panelWorkspaceZoneDrop";
import {
  PanelSnapInteractionActionsContext,
  PanelSnapInteractionStateContext,
} from "./panelSnapInteractionContext";

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
