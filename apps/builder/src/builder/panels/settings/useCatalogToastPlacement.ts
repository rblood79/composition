import { useCallback, useSyncExternalStore } from "react";
import type { CatalogToastPlacement } from "../../../../../../packages/shared/src/catalog/document/types";
import { setToastPlacement } from "../../../../../../packages/shared/src/catalog/commands";
import { useOptionalCatalogWorkspace } from "../../catalogRuntime/react";

const noop = () => () => {};

/**
 * S2 1.8.0 `ToastContainer` `placement` — where the open project's app shows its toasts (the
 * project's `toastPlacement`; absent = `bottom end`), each edit one history step. `null` outside a
 * catalog project.
 */
export function useCatalogToastPlacement(): {
  value: CatalogToastPlacement;
  change: (placement: CatalogToastPlacement) => void;
} | null {
  const workspace = useOptionalCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) =>
      workspace
        ? workspace.runtime.subscribeEntryField(
            workspace.runtime.graph.projectId,
            "toastPlacement",
            notify,
          )
        : noop(),
    [workspace],
  );
  const value = useSyncExternalStore(
    subscribe,
    () =>
      workspace?.runtime.selectEntryField(
        workspace.runtime.graph.projectId,
        "toastPlacement",
      ) as CatalogToastPlacement | undefined,
  );
  const change = useCallback(
    (placement: CatalogToastPlacement) => {
      workspace?.execute(setToastPlacement({ placement }));
    },
    [workspace],
  );
  if (!workspace) return null;
  return { value: value ?? "bottom end", change };
}
