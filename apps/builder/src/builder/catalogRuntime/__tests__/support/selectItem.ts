import { composeCommands } from "../../../../../../../packages/shared/src/catalog/commands";
import { catalogItemSelectionCommands } from "../../singleSelection";
import type { CatalogWorkspace } from "../../workspace";

/**
 * ADR-308 — an item selected (or not) the way the Design panel does it: its key put in its group's
 * stored keys or taken out (`catalogItemSelectionCommands`), no item `isSelected`.
 */
export function selectItem(
  workspace: CatalogWorkspace,
  recordId: string,
  value = true,
): void {
  const commands = catalogItemSelectionCommands(workspace, recordId, value);
  if (!commands.length) throw new Error(`not a group item: ${recordId}`);
  workspace.execute(() =>
    composeCommands(workspace.runtime.graph, "Select", commands),
  );
}
