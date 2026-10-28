import { useCallback } from "react";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import { useCatalogWorkspace } from "./react";
import { notifyEditRefusal, notifyKnownRefusal } from "./operationNotice";
import type { CatalogWorkspace } from "./workspace";
import { useToastStore } from "../stores/toast";

/**
 * A panel edit that failed: a refused command (nesting, last page, a redirect not starting with
 * `/` …) shows its reason (`notifyEditRefusal`), anything else its message as an error toast.
 */
export function reportCatalogCommandError(error: unknown): void {
  if (notifyEditRefusal(error) || notifyKnownRefusal(error)) return;
  useToastStore
    .getState()
    .showToast("error", error instanceof Error ? error.message : String(error));
}

/**
 * ADR-248 Phase 4e-4: run a panel action's command on the open project (one history step). A
 * refused command changes nothing and shows its reason; returns whether it ran.
 */
export function runCatalogCommand(
  workspace: CatalogWorkspace,
  command: CatalogCommand,
): boolean {
  return runBuiltCatalogCommand(workspace, () => command);
}

/**
 * `runCatalogCommand` whose command is built inside the same guard — a command that fails while it
 * is being built reports the same way. `undefined` = nothing to write (returns false).
 */
export function runBuiltCatalogCommand(
  workspace: CatalogWorkspace,
  build: () => CatalogCommand | undefined,
): boolean {
  try {
    const command = build();
    if (!command) return false;
    workspace.execute(command);
    return true;
  } catch (error) {
    reportCatalogCommandError(error);
    return false;
  }
}

/** `runCatalogCommand` on the provided workspace (`CatalogWorkspaceProvider`). */
export function useCatalogCommandRunner(): (
  command: CatalogCommand,
) => boolean {
  const workspace = useCatalogWorkspace();
  return useCallback(
    (command: CatalogCommand) => runCatalogCommand(workspace, command),
    [workspace],
  );
}
