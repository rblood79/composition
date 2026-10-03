import { useMemo, useSyncExternalStore } from "react";
import { ActionBarView } from "../../../components/overlay/actionBar/ContextualActionBar";
import {
  catalogActionBarModel,
  catalogActionBarState,
} from "../../../catalogRuntime/actionBar";
import { catalogMenuHost } from "../../../catalogRuntime/shortcuts";
import { catalogMenuView } from "./catalogMenuView";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";

/**
 * ADR-248 Phase 4e: the Contextual Action Bar (ADR-192) of the catalog Builder — the same bar
 * (`ActionBarView`: placement below the page frame, pin / reset / hide, ⋯) over the catalog
 * selection; its items are the Canvas context menu's under the bar's policy. It renders again
 * only when the selection, the open page, text editing or the document changes (not on hover).
 */
export function CatalogActionBar({
  workspace,
  onError,
  openMenu,
}: {
  workspace: CatalogWorkspace;
  onError?: (error: unknown) => void;
  /** ⋯ — the Canvas context menu at a screen point, over the selection. */
  openMenu: (clientX: number, clientY: number) => void;
}) {
  const store = useMemo(
    () => ({
      subscribe: (notify: () => void) => {
        const offSession = workspace.session.subscribe(notify);
        const offSteps = workspace.runtime.subscribeSteps(() => notify());
        return () => {
          offSession();
          offSteps();
        };
      },
      key: () => {
        const snapshot = workspace.session.getSnapshot();
        return [
          workspace.runtime.graph.revision,
          snapshot.pageId ?? "",
          snapshot.textEditing ? 1 : 0,
          ...snapshot.selection.map((item) => item.identity),
        ].join("|");
      },
    }),
    [workspace],
  );
  const key = useSyncExternalStore(store.subscribe, store.key);
  const { state, model, isEditing } = useMemo(() => {
    void key;
    const snapshot = workspace.session.getSnapshot();
    const next = catalogActionBarState(
      workspace.runtime.graph,
      workspace.root.domInputs,
      snapshot.selection,
      snapshot.pageId,
    );
    return {
      state: next,
      model: catalogActionBarModel(
        catalogMenuHost(workspace, onError, catalogMenuView(workspace)),
        next,
      ),
      isEditing: !!snapshot.textEditing,
    };
  }, [key, onError, workspace]);
  return (
    <ActionBarView
      isEditing={isEditing}
      selectedIds={state.selectedIds}
      pageSelection={state.pageSelection}
      selectedPageId={state.selectedPageId}
      resolved={state.resolved}
      model={model}
      openOverflow={(target) => {
        const rect = target?.getBoundingClientRect();
        openMenu(rect?.left ?? 0, rect?.top ?? 0);
      }}
      pageRectOf={(pageId) => workspace.root.pageFrameRects().get(pageId)}
    />
  );
}
