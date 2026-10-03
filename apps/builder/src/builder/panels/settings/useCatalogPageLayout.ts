import { useCallback, useSyncExternalStore } from "react";
import { useOptionalCatalogWorkspace } from "../../catalogRuntime/react";
import {
  catalogPageLayoutCommand,
  catalogPageLayoutView,
  type CatalogPageLayoutChange,
  type CatalogPageLayoutView,
} from "../../catalogRuntime/pageLayoutSettings";

const noop = () => () => {};

/**
 * ADR-248 4e: the page grid Settings edits in an open catalog project — the project's
 * `pageLayout` declaration at the session's breakpoint, each edit one history step. `null`
 * outside a catalog project (the old store's fields apply).
 */
export function useCatalogPageLayout(): {
  view: CatalogPageLayoutView;
  change: (change: CatalogPageLayoutChange) => void;
} | null {
  const workspace = useOptionalCatalogWorkspace();
  const subscribeLayout = useCallback(
    (notify: () => void) =>
      workspace ? workspace.readModel.subscribePageLayout(notify) : noop(),
    [workspace],
  );
  const layout = useSyncExternalStore(subscribeLayout, () =>
    workspace?.readModel.pageLayout(),
  );
  const subscribeSession = useCallback(
    (notify: () => void) =>
      workspace ? workspace.session.subscribe(notify) : noop(),
    [workspace],
  );
  const breakpoint = useSyncExternalStore(
    subscribeSession,
    () => workspace?.session.getSnapshot().breakpoint ?? "desktop",
  );
  const change = useCallback(
    (next: CatalogPageLayoutChange) => {
      if (!workspace) return;
      workspace.execute(
        catalogPageLayoutCommand(
          workspace.readModel.pageLayout(),
          workspace.session.getSnapshot().breakpoint,
          next,
        ),
      );
    },
    [workspace],
  );
  if (!workspace) return null;
  return { view: catalogPageLayoutView(layout, breakpoint), change };
}
