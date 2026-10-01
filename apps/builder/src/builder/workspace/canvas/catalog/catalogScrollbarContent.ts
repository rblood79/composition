import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { CanvasScrollbarContent } from "../../scrollbar/CanvasScrollbar";

/**
 * ADR-248 Phase 4e: the Canvas scrollbars' range on the catalog Builder — the laid-out page frames
 * (the old scrollbars read the old store's page positions, empty here). A step (a page added,
 * moved or resized) or a session change (breakpoint, definition view: another root) may move them.
 */
export function catalogScrollbarContent(
  workspace: CatalogWorkspace,
): CanvasScrollbarContent {
  return {
    rects: () => [...workspace.root.pageFrameRects().values()],
    subscribe: (notify) => {
      const offSteps = workspace.runtime.subscribeSteps(() => notify());
      const offSession = workspace.session.subscribe(notify);
      return () => {
        offSteps();
        offSession();
      };
    },
  };
}
