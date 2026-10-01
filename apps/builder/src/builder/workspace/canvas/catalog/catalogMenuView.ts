import type { CatalogMenuHost } from "../../../catalogRuntime/canvasMenu";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import { useStore } from "../../../stores";
import { useViewportSyncStore } from "../stores";
import { zoomViewportAtContainerCenter } from "../viewport/viewportActions";
import { catalogUnionRect, fitCatalogPageFrame } from "./catalogViewport";

/** The Canvas menu's view items: fit the page frames, 100 %, rulers and snapping. */
export function catalogMenuView(workspace: CatalogWorkspace): CatalogMenuHost["view"] {
  const settings = useStore.getState();
  return {
    zoomToFit: () => {
      const rect = catalogUnionRect([...workspace.root.pageFrameRects().values()]);
      const { containerSize } = useViewportSyncStore.getState();
      if (rect && containerSize.width && containerSize.height)
        fitCatalogPageFrame(rect, containerSize);
    },
    zoom100: () => zoomViewportAtContainerCenter(1),
    rulers: settings.showRulers,
    toggleRulers: () => {
      const current = useStore.getState();
      current.setShowRulers(!current.showRulers);
    },
    snap: settings.snapToObjects,
    toggleSnap: () => {
      const current = useStore.getState();
      current.setSnapToObjects(!current.snapToObjects);
    },
  };
}
