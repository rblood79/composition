import type { CanvasSceneNode } from "./canvasSceneNode";
import type { SelectionSnapshot } from "./sceneSnapshotTypes";

interface BuildSelectionSnapshotInput {
  currentPageId: string | null;
  elementsMap: Map<string, CanvasSceneNode>;
  selectedElementIds: string[];
}

export function buildSelectionSnapshot({
  currentPageId,
  elementsMap,
  selectedElementIds,
}: BuildSelectionSnapshotInput): SelectionSnapshot {
  if (!currentPageId || selectedElementIds.length === 0) {
    return {
      selectedIds: [],
      selectionBounds: null,
    };
  }

  const selectedIds = selectedElementIds.filter((id) => {
    return elementsMap.get(id)?.page_id === currentPageId;
  });

  return {
    selectedIds,
    // ADR-037 Phase 1: read model만 도입. 실제 bounds 계산은 Phase 2 SelectionModel로 이관.
    selectionBounds: null,
  };
}
