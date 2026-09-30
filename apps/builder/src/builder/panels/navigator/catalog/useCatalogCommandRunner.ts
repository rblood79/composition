import { useCallback } from "react";
import type { CatalogCommand } from "../../../../../../../packages/shared/src/catalog/commands/compose";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { useToastStore } from "../../../stores/toast";

/**
 * ADR-248 Phase 4e-4: run a panel action's command on the open project (one history step). A
 * refused command (nesting, last page, …) changes nothing and shows its reason; returns whether it
 * ran.
 */
export function useCatalogCommandRunner(): (
  command: CatalogCommand,
) => boolean {
  const workspace = useCatalogWorkspace();
  return useCallback(
    (command: CatalogCommand) => {
      try {
        workspace.execute(command);
        return true;
      } catch (error) {
        useToastStore
          .getState()
          .showToast(
            "error",
            error instanceof Error ? error.message : String(error),
          );
        return false;
      }
    },
    [workspace],
  );
}
